-- Adiciona a coluna ig_container_id na tabela scheduled_posts para permitir
-- reutilizar o container já criado na Meta e finalizar a publicação instantaneamente
-- assim que a transcodificação do vídeo for concluída.

alter table public.scheduled_posts 
  add column if not exists ig_container_id text;

create index if not exists idx_scheduled_posts_container 
  on public.scheduled_posts (ig_container_id) 
  where ig_container_id is not null;
