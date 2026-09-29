-- Aviso não fatal de uma publicação (ex.: a Meta recusou a localização e o post saiu sem ela).
-- Aparece no card da fila; erros de verdade continuam em error_message.
alter table public.scheduled_posts
  add column if not exists aviso text;
