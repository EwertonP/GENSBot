-- Central de notificações do app + preferências por pessoa.
-- Só o servidor (service role) lê e escreve; sem policies.
create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tipo text not null,
  titulo text not null,
  corpo text not null default '',
  url text,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists idx_notificacoes_user on notificacoes (user_id, criado_em desc);
create index if not exists idx_notificacoes_nao_lidas on notificacoes (user_id) where lida_em is null;
alter table notificacoes enable row level security;

-- Uma linha por pessoa e tipo; sem linha vale o padrão do tipo (ver lib/notificar.ts).
create table if not exists notificacao_preferencias (
  user_id uuid references auth.users(id) on delete cascade not null,
  tipo text not null,
  push boolean not null,
  primary key (user_id, tipo)
);
alter table notificacao_preferencias enable row level security;
