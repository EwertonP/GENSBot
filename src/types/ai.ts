export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'groq';

export interface AIAgentConfig {
  id: string;
  agencia_id: string;
  cliente_id?: string | null;
  instagram_account_id?: string | null;
  ativo: boolean;
  provedor: AIProvider;
  api_key?: string | null;
  modelo: string;
  temperatura: number;
  nome_agente: string;
  prompt_sistema: string;
  mensagem_saudacao?: string | null;
  pipeline_id?: string | null;
  estagio_inicial_id?: string | null;
  estagio_qualificado_id?: string | null;
  estagio_proposta_id?: string | null;
  estagio_agendado_id?: string | null;
  responder_direct_geral: boolean;
  palavras_pausar_ia?: string[];
  criado_em?: string;
  atualizado_em?: string;
}

export interface AIContactSession {
  id: string;
  agencia_id: string;
  instagram_user_id: string;
  contact_id: string;
  cliente_id?: string | null;
  negocio_id?: string | null;
  modo: 'ia' | 'humano' | 'pausado';
  pausado_em?: string | null;
  pausado_motivo?: string | null;
  ultima_interacao_ia: string;
  historico_resumo?: string | null;
  dados_extraidos?: Record<string, any>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AIGenerateResult {
  replyText: string;
  toolCalls?: AIToolCall[];
  tokensUsage?: { prompt: number; completion: number; total: number };
}
