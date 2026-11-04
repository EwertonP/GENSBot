-- Migração: Sistema Multi-Plataforma (Instagram, Threads, TikTok)
-- Cria tabelas para suporte a múltiplas redes por cliente e rastreamento de publicações multi-canal.

-- 1. Contas de Redes Sociais Conectadas por Cliente
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'tiktok')),
  account_id TEXT NOT NULL,          -- instagram_user_id, threads_user_id ou open_id do TikTok
  username TEXT,                     -- @handle na plataforma
  display_name TEXT,
  profile_picture_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb, -- Configurações específicas (ex: opções de privacidade do criador no TikTok)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_cliente ON social_accounts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

-- 2. Registro de Publicações Multi-Canal (Cross-Posting)
CREATE TABLE IF NOT EXISTS post_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_item_id UUID REFERENCES conteudo_items(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'tiktok')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  permalink TEXT,
  error_message TEXT,
  warnings TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_publications_item ON post_publications(conteudo_item_id);
CREATE INDEX IF NOT EXISTS idx_post_publications_status ON post_publications(status);

-- 3. Políticas de Segurança (Row Level Security)
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_publications ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados da agência podem visualizar e gerenciar contas sociais
CREATE POLICY "Membros da agência acessam social_accounts"
  ON social_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Membros da agência acessam post_publications"
  ON post_publications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
