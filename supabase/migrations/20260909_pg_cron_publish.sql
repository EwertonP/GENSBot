-- ============================================================
-- GENSBot: agenda periódica (pg_cron) pra publicar posts/reels/
-- stories agendados em scheduled_posts. Mesmo padrão de
-- 20260803_pg_cron_drain.sql, independente do plano da Vercel.
--
-- ANTES DE RODAR: substitua os dois placeholders abaixo:
--   1. https://SEU-DOMINIO.vercel.app  -> URL de produção do app
--   2. SEU_CRON_SECRET_AQUI            -> mesmo valor da env var
--                                          CRON_SECRET na Vercel
-- Execute no SQL Editor do Supabase Dashboard.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'gensbot-publish-scheduled';

select cron.schedule(
  'gensbot-publish-scheduled',
  '* * * * *', -- a cada minuto
  $$
  select net.http_post(
    url := 'https://SEU-DOMINIO.vercel.app/api/cron/publish-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET_AQUI'
    ),
    body := '{}'::jsonb
  );
  $$
);
