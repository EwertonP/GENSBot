-- Adiciona campos de rastreamento do Notion nas tabelas de clientes e esteira de conteúdo

alter table public.clientes
  add column if not exists notion_database_id text,
  add column if not exists notion_page_id text;

alter table public.conteudo_items
  add column if not exists notion_page_id text unique,
  add column if not exists notion_last_edited timestamptz,
  add column if not exists briefing text;

create index if not exists clientes_notion_database_id_idx on public.clientes (notion_database_id);
create index if not exists conteudo_items_notion_page_id_idx on public.conteudo_items (notion_page_id);
