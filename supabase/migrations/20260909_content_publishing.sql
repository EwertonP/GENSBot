-- Publicação de conteúdo no Instagram (posts, reels, stories) direto do
-- GENSBot em nome das contas conectadas, com agendamento próprio (a Graph
-- API não tem scheduled_publish_time nativo pra Stories).

-- Bucket público no Supabase Storage: a Graph API exige a mídia como URL
-- pública acessível por ela, não aceita upload binário direto.
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

drop policy if exists "post_media_public_read" on storage.objects;
create policy "post_media_public_read" on storage.objects
  for select using (bucket_id = 'post-media');

-- Tabela: scheduled_posts
-- Guarda tanto publicações imediatas (já criadas com status 'published')
-- quanto agendadas (status 'scheduled', publicadas depois pelo worker de
-- cron) — fonte única pra lista da UI e métricas por post, sem duas
-- tabelas separadas pra unificar depois.
create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  instagram_user_id text not null references instagram_accounts(instagram_user_id) on delete cascade,
  media_type text not null, -- 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES'
  media_url text not null,  -- URL pública no bucket post-media
  caption text,
  scheduled_at timestamptz not null default now(),
  status text not null default 'scheduled', -- 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled'
  ig_media_id text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table scheduled_posts enable row level security;
drop policy if exists "users_see_own_scheduled_posts" on scheduled_posts;
create policy "users_see_own_scheduled_posts" on scheduled_posts
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_scheduled_posts_due on scheduled_posts (status, scheduled_at);
create index if not exists idx_scheduled_posts_user on scheduled_posts (user_id, created_at desc);
create index if not exists idx_scheduled_posts_rate_limit on scheduled_posts (instagram_user_id, status, published_at);
