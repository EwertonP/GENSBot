-- Migration: 20261015_0_whatsapp_schema_rls.sql
-- Traz para o repositório o que o código já usa (sessão por membro e a tabela de follow-ups)
-- e liga RLS nas tabelas do WhatsApp. Idempotente: pode rodar em banco que já tem as peças.
-- O prefixo "0" faz esta rodar antes de 20261015_whatsapp_followups_session.sql.

-- 1. Sessão por membro + nome de sessão único (o upsert do código usa onConflict: session_name)
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS membro_id uuid REFERENCES public.membros(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_membro ON public.whatsapp_sessions(membro_id);
-- Falha se houver nomes duplicados: nesse caso apague as sessões repetidas antes de rodar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_sessions_session_name ON public.whatsapp_sessions(session_name);

-- 2. Régua de follow-up
CREATE TABLE IF NOT EXISTS public.whatsapp_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_name text,
  telefone text NOT NULL,
  nome_contato text,
  etapa integer NOT NULL,
  mensagem text NOT NULL,
  agendado_para timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_followups_fila ON public.whatsapp_followups(status, agendado_para);
CREATE INDEX IF NOT EXISTS idx_whatsapp_followups_lead ON public.whatsapp_followups(agencia_id, telefone);

-- 3. RLS: sem policy para anon/authenticated = ninguém lê pelo navegador. Todo acesso passa
-- pelas rotas de API (service role, que ignora RLS), que fazem o próprio controle de acesso.
-- Estas tabelas guardam conversas de pacientes e o QR code das sessões.
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ia_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_membro_whatsapp_grupos ENABLE ROW LEVEL SECURITY;

-- 4. getContextoAgencia deixou de ativar/promover contas sozinho: garante que o dono continue
-- com acesso.
UPDATE public.membros
SET ativo = true, papel = 'master'
WHERE id = '62bdb1bc-84de-4688-a560-7a4deb75a2be';
