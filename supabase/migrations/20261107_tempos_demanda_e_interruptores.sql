-- Migration: tempos_demanda e interruptores do cliente / conclusao na demanda
-- Aditiva e idempotente

alter table public.conteudo_items
  add column if not exists tempo_estimado_minutos integer default null,
  add column if not exists visivel_cliente boolean not null default true,
  add column if not exists pedido_informacao text default null,
  add column if not exists resposta_informacao text default null,
  add column if not exists concluida boolean not null default false;

create table if not exists public.tempos_demanda (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  demanda_id uuid not null references public.conteudo_items (id) on delete cascade,
  membro_id uuid references public.membros (id) on delete set null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  segundos integer default 0,
  descricao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_tempos_demanda_demanda on public.tempos_demanda (demanda_id);
create index if not exists idx_tempos_demanda_membro on public.tempos_demanda (membro_id);
create index if not exists idx_tempos_demanda_agencia on public.tempos_demanda (agencia_id);

alter table public.tempos_demanda enable row level security;

drop policy if exists "tempos_demanda_mesma_agencia" on public.tempos_demanda;
create policy "tempos_demanda_mesma_agencia" on public.tempos_demanda
  for all using (agencia_id = private.agencia_atual());
