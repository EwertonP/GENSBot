-- Adiciona tags de segmentação livre aos contatos (ex: "cliente", "quente",
-- "ja comprou"), usadas pelo painel de Leads & Público pra filtrar.
alter table contacts add column if not exists tags text[] not null default '{}';

create index if not exists idx_contacts_tags on contacts using gin (tags);
