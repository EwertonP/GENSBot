-- Migration: 20261012_membros_cliente_portal.sql
-- Acesso do Cliente / Secretária com isolamento no CRM e novas origens de leads presenciais/telefone

-- 1. Permite papel 'cliente' na tabela membros e adiciona referência de cliente_id
ALTER TABLE public.membros DROP CONSTRAINT IF EXISTS membros_papel_check;
ALTER TABLE public.membros ADD CONSTRAINT membros_papel_check 
  CHECK (papel IN ('master', 'membro', 'cliente'));

ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_membros_cliente_id ON public.membros(cliente_id);

-- 2. Expande origens permitidas em crm_negocios para suportar recepção, telefone, google, site, etc.
ALTER TABLE public.crm_negocios DROP CONSTRAINT IF EXISTS crm_negocios_origem_check;
ALTER TABLE public.crm_negocios ADD CONSTRAINT crm_negocios_origem_check 
  CHECK (origem IN ('manual', 'instagram', 'formulario', 'webhook_ads', 'indicacao', 'outros', 'presencial', 'ligacao', 'google', 'site', 'whatsapp'));
