-- Propostas e Contratos: modelos, propostas comerciais, contratos digitais e assinaturas
-- Aditiva e idempotente

-- 1. Dados cadastrais da Agência como Contratada
alter table public.agencias
  add column if not exists razao_social text,
  add column if not exists endereco text,
  add column if not exists cidade_estado text,
  add column if not exists chave_pix text,
  add column if not exists telefone_contato text,
  add column if not exists email_contato text;

-- 2. Modelos de Documento (Propostas e Contratos)
create table if not exists public.modelos_documento (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid references public.agencias (id) on delete cascade,
  tipo text not null check (tipo in ('proposta', 'contrato')),
  categoria text not null default 'social_media',
  titulo text not null,
  descricao text,
  conteudo_html text not null,
  variaveis jsonb not null default '[]'::jsonb,
  padrao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_modelos_agencia_tipo on public.modelos_documento (agencia_id, tipo);

alter table public.modelos_documento enable row level security;
drop policy if exists "modelos_agencia_policy" on public.modelos_documento;
create policy "modelos_agencia_policy" on public.modelos_documento
  for all using (agencia_id is null or agencia_id = private.agencia_atual());

-- 3. Propostas Comerciais
create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  modelo_id uuid references public.modelos_documento (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  lead_id uuid references public.crm_negocios (id) on delete set null,
  titulo text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'aceita', 'recusada', 'vencida')),
  valor_mensal numeric(12, 2) default 0,
  valor_setup numeric(12, 2) default 0,
  validade date,
  conteudo_html text not null,
  token_publico text not null unique,
  itens jsonb default '[]'::jsonb,
  visualizada_em timestamptz,
  aceita_em timestamptz,
  recusada_em timestamptz,
  motivo_recusa text,
  contrato_gerado_id uuid,
  criado_por uuid references public.membros (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_propostas_agencia on public.propostas (agencia_id);
create index if not exists idx_propostas_token on public.propostas (token_publico);
create index if not exists idx_propostas_cliente on public.propostas (cliente_id);

alter table public.propostas enable row level security;
drop policy if exists "propostas_agencia_policy" on public.propostas;
create policy "propostas_agencia_policy" on public.propostas
  for all using (agencia_id = private.agencia_atual());

-- 4. Contratos
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  proposta_id uuid references public.propostas (id) on delete set null,
  modelo_id uuid references public.modelos_documento (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  lead_id uuid references public.crm_negocios (id) on delete set null,
  titulo text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'aguardando_assinatura', 'assinado', 'cancelado')),
  valor_mensal numeric(12, 2) default 0,
  dia_vencimento smallint check (dia_vencimento between 1 and 31),
  data_inicio date,
  data_termino date,
  renovacao_automatica boolean default true,
  conteudo_html text not null,
  token_publico text not null unique,
  itens jsonb default '[]'::jsonb,
  assinatura_cliente_nome text,
  assinatura_cliente_doc text,
  assinatura_cliente_email text,
  assinatura_cliente_ip text,
  assinatura_cliente_data timestamptz,
  assinatura_cliente_imagem text,
  assinatura_agencia_nome text,
  assinatura_agencia_data timestamptz,
  criado_por uuid references public.membros (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_contratos_agencia on public.contratos (agencia_id);
create index if not exists idx_contratos_token on public.contratos (token_publico);
create index if not exists idx_contratos_cliente on public.contratos (cliente_id);

alter table public.contratos enable row level security;
drop policy if exists "contratos_agencia_policy" on public.contratos;
create policy "contratos_agencia_policy" on public.contratos
  for all using (agencia_id = private.agencia_atual());
