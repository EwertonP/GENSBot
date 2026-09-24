-- ============================================================
-- GENSBot: Configuração completa de Crons no Supabase (pg_cron + pg_net)
-- Substitui dependência de Crons da Vercel (que tem limite restrito no plano Hobby).
--
-- Domínio de Produção: https://allingens.vercel.app
-- Jobs configurados:
--   1. gensbot-publish-scheduled  -> A cada minuto (* * * * *)
--   2. gensbot-drain-queue        -> A cada minuto (* * * * *)
--   3. gensbot-refresh-token      -> Diariamente às 03:00 UTC (0 3 * * *)
--   4. gensbot-notion-sync        -> Diariamente às 12:00 UTC (0 12 * * *)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. Publicador de Posts Agendados (a cada minuto)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'gensbot-publish-scheduled';

SELECT cron.schedule(
  'gensbot-publish-scheduled',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://allingens.vercel.app/api/cron/publish-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 8f3a1c9e7b2d4f6a0c5e8b1d3f7a9c2e5b8d0f4a6c1e9b3d7f2a5c8e0b4d6f9a'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. Drenador da Fila de Mensagens / Webhook (a cada minuto)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'gensbot-drain-queue';

SELECT cron.schedule(
  'gensbot-drain-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://allingens.vercel.app/api/cron/drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 8f3a1c9e7b2d4f6a0c5e8b1d3f7a9c2e5b8d0f4a6c1e9b3d7f2a5c8e0b4d6f9a'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Renovação de Tokens do Instagram & Foto de Perfil (diário às 03:00 UTC)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'gensbot-refresh-token';

SELECT cron.schedule(
  'gensbot-refresh-token',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://allingens.vercel.app/api/cron/refresh-token',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 8f3a1c9e7b2d4f6a0c5e8b1d3f7a9c2e5b8d0f4a6c1e9b3d7f2a5c8e0b4d6f9a'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. Sincronização de Demandas do Notion (diário às 12:00 UTC / 09:00 BRT)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'gensbot-notion-sync';

SELECT cron.schedule(
  'gensbot-notion-sync',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://allingens.vercel.app/api/cron/notion-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 8f3a1c9e7b2d4f6a0c5e8b1d3f7a9c2e5b8d0f4a6c1e9b3d7f2a5c8e0b4d6f9a'
    ),
    body := '{}'::jsonb
  );
  $$
);
