-- Migration: 20261013_cliente_membro_whatsapp_grupos.sql
-- Grupos de WhatsApp configurados individualmente por cada membro da agência para cada cliente.
-- Garante que cada designer/sócio tenha seu próprio grupo associado à sua sessão pessoal de WhatsApp.

CREATE TABLE IF NOT EXISTS public.cliente_membro_whatsapp_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  whatsapp_grupo_id text NOT NULL,
  notificar_agendamento boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, membro_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_membro_wpp_grupos_cli_mem ON public.cliente_membro_whatsapp_grupos(cliente_id, membro_id);

-- Migra grupos já configurados nos clientes para a sessão existente do sócio Ewerton
INSERT INTO public.cliente_membro_whatsapp_grupos (cliente_id, membro_id, whatsapp_grupo_id, notificar_agendamento)
SELECT id, '62bdb1bc-84de-4688-a560-7a4deb75a2be'::uuid, whatsapp_grupo_id, COALESCE(whatsapp_notificar_agendamento, true)
FROM public.clientes
WHERE whatsapp_grupo_id IS NOT NULL AND whatsapp_grupo_id <> ''
ON CONFLICT (cliente_id, membro_id) DO NOTHING;
