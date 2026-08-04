-- Deduplicação de alertas por e-mail: guarda quando cada alerta especifico
-- (por conta, por automacao, etc.) foi notificado por ultimo, pra nao
-- mandar o mesmo aviso todo dia.
create table if not exists alert_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  alert_key text not null,
  last_sent_at timestamp with time zone not null default now(),
  unique(user_id, alert_key)
);

alter table alert_notifications enable row level security;
