-- Módulo de Tarefas de Rotina (TELAS_GENSBOT_2.0.md §5.3)
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  responsavel_id uuid references public.membros (id) on delete set null,
  titulo text not null,
  descricao text,
  status text not null default 'pendente' check (status in ('pendente', 'concluido')),
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  prazo date,
  concluido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists tarefas_agencia_id_idx on public.tarefas (agencia_id);
create index if not exists tarefas_responsavel_id_idx on public.tarefas (responsavel_id);

alter table public.tarefas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'tarefas' and policyname = 'tarefas_leitura'
  ) then
    create policy tarefas_leitura on public.tarefas
      for select using (agencia_id = private.agencia_atual());
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'tarefas' and policyname = 'tarefas_escrita'
  ) then
    create policy tarefas_escrita on public.tarefas
      for all using (agencia_id = private.agencia_atual())
      with check (agencia_id = private.agencia_atual());
  end if;
end $$;

-- Token para aprovação pública da grade completa do feed do mês (TELAS_GENSBOT_2.0.md §3.6)
alter table public.clientes
  add column if not exists token_aprovacao_mes uuid default gen_random_uuid();
