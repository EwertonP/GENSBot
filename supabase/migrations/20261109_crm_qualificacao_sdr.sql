-- Migration: 20261109_crm_qualificacao_sdr.sql
-- Adiciona campos de Qualificação ICP 360, Auditoria Técnica e Agendamento de Follow-up ao CRM

-- 1. Novos atributos na tabela crm_negocios
ALTER TABLE public.crm_negocios
  ADD COLUMN IF NOT EXISTS tipo_perfil text CHECK (tipo_perfil IN ('profissional', 'empresa')),
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS nicho text,
  ADD COLUMN IF NOT EXISTS dor_principal text,
  ADD COLUMN IF NOT EXISTS url_site text,
  ADD COLUMN IF NOT EXISTS score_qualificacao numeric(3,1) CHECK (score_qualificacao >= 0 AND score_qualificacao <= 10),
  ADD COLUMN IF NOT EXISTS data_proximo_followup timestamptz;

-- 2. Índices de alta performance para rotinas autônomas e filtros
CREATE INDEX IF NOT EXISTS idx_crm_negocios_followup_pendente
  ON public.crm_negocios (agencia_id, data_proximo_followup)
  WHERE status = 'aberto';

CREATE INDEX IF NOT EXISTS idx_crm_negocios_score
  ON public.crm_negocios (agencia_id, score_qualificacao DESC);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_cidade_nicho
  ON public.crm_negocios (agencia_id, cidade, nicho);
