-- Responsável pelo post agendado/publicado (conta como entrega na produtividade
-- quando o post não nasce de uma demanda). Aditiva e idempotente.
alter table public.scheduled_posts
  add column if not exists responsavel_id uuid references public.membros (id) on delete set null;

create index if not exists idx_scheduled_posts_responsavel on public.scheduled_posts (responsavel_id, published_at);

-- Posts já existentes: quem agendou (user_id) é o responsável, se for membro.
update public.scheduled_posts sp
   set responsavel_id = sp.user_id
 where sp.responsavel_id is null
   and exists (select 1 from public.membros m where m.id = sp.user_id);
