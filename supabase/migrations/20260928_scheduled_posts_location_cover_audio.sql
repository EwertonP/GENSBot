-- Adiciona suporte a Localização, Capa de Reels e Trilha Sonora em scheduled_posts e conteudo_items
alter table public.scheduled_posts
  add column if not exists cover_url text,
  add column if not exists location_id text,
  add column if not exists location_name text,
  add column if not exists audio_name text;

comment on column public.scheduled_posts.cover_url is 'URL pública da imagem de capa customizada (Reels/Vídeo)';
comment on column public.scheduled_posts.location_id is 'ID do local (Facebook Page ID) para marcação na Graph API';
comment on column public.scheduled_posts.location_name is 'Nome legível da localização (ex: Recife, PE)';
comment on column public.scheduled_posts.audio_name is 'Nome da faixa musical ou áudio selecionado';

alter table public.conteudo_items
  add column if not exists cover_url text,
  add column if not exists location_id text,
  add column if not exists location_name text,
  add column if not exists audio_name text;
