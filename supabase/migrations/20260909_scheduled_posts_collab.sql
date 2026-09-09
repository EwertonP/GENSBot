-- Publicações 2.0 (PLANO_REDESIGN_2.0.md Parte 5): carrossel, colaboradores
-- e marcações de pessoas. Colunas aditivas — nada do que já está em
-- produção (media_url/media_type continuam obrigatórios pro item único)
-- muda de comportamento.

-- media_urls: array de URLs quando a publicação é um carrossel (media_type
-- = 'CAROUSEL'). media_url continua guardando o primeiro item, usado como
-- thumbnail na lista — não duplicamos lógica de exibição pra isso.
alter table scheduled_posts add column if not exists media_urls jsonb;

-- collaborators: array de usernames (Post/Reels/Carrossel) — a Graph API
-- exige que cada um aprove a marcação dentro do próprio Instagram.
alter table scheduled_posts add column if not exists collaborators jsonb;

-- user_tags: array de { username } (Story: só marca, sem posição x/y —
-- a Graph API não suporta link/localização/enquete em sticker de Story).
alter table scheduled_posts add column if not exists user_tags jsonb;
