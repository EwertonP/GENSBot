-- Adiciona token público de aprovação e histórico de comentários por slide/timecode
-- Puramente aditivo: não altera nem apaga dados existentes.

alter table public.conteudo_items
  add column if not exists token_aprovacao uuid not null default gen_random_uuid() unique,
  add column if not exists comentarios_revisao jsonb not null default '[]'::jsonb;

create index if not exists conteudo_items_token_aprovacao_idx
  on public.conteudo_items (token_aprovacao);

comment on column public.conteudo_items.token_aprovacao is
  'Token exclusivo e seguro para o link público de aprovação do cliente (sem exigir login).';

comment on column public.conteudo_items.comentarios_revisao is
  'Histórico de feedbacks com suporte a slide_index (carrossel) e timestamp_seconds (vídeo/reels).';
