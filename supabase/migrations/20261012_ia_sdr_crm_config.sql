-- Migration: 20261012_ia_sdr_crm_config.sql
-- Configuração de IA Multi-LLM (OpenAI, Gemini, Anthropic) para SDR e Automação no CRM e Direct

-- 1. Tabela de Configurações de IA por Agência / Cliente / Conta de Instagram
CREATE TABLE IF NOT EXISTS public.ai_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,

  -- Provedor e Chaves
  ativo boolean NOT NULL DEFAULT false,
  provedor text NOT NULL DEFAULT 'openai' CHECK (provedor IN ('openai', 'gemini', 'anthropic', 'groq')),
  api_key text, -- chave informada pelo usuário (BYOK)
  modelo text NOT NULL DEFAULT 'gpt-4o-mini',
  temperatura numeric(3,2) NOT NULL DEFAULT 0.7,

  -- Personalidade e Comportamento do SDR
  nome_agente text NOT NULL DEFAULT 'Assistente Virtual',
  prompt_sistema text NOT NULL DEFAULT 'Você é um assistente comercial cordial e objetivo. Seu objetivo é tirar dúvidas do cliente, entender suas necessidades e conduzi-lo para o agendamento ou proposta.',
  mensagem_saudacao text,
  
  -- Gatilhos & Mapeamento de Funil CRM
  pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  estagio_inicial_id uuid REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  estagio_qualificado_id uuid REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  estagio_proposta_id uuid REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  estagio_agendado_id uuid REFERENCES public.crm_estagios(id) ON DELETE SET NULL,

  -- Configurações de Transição & Human Takeover
  responder_direct_geral boolean NOT NULL DEFAULT true, -- se assume DMs quando não bate palavra-chave fixa
  palavras_pausar_ia text[] DEFAULT '{"atendente", "falar com humano", "atendimento", "pessoa"}',

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  -- Um config por cliente ou agência
  CONSTRAINT uq_ai_config_escopo UNIQUE (agencia_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_agencia ON public.ai_agent_configs(agencia_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_cliente ON public.ai_agent_configs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_instagram ON public.ai_agent_configs(instagram_account_id);

-- 2. Controle de Sessão de IA por Contato (para saber se o robô está ativo ou pausado para aquele lead)
CREATE TABLE IF NOT EXISTS public.ai_contact_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL,
  contact_id text NOT NULL, -- instagram_id do remetente
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  negocio_id uuid REFERENCES public.crm_negocios(id) ON DELETE SET NULL,

  modo text NOT NULL DEFAULT 'ia' CHECK (modo IN ('ia', 'humano', 'pausado')),
  pausado_em timestamptz,
  pausado_motivo text,
  ultima_interacao_ia timestamptz DEFAULT now(),

  historico_resumo text, -- resumo do contexto da conversa para economia de tokens
  dados_extraidos jsonb DEFAULT '{}', -- ex: {"nome": "Lucas", "whatsapp": "11999998888", "interesse": "Lipo"}

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_ai_session_contact UNIQUE (instagram_user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_contact ON public.ai_contact_sessions(instagram_user_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_negocio ON public.ai_contact_sessions(negocio_id);

-- 3. Habilitar RLS
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_contact_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_configs_agencia_policy" ON public.ai_agent_configs
  FOR ALL TO authenticated
  USING (agencia_id = private.agencia_atual())
  WITH CHECK (agencia_id = private.agencia_atual());

CREATE POLICY "ai_contact_sessions_agencia_policy" ON public.ai_contact_sessions
  FOR ALL TO authenticated
  USING (agencia_id = private.agencia_atual())
  WITH CHECK (agencia_id = private.agencia_atual());
