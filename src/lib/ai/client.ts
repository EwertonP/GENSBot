import type { AIProvider, ChatMessage, AIGenerateResult, AIToolCall } from '@/types/ai';

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

/**
 * Ferramentas nativas do GENSBot expostas para a IA (Function Calling)
 */
export const CRM_AI_TOOLS: AIToolDefinition[] = [
  {
    name: 'crm_identificar_lead',
    description: 'Registra ou atualiza os dados identificados do lead (nome, telefone com DDD, e-mail, interesse/serviço desejado). Chame sempre que o lead fornecer esses dados.',
    parameters: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do cliente se informado' },
        telefone: { type: 'string', description: 'Telefone ou WhatsApp com DDD (apenas números)' },
        email: { type: 'string', description: 'E-mail do cliente se informado' },
        interesse: { type: 'string', description: 'Serviço, produto ou procedimento de interesse' },
        orcamento_estimado: { type: 'string', description: 'Valor ou faixa de orçamento mencionado' },
      },
    },
  },
  {
    name: 'crm_avancar_etapa',
    description: 'Move a oportunidade do cliente no pipeline de vendas quando a conversa atinge um marco de qualificação.',
    parameters: {
      type: 'object',
      properties: {
        etapa: {
          type: 'string',
          enum: ['inicial', 'qualificado', 'proposta', 'agendado'],
          description: 'Qual marco foi atingido no diálogo.',
        },
        motivo: { type: 'string', description: 'Breve resumo do motivo do avanço' },
      },
      required: ['etapa'],
    },
  },
  {
    name: 'solicitar_atendimento_humano',
    description: 'Pausa as respostas automáticas da IA e avisa a equipe humana no Inbox quando o cliente solicitar falar com uma pessoa ou quando houver uma dúvida muito complexa/sensível.',
    parameters: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Motivo pelo qual a IA está passando a conversa para um atendente humano.' },
      },
      required: ['motivo'],
    },
  },
];

/**
 * Cliente Unificado Multi-LLM (OpenAI, Google Gemini, Anthropic) via Fetch nativo (Zero dependências pesadas)
 */
export async function chamarLLM({
  provider,
  apiKey,
  model,
  temperature = 0.7,
  systemPrompt,
  messages,
  tools = CRM_AI_TOOLS,
}: {
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature?: number;
  systemPrompt?: string;
  messages: ChatMessage[];
  tools?: AIToolDefinition[];
}): Promise<AIGenerateResult> {
  if (!apiKey?.trim()) {
    throw new Error(`Chave de API não configurada para o provedor ${provider}.`);
  }

  switch (provider) {
    case 'openai':
      return chamarOpenAI({ apiKey, model, temperature, systemPrompt, messages, tools });
    case 'gemini':
      return chamarGemini({ apiKey, model, temperature, systemPrompt, messages, tools });
    case 'anthropic':
      return chamarAnthropic({ apiKey, model, temperature, systemPrompt, messages, tools });
    default:
      throw new Error(`Provedor de IA não suportado: ${provider}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────
   1. Provedor OpenAI (GPT-4o, GPT-4o-mini, etc.)
   ──────────────────────────────────────────────────────────────────────── */
async function chamarOpenAI({
  apiKey,
  model,
  temperature,
  systemPrompt,
  messages,
  tools,
}: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt?: string;
  messages: ChatMessage[];
  tools?: AIToolDefinition[];
}): Promise<AIGenerateResult> {
  const formattedMessages: any[] = [];
  if (systemPrompt?.trim()) {
    formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
  }
  for (const m of messages) {
    formattedMessages.push({ role: m.role, content: m.content });
  }

  const formattedTools = tools?.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      temperature,
      messages: formattedMessages,
      tools: formattedTools && formattedTools.length > 0 ? formattedTools : undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Erro ao chamar OpenAI API');
  }

  const choice = data.choices?.[0]?.message;
  const replyText = choice?.content || '';

  const toolCalls: AIToolCall[] = [];
  if (Array.isArray(choice?.tool_calls)) {
    for (const tc of choice.tool_calls) {
      try {
        toolCalls.push({
          id: tc.id,
          name: tc.function?.name,
          arguments: JSON.parse(tc.function?.arguments || '{}'),
        });
      } catch (err) {
        console.error('Erro ao parsear argumentos de tool OpenAI:', err);
      }
    }
  }

  return {
    replyText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    tokensUsage: data.usage ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens, total: data.usage.total_tokens } : undefined,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   2. Provedor Google Gemini (Gemini 1.5 Flash, 1.5 Pro, etc.)
   ──────────────────────────────────────────────────────────────────────── */
async function chamarGemini({
  apiKey,
  model,
  temperature,
  systemPrompt,
  messages,
  tools,
}: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt?: string;
  messages: ChatMessage[];
  tools?: AIToolDefinition[];
}): Promise<AIGenerateResult> {
  const geminiModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  // Formata histórico no padrão Gemini
  const contents = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const payload: any = {
    contents,
    generationConfig: {
      temperature,
    },
  };

  if (systemPrompt?.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }],
    };
  }

  // Declaração de function calling no Gemini
  if (tools && tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Erro ao chamar Google Gemini API');
  }

  const candidate = data.candidates?.[0]?.content?.parts || [];
  let replyText = '';
  const toolCalls: AIToolCall[] = [];

  for (const part of candidate) {
    if (part.text) {
      replyText += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `call_${Date.now()}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return {
    replyText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   3. Provedor Anthropic Claude (Claude 3.5 Sonnet, Claude 3.5 Haiku)
   ──────────────────────────────────────────────────────────────────────── */
async function chamarAnthropic({
  apiKey,
  model,
  temperature,
  systemPrompt,
  messages,
  tools,
}: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt?: string;
  messages: ChatMessage[];
  tools?: AIToolDefinition[];
}): Promise<AIGenerateResult> {
  const anthropicModel = model || 'claude-3-5-haiku-20241022';

  const formattedMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const formattedTools = tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 1024,
      temperature,
      system: systemPrompt?.trim() || undefined,
      messages: formattedMessages,
      tools: formattedTools && formattedTools.length > 0 ? formattedTools : undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Erro ao chamar Anthropic API');
  }

  let replyText = '';
  const toolCalls: AIToolCall[] = [];

  for (const block of data.content || []) {
    if (block.type === 'text') {
      replyText += block.text;
    }
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input || {},
      });
    }
  }

  return {
    replyText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}
