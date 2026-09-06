-- ============================================================
-- Fix: analytics_events nunca recebeu user_id na migração multi-tenant
-- (20260722_multi_tenant.sql esqueceu esta tabela), então todo
-- `analytics_events.insert({ user_id: ... })` feito pelo código
-- (webhook route, drain) falhava silenciosamente desde sempre —
-- a tabela ficou vazia em produção e métricas como "Leads Gerados"
-- e o ranking de automações no dashboard nunca tiveram dado real.
-- ============================================================

ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_analytics_events" ON analytics_events;
CREATE POLICY "users_see_own_analytics_events" ON analytics_events
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
