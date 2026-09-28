-- MCP do GENSBot (Onda C1): servidor OAuth 2.1 próprio + auditoria.
-- Tabelas só são lidas/escritas pelo servidor com a service role: RLS ligada e sem policies.

create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  membro_id uuid not null references public.membros (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text,
  resource text,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  access_hash text not null unique,
  refresh_hash text unique,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  membro_id uuid not null references public.membros (id) on delete cascade,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  scope text,
  expira_em timestamptz not null,
  refresh_expira_em timestamptz,
  revogado_em timestamptz,
  ultimo_uso_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists oauth_tokens_membro_idx on public.oauth_tokens (membro_id);

create table if not exists public.mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  membro_id uuid references public.membros (id) on delete set null,
  client_id text,
  ferramenta text not null,
  argumentos jsonb,
  sucesso boolean not null,
  resumo text,
  criado_em timestamptz not null default now()
);
create index if not exists mcp_audit_log_agencia_idx on public.mcp_audit_log (agencia_id, criado_em desc);

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.mcp_audit_log enable row level security;

-- Demandas criadas pelo Claude: origem + scorecard do MetodoViral.
alter table public.conteudo_items
  add column if not exists origem text not null default 'manual',
  add column if not exists avaliacao jsonb;
