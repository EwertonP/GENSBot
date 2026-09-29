-- Demanda com mais de um responsável.
--
-- `responsavel_id` continua sendo o responsável principal (aparece primeiro,
-- recebe padrões como a Rotina). `co_responsaveis_ids` guarda as demais
-- pessoas que também respondem pela demanda. Aditivo: nada existente muda.

alter table public.conteudo_items
  add column if not exists co_responsaveis_ids uuid[] not null default '{}';

create index if not exists conteudo_items_co_responsaveis_idx
  on public.conteudo_items using gin (co_responsaveis_ids);

comment on column public.conteudo_items.co_responsaveis_ids is
  'Membros que dividem a responsabilidade pela demanda, além de responsavel_id.';
