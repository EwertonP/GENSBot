-- Migration: 20261015_whatsapp_followups_session.sql
-- O cron de follow-up passa a enviar pela sessão que atendeu o lead (e não por um nome
-- derivado do cliente/agência). Follow-ups antigos ficam com NULL e usam só a sessão do
-- cliente ou a geral da agência.
ALTER TABLE public.whatsapp_followups ADD COLUMN IF NOT EXISTS session_name text;
