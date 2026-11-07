-- Suporte a arquivamento de demandas
alter table public.conteudo_items add column if not exists arquivada_em timestamptz;

-- Modelos de legendas padrão por cliente
create table if not exists public.legendas_padrao (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists legendas_padrao_cliente_idx
  on public.legendas_padrao (cliente_id);

alter table public.legendas_padrao enable row level security;

drop policy if exists legendas_padrao_tenant on public.legendas_padrao;
create policy legendas_padrao_tenant on public.legendas_padrao
  for all using (agencia_id = private.agencia_atual());
