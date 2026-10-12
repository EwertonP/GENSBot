-- Migration: 20261012_whatsapp_shadow_crm.sql
-- Módulo WhatsApp Copiloto / Escuta Ativa com OpenWA & Atualização Silenciosa de CRM via IA

-- 1. Sessões de WhatsApp por Cliente / Agência
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  status text NOT NULL DEFAULT 'desconectado' CHECK (status IN ('desconectado', 'aguardando_qrcode', 'conectado', 'erro')),
  phone_number text,
  push_name text,
  qr_code text,
  ia_escuta_ativa boolean NOT NULL DEFAULT true,
  auto_criar_cards boolean NOT NULL DEFAULT true,
  auto_mover_estagios boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  conectado_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agencia_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_cliente ON public.whatsapp_sessions(cliente_id);

-- 2. Mensagens do WhatsApp gravadas para histórico e análise de IA
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  remetente text NOT NULL, -- número de telefone do contato ou 'secretaria'/'eu'
  de_mim boolean NOT NULL DEFAULT false, -- true = secretária digitou; false = paciente digitou
  tipo text NOT NULL DEFAULT 'texto', -- texto, audio, imagem, documento
  conteudo text,
  midia_url text,
  nome_contato text,
  negocio_id uuid REFERENCES public.crm_negocios(id) ON DELETE SET NULL,
  analisado_por_ia boolean NOT NULL DEFAULT false,
  ia_insights jsonb,
  timestamp_msg timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agencia_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_negocio ON public.whatsapp_mensagens(negocio_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_remetente ON public.whatsapp_mensagens(remetente, cliente_id);

-- 3. Log de Decisões e Movimentações da IA Shadow
CREATE TABLE IF NOT EXISTS public.whatsapp_ia_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  negocio_id uuid REFERENCES public.crm_negocios(id) ON DELETE CASCADE,
  acao text NOT NULL, -- 'card_criado', 'estagio_movido', 'resumo_gerado', 'tarefa_criada', 'dados_extraidos'
  estagio_anterior text,
  estagio_novo text,
  resumo_detectado text,
  dados_extraidos jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ia_acoes_negocio ON public.whatsapp_ia_acoes(negocio_id);
