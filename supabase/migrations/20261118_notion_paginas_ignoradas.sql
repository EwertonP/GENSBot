-- Páginas do Notion que não devem voltar como demanda: quando uma demanda
-- importada do Notion é excluída no GENSBot, a página fica aqui e a
-- sincronização diária deixa de recriá-la. Aditiva e idempotente.
create table if not exists public.notion_paginas_ignoradas (
  notion_page_id text primary key,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  titulo text,
  ignorada_em timestamptz not null default now()
);

create index if not exists idx_notion_ignoradas_agencia on public.notion_paginas_ignoradas (agencia_id);

alter table public.notion_paginas_ignoradas enable row level security;
drop policy if exists "notion_ignoradas_agencia_policy" on public.notion_paginas_ignoradas;
create policy "notion_ignoradas_agencia_policy" on public.notion_paginas_ignoradas
  for all using (agencia_id = private.agencia_atual());
