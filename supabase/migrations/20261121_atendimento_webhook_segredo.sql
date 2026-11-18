-- Segredo do webhook do OpenWA por cliente (etapa 4d). Aditiva e idempotente.
-- Antes valia um segredo único (OPENWA_WEBHOOK_SECRET) copiado em cada OpenWA: quem o tivesse
-- em um OpenWA podia forjar mensagens de qualquer sessão. Agora cada cliente tem o seu,
-- guardado cifrado; sessões antigas (sem segredo próprio) continuam com o global.
-- A tabela já não tem política de RLS: só o servidor lê.
alter table public.atendimento_config add column if not exists openwa_webhook_secret_cifrado text;
