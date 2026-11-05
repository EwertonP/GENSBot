-- Etiquetas coloridas para organizar as demandas (como no Orkestrya).
-- Só o servidor (service role) lê e escreve; sem policies.
create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references agencias(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  cor text not null default 'slate',
  criado_em timestamptz not null default now()
);
create unique index if not exists uq_etiquetas_nome on etiquetas (agencia_id, lower(nome));
alter table etiquetas enable row level security;

-- Etiquetas aplicadas à demanda (ids; apagar a etiqueta não apaga a demanda).
alter table conteudo_items add column if not exists etiquetas_ids uuid[] not null default '{}';
