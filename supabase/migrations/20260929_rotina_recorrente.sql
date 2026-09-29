-- Rotina — Onda B: tarefas recorrentes.
--
-- Uma regra (tarefas_recorrentes) gera uma tarefa comum em `tarefas` em cada dia
-- que bate com ela. A geração roda no próprio banco (pg_cron, todo dia às 03:00
-- de Brasília) e é idempotente: (recorrencia_id, data_ocorrencia) é único.

create table if not exists public.tarefas_recorrentes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo text not null default 'interno' check (tipo in ('interno', 'peca_avulsa')),
  cliente_id uuid references public.clientes (id) on delete set null,
  solicitante text,
  responsavel_id uuid references public.membros (id) on delete set null,
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  estimativa_min integer check (estimativa_min is null or estimativa_min > 0),
  -- semanal: dias_semana (0=domingo … 6=sábado). mensal: dia_mes (1–31; em mês curto cai no último dia).
  frequencia text not null check (frequencia in ('semanal', 'mensal')),
  dias_semana smallint[] not null default '{}',
  dia_mes smallint check (dia_mes between 1 and 31),
  -- Prazo da tarefa gerada = dia da ocorrência + prazo_dias.
  prazo_dias smallint not null default 0 check (prazo_dias between 0 and 60),
  inicio_em date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ativo boolean not null default true,
  ultima_geracao date,
  criado_por uuid references public.membros (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint tarefas_recorrentes_regra_valida check (
    (frequencia = 'semanal' and cardinality(dias_semana) > 0)
    or (frequencia = 'mensal' and dia_mes is not null)
  )
);

create index if not exists tarefas_recorrentes_agencia_idx on public.tarefas_recorrentes (agencia_id) where ativo;

alter table public.tarefas
  add column if not exists recorrencia_id uuid references public.tarefas_recorrentes (id) on delete set null,
  add column if not exists data_ocorrencia date;

create unique index if not exists tarefas_recorrencia_ocorrencia_uidx
  on public.tarefas (recorrencia_id, data_ocorrencia)
  where recorrencia_id is not null;

alter table public.tarefas_recorrentes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'tarefas_recorrentes' and policyname = 'tarefas_recorrentes_agencia') then
    create policy tarefas_recorrentes_agencia on public.tarefas_recorrentes
      for all using (agencia_id = private.agencia_atual())
      with check (agencia_id = private.agencia_atual());
  end if;
end $$;

-- A regra bate com o dia? (mesma lógica de src/lib/rotina-recorrencia.ts)
create or replace function private.recorrencia_ocorre_em(r public.tarefas_recorrentes, p_dia date)
returns boolean
language sql
immutable
as $$
  select p_dia >= r.inicio_em and case r.frequencia
    when 'semanal' then extract(dow from p_dia)::smallint = any (r.dias_semana)
    when 'mensal' then extract(day from p_dia)::int = least(
      r.dia_mes::int,
      extract(day from (date_trunc('month', p_dia) + interval '1 month - 1 day'))::int
    )
    else false
  end;
$$;

-- Gera as tarefas do dia para todas as regras ativas. Retorna quantas criou.
create or replace function private.gerar_tarefas_recorrentes(
  p_dia date default (now() at time zone 'America/Sao_Paulo')::date
)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  criadas integer;
begin
  with novas as (
    insert into public.tarefas (
      agencia_id, cliente_id, responsavel_id, tipo, titulo, descricao, solicitante,
      status, prioridade, prazo, estimativa_min, origem, recorrencia_id, data_ocorrencia
    )
    select
      r.agencia_id, r.cliente_id, r.responsavel_id, r.tipo, r.titulo, r.descricao, r.solicitante,
      'a_fazer', r.prioridade, p_dia + r.prazo_dias, r.estimativa_min, 'recorrente', r.id, p_dia
    from public.tarefas_recorrentes r
    where r.ativo and private.recorrencia_ocorre_em(r, p_dia)
    on conflict (recorrencia_id, data_ocorrencia) where recorrencia_id is not null do nothing
    returning recorrencia_id
  )
  select count(*) into criadas from novas;

  update public.tarefas_recorrentes r
     set ultima_geracao = p_dia
   where r.ativo and private.recorrencia_ocorre_em(r, p_dia);

  return criadas;
end;
$$;

revoke all on function private.gerar_tarefas_recorrentes(date) from public, anon, authenticated;

-- Agenda: todo dia 06:00 UTC = 03:00 em Brasília.
select cron.unschedule(jobid) from cron.job where jobname = 'gensbot-rotina-recorrente';
select cron.schedule('gensbot-rotina-recorrente', '0 6 * * *', $$ select private.gerar_tarefas_recorrentes(); $$);
