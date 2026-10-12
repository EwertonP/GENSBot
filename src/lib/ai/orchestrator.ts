import { supabase } from '@/lib/supabase';
import { chamarLLM } from './client';
import { garantirPipelinePadrao } from '@/lib/crm';
import type { AIAgentConfig, AIContactSession, ChatMessage } from '@/types/ai';

interface ProcessarMensagemDirectOptions {
  instagramUserId: string;
  senderId: string;
  senderUsername?: string | null;
  text: string;
  ownerUserId: string;
}

interface ProcessarResultado {
  processadoPorIA: boolean;
  respostaGerada?: string;
  devePausarParaHumano?: boolean;
}

/**
 * Orquestrador do Agente de IA para DMs do Instagram Direct:
 * 1. Verifica se a conta/cliente possui um Agente de IA ativo e com API key.
 * 2. Verifica se a sessão do contato está em modo 'ia' (não foi assumida por humano).
 * 3. Monta o histórico recente de conversas.
 * 4. Invoca o modelo (OpenAI, Gemini ou Anthropic) com Function Calling para CRM.
 * 5. Executa as ações de CRM requeridas pela IA (criar lead, avançar etapa, pausar).
 * 6. Devolve a resposta final para envio pelo Instagram Graph API.
 */
export async function processarMensagemDirectComIA({
  instagramUserId,
  senderId,
  senderUsername,
  text,
  ownerUserId,
}: ProcessarMensagemDirectOptions): Promise<ProcessarResultado> {
  try {
    // 1. Identificar a conta de Instagram e o cliente vinculado
    const { data: igAcc } = await supabase
      .from('instagram_accounts')
      .select('id, user_id, instagram_username')
      .eq('instagram_user_id', instagramUserId)
      .maybeSingle();

    if (!igAcc) return { processadoPorIA: false };

    // Busca o cliente vinculado à conta (se houver)
    const { data: cli } = await supabase
      .from('clientes')
      .select('id, agencia_id')
      .eq('instagram_account_id', igAcc.id)
      .maybeSingle();

    const defaultAgenciaId = cli?.agencia_id || 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
    const clienteId = cli?.id || null;

    // 2. Busca configuração de IA para o cliente ou agência
    let queryConfig = supabase
      .from('ai_agent_configs')
      .select('*')
      .eq('agencia_id', defaultAgenciaId)
      .eq('ativo', true);

    if (clienteId) {
      queryConfig = queryConfig.eq('cliente_id', clienteId);
    } else {
      queryConfig = queryConfig.is('cliente_id', null);
    }

    const { data: config } = await queryConfig.maybeSingle();
    const aiConfig = config as AIAgentConfig | null;

    // Se não há IA ativa ou chave de API configurada, deixa seguir para fluxos normais
    if (!aiConfig || !aiConfig.api_key) {
      return { processadoPorIA: false };
    }

    // 3. Checa palavras de pausa imediata (Human Takeover)
    const palavrasPausa = aiConfig.palavras_pausar_ia || ['atendente', 'falar com humano', 'atendimento'];
    const textoNormalizado = text.toLowerCase();
    const querHumano = palavrasPausa.some((p) => textoNormalizado.includes(p.toLowerCase()));

    // 4. Busca ou cria sessão do contato
    const { data: sessaoExistente } = await supabase
      .from('ai_contact_sessions')
      .select('*')
      .eq('instagram_user_id', instagramUserId)
      .eq('contact_id', senderId)
      .maybeSingle();

    let sessao = sessaoExistente as AIContactSession | null;

    if (sessao && (sessao.modo === 'humano' || sessao.modo === 'pausado')) {
      // Atendimento assumido por humano: a IA não interfere
      return { processadoPorIA: false };
    }

    if (querHumano) {
      // Pausa imediatamente a IA para atendimento humano
      await pausarIASessao(instagramUserId, senderId, defaultAgenciaId, 'Lead solicitou atendimento humano');
      return {
        processadoPorIA: true,
        respostaGerada: 'Perfeito! Vou avisar nossa equipe agora mesmo para que um atendente continue a conversa por aqui.',
        devePausarParaHumano: true,
      };
    }

    // 5. Carrega histórico recente das últimas 6 mensagens para dar contexto
    const { data: ultimasMensagens } = await supabase
      .from('messages')
      .select('text, direction')
      .eq('instagram_user_id', instagramUserId)
      .eq('contact_id', senderId)
      .order('created_at', { ascending: false })
      .limit(6);

    const historicoChat: ChatMessage[] = (ultimasMensagens || [])
      .reverse()
      .filter((m) => !!m.text)
      .map((m) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.text as string,
      }));

    // Adiciona a mensagem atual se ainda não estiver no histórico
    historicoChat.push({ role: 'user', content: text });

    // 6. Chama o modelo de IA com function calling
    const resultadoIA = await chamarLLM({
      provider: aiConfig.provedor,
      apiKey: aiConfig.api_key,
      model: aiConfig.modelo,
      temperature: Number(aiConfig.temperatura) || 0.7,
      systemPrompt: aiConfig.prompt_sistema,
      messages: historicoChat,
    });

    // 7. Executa as Tools chamadas pela IA (se houver)
    if (resultadoIA.toolCalls && resultadoIA.toolCalls.length > 0) {
      for (const tool of resultadoIA.toolCalls) {
        if (tool.name === 'crm_identificar_lead') {
          await executarToolIdentificarLead({
            agenciaId: defaultAgenciaId,
            clienteId,
            aiConfig,
            instagramUserId,
            senderId,
            senderUsername,
            args: tool.arguments,
            sessao,
          });
        } else if (tool.name === 'crm_avancar_etapa') {
          await executarToolAvancarEtapa({
            agenciaId: defaultAgenciaId,
            clienteId,
            aiConfig,
            instagramUserId,
            senderId,
            args: tool.arguments,
            sessao,
          });
        } else if (tool.name === 'solicitar_atendimento_humano') {
          await pausarIASessao(instagramUserId, senderId, defaultAgenciaId, tool.arguments?.motivo || 'IA acionou transição humana');
          return {
            processadoPorIA: true,
            respostaGerada: resultadoIA.replyText || 'Um momento, estou transferindo você para um dos nossos consultores.',
            devePausarParaHumano: true,
          };
        }
      }
    }

    // 8. Atualiza timestamp da sessão
    await supabase.from('ai_contact_sessions').upsert(
      {
        agencia_id: defaultAgenciaId,
        instagram_user_id: instagramUserId,
        contact_id: senderId,
        cliente_id: clienteId,
        modo: 'ia',
        ultima_interacao_ia: new Date().toISOString(),
      },
      { onConflict: 'instagram_user_id,contact_id' }
    );

    return {
      processadoPorIA: true,
      respostaGerada: resultadoIA.replyText,
    };
  } catch (err) {
    console.error('Erro no orquestrador de IA do Direct:', err);
    return { processadoPorIA: false };
  }
}

/** Executa cadastro ou atualização do lead no CRM quando a IA extrai dados */
async function executarToolIdentificarLead({
  agenciaId,
  clienteId,
  aiConfig,
  instagramUserId,
  senderId,
  senderUsername,
  args,
  sessao,
}: {
  agenciaId: string;
  clienteId: string | null;
  aiConfig: AIAgentConfig;
  instagramUserId: string;
  senderId: string;
  senderUsername?: string | null;
  args: Record<string, any>;
  sessao: AIContactSession | null;
}) {
  try {
    const pipelineId = aiConfig.pipeline_id;
    let pipe: any = null;
    if (pipelineId) {
      const { data } = await supabase.from('crm_pipelines').select('*, estagios:crm_estagios(*)').eq('id', pipelineId).maybeSingle();
      pipe = data;
    }
    if (!pipe) {
      pipe = await garantirPipelinePadrao(agenciaId, clienteId);
    }
    if (!pipe || !pipe.estagios || pipe.estagios.length === 0) return;

    const estagioInicialId = aiConfig.estagio_inicial_id || pipe.estagios[0].id;
    const nomeLead = args.nome || (senderUsername ? `@${senderUsername}` : 'Lead Instagram');
    const tel = args.telefone ? String(args.telefone).replace(/\D/g, '') : null;

    // Se já existe um negócio vinculado a essa sessão, atualiza
    if (sessao?.negocio_id) {
      await supabase
        .from('crm_negocios')
        .update({
          nome_contato: nomeLead,
          telefone: tel,
          email: args.email || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', sessao.negocio_id);

      await supabase.from('crm_atividades').insert({
        negocio_id: sessao.negocio_id,
        agencia_id: agenciaId,
        tipo: 'nota',
        descricao: `🤖 IA qualificou dados do lead: ${JSON.stringify(args)}`,
      });
      return;
    }

    // Caso contrário, cria uma nova oportunidade
    const { data: negCriado } = await supabase
      .from('crm_negocios')
      .insert({
        agencia_id: agenciaId,
        cliente_id: clienteId,
        pipeline_id: pipe.id,
        estagio_id: estagioInicialId,
        titulo: `${nomeLead} (Qualificado via IA)`,
        valor: parseFloat(args.orcamento_estimado) || 0,
        status: 'aberto',
        nome_contato: nomeLead,
        telefone: tel,
        email: args.email || null,
        instagram_username: senderUsername || null,
        origem: 'instagram',
        tags: ['Qualificado por IA', 'Instagram Direct'],
        ultimo_contato_em: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (negCriado) {
      await supabase.from('ai_contact_sessions').upsert(
        {
          agencia_id: agenciaId,
          instagram_user_id: instagramUserId,
          contact_id: senderId,
          cliente_id: clienteId,
          negocio_id: negCriado.id,
          dados_extraidos: args,
          modo: 'ia',
          ultima_interacao_ia: new Date().toISOString(),
        },
        { onConflict: 'instagram_user_id,contact_id' }
      );

      await supabase.from('crm_atividades').insert({
        negocio_id: negCriado.id,
        agencia_id: agenciaId,
        tipo: 'criacao',
        descricao: `🤖 Oportunidade criada automaticamente pelo Agente de IA no Instagram Direct.`,
        dados_extras: args,
      });
    }
  } catch (err) {
    console.error('Erro ao executar tool crm_identificar_lead:', err);
  }
}

/** Move o card de estágio no pipeline conforme avanço da conversa */
async function executarToolAvancarEtapa({
  agenciaId,
  clienteId,
  aiConfig,
  instagramUserId,
  senderId,
  args,
  sessao,
}: {
  agenciaId: string;
  clienteId: string | null;
  aiConfig: AIAgentConfig;
  instagramUserId: string;
  senderId: string;
  args: Record<string, any>;
  sessao: AIContactSession | null;
}) {
  if (!sessao?.negocio_id) return;

  let estagioDestinoId: string | null | undefined = null;
  if (args.etapa === 'qualificado') estagioDestinoId = aiConfig.estagio_qualificado_id;
  else if (args.etapa === 'proposta') estagioDestinoId = aiConfig.estagio_proposta_id;
  else if (args.etapa === 'agendado') estagioDestinoId = aiConfig.estagio_agendado_id;

  if (!estagioDestinoId) return;

  try {
    const { data: estagio } = await supabase.from('crm_estagios').select('nome, tipo_conclusao').eq('id', estagioDestinoId).maybeSingle();

    await supabase
      .from('crm_negocios')
      .update({
        estagio_id: estagioDestinoId,
        status: estagio?.tipo_conclusao === 'ganho' ? 'ganho' : 'aberto',
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', sessao.negocio_id);

    await supabase.from('crm_atividades').insert({
      negocio_id: sessao.negocio_id,
      agencia_id: agenciaId,
      tipo: 'mudanca_estagio',
      descricao: `🤖 IA moveu oportunidade para a etapa "${estagio?.nome || args.etapa}": ${args.motivo || 'Marco atingido'}`,
    });
  } catch (err) {
    console.error('Erro ao mover etapa via IA:', err);
  }
}

/** Pausa a IA para o contato específico para atendimento humano */
export async function pausarIASessao(instagramUserId: string, contactId: string, agenciaId: string, motivo: string) {
  await supabase.from('ai_contact_sessions').upsert(
    {
      agencia_id: agenciaId,
      instagram_user_id: instagramUserId,
      contact_id: contactId,
      modo: 'humano',
      pausado_em: new Date().toISOString(),
      pausado_motivo: motivo,
    },
    { onConflict: 'instagram_user_id,contact_id' }
  );
}

/** Reativa a IA para o contato */
export async function reativarIASessao(instagramUserId: string, contactId: string, agenciaId: string) {
  await supabase.from('ai_contact_sessions').upsert(
    {
      agencia_id: agenciaId,
      instagram_user_id: instagramUserId,
      contact_id: contactId,
      modo: 'ia',
      pausado_em: null,
      pausado_motivo: null,
      ultima_interacao_ia: new Date().toISOString(),
    },
    { onConflict: 'instagram_user_id,contact_id' }
  );
}
