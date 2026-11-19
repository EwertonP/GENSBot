-- Contas do Threads/TikTok conectadas pelo link de onboarding e histórico de publicações por rede.
-- Só o servidor (service role) lê e escreve: tokens aqui; RLS ligado e sem policies.
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  platform text not null check (platform in ('instagram','threads','tiktok')),
  account_id text not null,
  username text,
  display_name text,
  profile_picture_url text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, platform, account_id)
);
create index if not exists social_accounts_cliente_idx on public.social_accounts(cliente_id);
create index if not exists social_accounts_platform_idx on public.social_accounts(platform);

create table if not exists public.post_publications (
  id uuid primary key default gen_random_uuid(),
  conteudo_item_id uuid references public.conteudo_items(id),
  social_account_id uuid references public.social_accounts(id) on delete set null,
  platform text not null,
  status text not null check (status in ('scheduled','publishing','published','failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  permalink text,
  error_message text,
  warnings text[],
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists post_publications_item_idx on public.post_publications(conteudo_item_id);
create index if not exists post_publications_status_idx on public.post_publications(status);

alter table public.social_accounts enable row level security;
alter table public.post_publications enable row level security;
