-- Retenção do texto das demandas publicadas, por cliente (link do mês, fase 3)
-- Aditiva e idempotente. NULL = padrão da agência (30 dias).
alter table public.clientes
  add column if not exists retencao_texto_dias integer;

alter table public.clientes drop constraint if exists clientes_retencao_texto_dias_check;
alter table public.clientes
  add constraint clientes_retencao_texto_dias_check
  check (retencao_texto_dias is null or retencao_texto_dias between 7 and 365);
