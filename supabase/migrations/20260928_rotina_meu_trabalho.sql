-- Rotina 2.0 — "Meu trabalho": Kanban pessoal que junta tarefas e demandas da esteira.
--
-- Compatível com o código antigo: 'pendente' continua aceito no check e é
-- tratado como 'a_fazer' pela aplicação. Nenhum dado existente é reescrito.

-- 1. Novos status do Kanban pessoal
alter table public.tarefas drop constraint if exists tarefas_status_check;
alter table public.tarefas
  add constraint tarefas_status_check
  check (status in ('pendente', 'a_fazer', 'fazendo', 'aguardando', 'concluido'));
alter table public.tarefas alter column status set default 'a_fazer';

-- 2. Tipo da tarefa
--    interno     → trabalho da agência (financeiro, prospecção, processo)
--    peca_avulsa → flyer, capa de Facebook, banner… de cliente ou de alguém de fora
--    sub_tarefa  → passo de uma demanda da esteira (pedir fotos, ajustar legenda)
alter table public.tarefas
  add column if not exists tipo text not null default 'interno';
alter table public.tarefas drop constraint if exists tarefas_tipo_check;
alter table public.tarefas
  add constraint tarefas_tipo_check
  check (tipo in ('interno', 'peca_avulsa', 'sub_tarefa'));

alter table public.tarefas
  add column if not exists demanda_id uuid references public.conteudo_items (id) on delete cascade,
  add column if not exists solicitante text,
  add column if not exists aguardando_de text,
  add column if not exists estimativa_min integer check (estimativa_min is null or estimativa_min >= 0),
  add column if not exists ordem integer not null default 0,
  add column if not exists origem text not null default 'manual',
  add column if not exists iniciado_em timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();

create index if not exists tarefas_demanda_id_idx on public.tarefas (demanda_id);
create index if not exists tarefas_status_idx on public.tarefas (agencia_id, status);
