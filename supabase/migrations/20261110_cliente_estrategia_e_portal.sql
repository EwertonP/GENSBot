-- Cliente e Portal: Central Estratégica, tokens públicos do portal/estratégia, fotos em dois temas e regras de aprovação
-- Aditiva e idempotente

alter table public.clientes
  add column if not exists persona text,
  add column if not exists raio_x text,
  add column if not exists posicionamento text,
  add column if not exists tom_de_voz text,
  add column if not exists paleta_cores jsonb default '[]'::jsonb,
  add column if not exists foto_url_dark text,
  add column if not exists cor_capa text default '#192313',
  add column if not exists token_estrategia text unique,
  add column if not exists token_portal text unique,
  add column if not exists regras_aprovacao jsonb default '{"aprovado_coluna":"aprovado","alteracao_coluna":"ajustes","reprovado_coluna":"ideias"}'::jsonb;

create index if not exists idx_clientes_token_portal on public.clientes (token_portal);
create index if not exists idx_clientes_token_estrategia on public.clientes (token_estrategia);
