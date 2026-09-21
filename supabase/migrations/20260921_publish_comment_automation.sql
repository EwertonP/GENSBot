-- Migration: 20260921_publish_comment_automation.sql
-- Vincula agendamentos e publicações imediatas à criação automática de automações de comentários (Direct Automático)
-- e armazena intenção de automação nas demandas da esteira.

alter table if exists public.scheduled_posts
  add column if not exists automation_config jsonb,
  add column if not exists created_automation_id uuid references public.automations(id) on delete set null;

comment on column public.scheduled_posts.automation_config is
  'Configuração de disparo automático de DM a partir de comentários ao publicar o post.';
comment on column public.scheduled_posts.created_automation_id is
  'ID da automação criada em automations após a confirmação da publicação na Meta.';

alter table if exists public.conteudo_items
  add column if not exists automacao_config jsonb;

comment on column public.conteudo_items.automacao_config is
  'Configuração de automação de comentários planejada na demanda para transição automática no agendamento.';
