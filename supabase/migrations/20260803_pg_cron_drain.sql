-- ============================================================
-- GENSBot: drain periódico da fila via pg_cron (independe do
-- plano da Vercel, cujo cron nativo no Hobby só roda 1x/dia).
--
-- ANTES DE RODAR: substitua os dois placeholders abaixo:
--   1. https://SEU-DOMINIO.vercel.app  -> URL de produção do app
--   2. SEU_CRON_SECRET_AQUI            -> mesmo valor da env var
--                                          CRON_SECRET na Vercel
-- Execute no SQL Editor do Supabase Dashboard.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove agendamento anterior, se existir, para permitir re-execução idempotente
select cron.unschedule(jobid)
from cron.job
where jobname = 'gensbot-drain-queue';

select cron.schedule(
  'gensbot-drain-queue',
  '* * * * *', -- a cada minuto
  $$
  select net.http_post(
    url := 'https://SEU-DOMINIO.vercel.app/api/cron/drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET_AQUI'
    ),
    body := '{}'::jsonb
  );
  $$
);
