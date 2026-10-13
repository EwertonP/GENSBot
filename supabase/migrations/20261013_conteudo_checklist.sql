-- Adiciona suporte a checklist interativo na esteira de demandas
-- Estrutura: Array de { id: string, texto: string, concluido: boolean }
alter table public.conteudo_items
  add column if not exists checklist jsonb not null default '[]'::jsonb;

comment on column public.conteudo_items.checklist is
  'Checklist interativo da demanda (ex: Roteiro validado, Gravação feita, Arte finalizada).';
