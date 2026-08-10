-- Histórico de links UTM gerados pelo criador de links (ferramenta standalone,
-- sem rastreamento de clique dentro do GENSBot — só monta e guarda a URL).
create table if not exists utm_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  instagram_user_id text,
  name text,
  base_url text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  generated_url text not null,
  created_at timestamptz default now()
);

alter table utm_links enable row level security;
drop policy if exists "users_see_own_utm_links" on utm_links;
create policy "users_see_own_utm_links" on utm_links
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_utm_links_user on utm_links (user_id, created_at desc);
