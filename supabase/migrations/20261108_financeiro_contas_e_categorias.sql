-- Financeiro rodada 2: Contas bancárias, transferências, categorias editáveis com metas e despesas recorrentes
-- Aditiva e idempotente

create table if not exists public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null,
  tipo text not null default 'corrente' check (tipo in ('corrente', 'investimento', 'caixa', 'poupanca')),
  saldo_inicial numeric(12, 2) not null default 0,
  cor text default '#10b981',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_contas_agencia on public.contas_bancarias (agencia_id);

alter table public.contas_bancarias enable row level security;
drop policy if exists "contas_agencia_policy" on public.contas_bancarias;
create policy "contas_agencia_policy" on public.contas_bancarias
  for all using (agencia_id = private.agencia_atual());

-- Categorias com metas mensais
create table if not exists public.categorias_financeiro (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa')),
  nome text not null,
  cor text default '#6b7280',
  meta_mensal numeric(12, 2) default 0,
  criado_em timestamptz not null default now()
);

create index if not exists idx_categorias_agencia on public.categorias_financeiro (agencia_id);

alter table public.categorias_financeiro enable row level security;
drop policy if exists "categorias_agencia_policy" on public.categorias_financeiro;
create policy "categorias_agencia_policy" on public.categorias_financeiro
  for all using (agencia_id = private.agencia_atual());

-- Alter table lancamentos (aditivo)
alter table public.lancamentos
  add column if not exists conta_id uuid references public.contas_bancarias (id) on delete set null,
  add column if not exists recorrente boolean not null default false,
  add column if not exists recorrencia_periodo text default 'mensal';

-- Transferências entre contas
create table if not exists public.transferencias_contas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  conta_origem_id uuid not null references public.contas_bancarias (id) on delete cascade,
  conta_destino_id uuid not null references public.contas_bancarias (id) on delete cascade,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  descricao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_transferencias_agencia on public.transferencias_contas (agencia_id);

alter table public.transferencias_contas enable row level security;
drop policy if exists "transferencias_agencia_policy" on public.transferencias_contas;
create policy "transferencias_agencia_policy" on public.transferencias_contas
  for all using (agencia_id = private.agencia_atual());
