-- Migration: 20260921_onboarding_audit_feed.sql
-- Adiciona suporte a etapas de onboarding nos clientes e histórico de atividades/status nas demandas.

alter table if exists public.clientes
  add column if not exists onboarding_etapas jsonb not null default '[]'::jsonb;

comment on column public.clientes.onboarding_etapas is
  'Checklist operacional de onboarding do cliente (9 etapas de setup da agência).';

alter table if exists public.conteudo_items
  add column if not exists historico_atividades jsonb not null default '[]'::jsonb;

comment on column public.conteudo_items.historico_atividades is
  'Linha do tempo (audit trail) de alterações de status e recados internos da equipe na demanda.';
