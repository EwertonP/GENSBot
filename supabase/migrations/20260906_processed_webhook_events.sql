-- ============================================================
-- Deduplicação de webhooks: a Meta reenvia entregas quando não
-- recebe 200 rápido o suficiente (comum em cold start da Vercel).
-- Sem isso, uma redelivery reprocessa o mesmo comentário/mensagem
-- e pode disparar a mesma automação (e o mesmo DM) duas vezes.
-- ============================================================

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice pra permitir uma limpeza periódica de eventos antigos (não é
-- feita automaticamente ainda, mas a tabela cresce um registro por
-- comentário/mensagem recebida, então vale ter isso pronto).
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_created_at ON processed_webhook_events (created_at);
