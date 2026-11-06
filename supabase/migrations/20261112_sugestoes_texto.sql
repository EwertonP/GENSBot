-- Sugestões de texto da cliente (link do mês, fase 2)
-- Aditiva e idempotente. Acesso só pelo service role (RLS ligado, sem policies).

create table if not exists public.conteudo_sugestoes_texto (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  item_id uuid not null references public.conteudo_items (id) on delete cascade,
  campo text not null check (campo in ('titulo', 'briefing', 'legenda')),
  texto_original text,
  texto_proposto text not null,
  autor text,
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references public.membros (id) on delete set null
);

-- Uma sugestão pendente por campo e demanda: a cliente reenviando substitui a anterior.
create unique index if not exists uq_sugestoes_texto_pendente
  on public.conteudo_sugestoes_texto (item_id, campo) where status = 'pendente';

create index if not exists idx_sugestoes_texto_item on public.conteudo_sugestoes_texto (item_id, criado_em desc);

alter table public.conteudo_sugestoes_texto enable row level security;
