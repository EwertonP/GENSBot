-- Aprovação do texto pela cliente no link do mês (etapa de planejamento)
-- Aditiva e idempotente.
alter table public.conteudo_items
  add column if not exists texto_aprovado_em timestamptz,
  add column if not exists texto_aprovado_por text;
