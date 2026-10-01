-- Ficha do contato por conta do Instagram — parte B (contract), aplicada DEPOIS do
-- deploy do código que faz upsert com onConflict 'instagram_user_id,instagram_id'.
-- Antes disso, o código antigo ainda depende de instagram_id ser único sozinho.

-- 1. As tabelas filhas deixam de apontar só pra pessoa (instagram_id)...
alter table public.messages drop constraint if exists messages_contact_id_fkey;
alter table public.queue drop constraint if exists queue_contact_id_fkey;
alter table public.analytics_events drop constraint if exists analytics_events_contact_id_fkey;
alter table public.followups drop constraint if exists followups_contact_id_fkey;

-- 2. ...a chave primária passa a ser o `id` (instagram_id deixa de ser único sozinho)...
alter table public.contacts drop constraint contacts_pkey;
alter table public.contacts add constraint contacts_pkey primary key (id);

-- 3. ...e passam a apontar pro par (conta, pessoa). Apagar a ficha de uma conta
-- (ex: "EXCLUIR MEUS DADOS") só leva junto o histórico daquela conta.
alter table public.messages
  add constraint messages_contact_fkey foreign key (instagram_user_id, contact_id)
  references public.contacts (instagram_user_id, instagram_id) on delete cascade;
alter table public.queue
  add constraint queue_contact_fkey foreign key (instagram_user_id, contact_id)
  references public.contacts (instagram_user_id, instagram_id) on delete cascade;
alter table public.analytics_events
  add constraint analytics_events_contact_fkey foreign key (instagram_user_id, contact_id)
  references public.contacts (instagram_user_id, instagram_id) on delete cascade;
alter table public.followups
  add constraint followups_contact_fkey foreign key (instagram_user_id, contact_id)
  references public.contacts (instagram_user_id, instagram_id) on delete cascade;

-- Índices pras FKs compostas (cascade e joins por conta + pessoa).
create index if not exists idx_messages_conta_contato on public.messages (instagram_user_id, contact_id);
create index if not exists idx_queue_conta_contato on public.queue (instagram_user_id, contact_id);
create index if not exists idx_analytics_events_conta_contato on public.analytics_events (instagram_user_id, contact_id);
