-- Migration: 20261012_crm_sistema_completo.sql
-- CRM Completo Nativo no GENSBot (Pipelines da Agência e Pipelines dos Clientes)

-- 1. Pipelines / Funis de Vendas
CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_pipelines_agencia ON public.crm_pipelines (agencia_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_cliente ON public.crm_pipelines (cliente_id);

-- 2. Estágios / Etapas do Funil
CREATE TABLE IF NOT EXISTS public.crm_estagios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#3b82f6',
  ordem int NOT NULL DEFAULT 0,
  tipo_conclusao text NOT NULL DEFAULT 'aberto' CHECK (tipo_conclusao IN ('aberto', 'ganho', 'perdido')),
  dias_limite_estagnado int DEFAULT 3,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_estagios_pipeline ON public.crm_estagios (pipeline_id, ordem);

-- 3. Negócios / Oportunidades / Cards do Funil
CREATE TABLE IF NOT EXISTS public.crm_negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  estagio_id uuid NOT NULL REFERENCES public.crm_estagios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  moeda text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'ganho', 'perdido')),
  motivo_perda text,
  data_conclusao timestamptz,
  previsao_fechamento date,
  probabilidade int CHECK (probabilidade >= 0 AND probabilidade <= 100),
  
  -- Contato
  nome_contato text NOT NULL,
  telefone text,
  email text,
  instagram_username text,
  empresa text,
  cargo text,

  -- Vínculos de Entrada
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  form_response_id uuid REFERENCES public.form_responses(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'instagram', 'formulario', 'webhook_ads', 'indicacao', 'outros')),
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Atribuição e Gestão
  responsavel_id uuid REFERENCES public.membros(id) ON DELETE SET NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  tags text[] DEFAULT '{}',
  ordem_no_estagio int NOT NULL DEFAULT 0,
  ultimo_contato_em timestamptz DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_agencia ON public.crm_negocios (agencia_id);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_cliente ON public.crm_negocios (cliente_id);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_pipeline_estagio ON public.crm_negocios (pipeline_id, estagio_id);
CREATE INDEX IF NOT EXISTS idx_crm_negocios_responsavel ON public.crm_negocios (responsavel_id);

-- 4. Linha do Tempo / Atividades do Negócio
CREATE TABLE IF NOT EXISTS public.crm_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.crm_negocios(id) ON DELETE CASCADE,
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  membro_id uuid REFERENCES public.membros(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('nota', 'whatsapp', 'ligacao', 'reuniao', 'mudanca_estagio', 'criacao', 'ganho', 'perda', 'tarefa')),
  descricao text NOT NULL,
  dados_extras jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_atividades_negocio ON public.crm_atividades (negocio_id, criado_em DESC);

-- 5. Lembretes e Follow-ups de Vendas
CREATE TABLE IF NOT EXISTS public.crm_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.crm_negocios(id) ON DELETE CASCADE,
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES public.membros(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'whatsapp' CHECK (tipo IN ('whatsapp', 'ligacao', 'email', 'reuniao', 'outros')),
  prazo timestamptz NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tarefas_negocio ON public.crm_tarefas (negocio_id);
CREATE INDEX IF NOT EXISTS idx_crm_tarefas_responsavel ON public.crm_tarefas (responsavel_id, prazo);

-- Habilitar RLS
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tarefas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS baseadas em private.agencia_atual()
CREATE POLICY "membros_veem_pipelines_sua_agencia"
  ON public.crm_pipelines
  FOR ALL
  TO authenticated
  USING (agencia_id = private.agencia_atual())
  WITH CHECK (agencia_id = private.agencia_atual());

CREATE POLICY "membros_veem_estagios_sua_agencia"
  ON public.crm_estagios
  FOR ALL
  TO authenticated
  USING (pipeline_id IN (SELECT id FROM public.crm_pipelines WHERE agencia_id = private.agencia_atual()))
  WITH CHECK (pipeline_id IN (SELECT id FROM public.crm_pipelines WHERE agencia_id = private.agencia_atual()));

CREATE POLICY "membros_veem_negocios_sua_agencia"
  ON public.crm_negocios
  FOR ALL
  TO authenticated
  USING (agencia_id = private.agencia_atual())
  WITH CHECK (agencia_id = private.agencia_atual());

CREATE POLICY "membros_veem_atividades_sua_agencia"
  ON public.crm_atividades
  FOR ALL
  TO authenticated
  USING (agencia_id = private.agencia_atual())
  WITH CHECK (agencia_id = private.agencia_atual());

CREATE POLICY "membros_veem_tarefas_sua_agencia"
  ON public.crm_tarefas
  FOR ALL
  TO authenticated
  USING (agencia_id = private.agencia_atual())
  WITH CHECK (agencia_id = private.agencia_atual());
