-- Liga a tarefa automática à reserva da agenda que a gerou (aditiva e idempotente).
-- Evita achar a tarefa pelo texto do título, que a equipe pode editar.
--   uid da reserva          -> tarefa de confirmar presença
--   'remarcar:' + uid       -> tarefa de remarcar uma consulta que caiu
alter table public.crm_tarefas add column if not exists reserva_uid text;
create index if not exists idx_crm_tarefas_reserva
  on public.crm_tarefas (agencia_id, reserva_uid)
  where reserva_uid is not null;
