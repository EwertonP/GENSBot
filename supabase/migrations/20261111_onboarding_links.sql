-- Onboarding de Redes Sociais do Cliente
-- Permite que o cliente conecte Instagram, Threads e TikTok de forma autônoma e segura

create table if not exists public.cliente_onboarding_links (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  token text not null unique,
  instagram_username_informado text,
  threads_username_informado text,
  tiktok_username_informado text,
  convite_instagram_enviado boolean not null default false,
  convite_threads_enviado boolean not null default false,
  instagram_conectado_em timestamptz,
  threads_conectado_em timestamptz,
  tiktok_conectado_em timestamptz,
  concluido_em timestamptz,
  expira_em timestamptz not null default (now() + interval '30 days'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_onboarding_links_token on public.cliente_onboarding_links (token);
create index if not exists idx_onboarding_links_cliente on public.cliente_onboarding_links (cliente_id);
create index if not exists idx_onboarding_links_agencia on public.cliente_onboarding_links (agencia_id);

alter table public.cliente_onboarding_links enable row level security;
drop policy if exists "onboarding_links_agencia_policy" on public.cliente_onboarding_links;
create policy "onboarding_links_agencia_policy" on public.cliente_onboarding_links
  for all using (agencia_id = auth_agencia_id());
