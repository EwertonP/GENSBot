-- Inscrições de notificação push (PWA). Um aparelho/navegador = uma linha.
-- O endpoint é único no mundo; se a mesma pessoa reinscrever, atualiza.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);

-- Sem policies: só a service role (as rotas do servidor) lê e escreve.
alter table push_subscriptions enable row level security;
