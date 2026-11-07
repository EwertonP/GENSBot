-- Entregas arquivadas: o registro leve de cada demanda publicada, guardado
-- quando a demanda é excluída pela retenção (ou à mão). Sem texto, legenda nem
-- mídia: só o que a produtividade precisa para contar mês a mês por cliente e
-- por pessoa. Aditiva e idempotente.
create table if not exists public.entregas_arquivadas (
  id uuid primary key, -- mesmo id da demanda excluída
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  tipo text not null default 'post',
  titulo text,
  status text not null default 'publicado',
  concluida boolean not null default true,
  mes_referencia date,
  responsavel_id uuid references public.membros (id) on delete set null,
  co_responsaveis_ids uuid[] not null default '{}',
  scheduled_post_id uuid,
  publicado_em timestamptz,
  criado_em timestamptz,
  arquivado_em timestamptz not null default now()
);

create index if not exists idx_entregas_arq_agencia_mes on public.entregas_arquivadas (agencia_id, mes_referencia);
create index if not exists idx_entregas_arq_cliente on public.entregas_arquivadas (cliente_id, mes_referencia);
create index if not exists idx_entregas_arq_post on public.entregas_arquivadas (scheduled_post_id);

alter table public.entregas_arquivadas enable row level security;
drop policy if exists "entregas_arquivadas_agencia_policy" on public.entregas_arquivadas;
create policy "entregas_arquivadas_agencia_policy" on public.entregas_arquivadas
  for all using (agencia_id = private.agencia_atual());
