-- ============================================================
-- GENSBot Multi-Tenant Migration
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Habilitar extensão pgcrypto para UUIDs (se ainda não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criar tabela de contas do Instagram (multi-conta por usuário)
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instagram_user_id TEXT NOT NULL,
  instagram_username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instagram_user_id)
);

-- 3. Atualizar tabela `config` para suportar multi-tenant
ALTER TABLE config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE config ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

-- 4. Atualizar tabela `automations`
ALTER TABLE automations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

-- 5. Atualizar tabela `contacts`
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

-- 6. Atualizar tabela `queue`
ALTER TABLE queue ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

-- 7. Atualizar tabela `events`
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

-- ============================================================
-- Row Level Security (RLS)
-- Cada usuário vê APENAS seus próprios dados
-- ============================================================

-- instagram_accounts
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_accounts" ON instagram_accounts;
CREATE POLICY "users_see_own_accounts" ON instagram_accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- config
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_config" ON config;
CREATE POLICY "users_see_own_config" ON config
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- automations
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_automations" ON automations;
CREATE POLICY "users_see_own_automations" ON automations
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_contacts" ON contacts;
CREATE POLICY "users_see_own_contacts" ON contacts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- queue
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_queue" ON queue;
CREATE POLICY "users_see_own_queue" ON queue
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_events" ON events;
CREATE POLICY "users_see_own_events" ON events
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTA IMPORTANTE: As APIs do backend usam a Service Role Key
-- que bypassa o RLS automaticamente. O RLS protege APENAS
-- acesso direto ao banco (ex: via SDK no cliente).
-- A segurança multi-tenant no backend é garantida filtrando
-- por instagram_user_id + user_id em cada query da API.
-- ============================================================
