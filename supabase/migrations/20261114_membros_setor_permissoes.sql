-- Migration: 20261114_membros_setor_permissoes.sql
-- Setores, squads, permissoes por funcao para equipe e metas comerciais para agencias

-- 1. Colunas em membros
alter table if exists public.membros
  add column if not exists setor text,
  add column if not exists modulos_permitidos jsonb default '["meu_dia", "esteira", "clientes", "publish", "automations", "contacts"]'::jsonb,
  add column if not exists data_nascimento date,
  add column if not exists data_inicio date;

-- 2. Colunas de metas comerciais em agencias
alter table if exists public.agencias
  add column if not exists meta_novos_clientes_mes integer default 5,
  add column if not exists meta_receita_crm_mes numeric(12,2) default 15000;
