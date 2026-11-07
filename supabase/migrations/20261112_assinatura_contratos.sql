-- Migration: 20261112_assinatura_contratos.sql
-- Implementa texto congelado, hash SHA-256, contra-assinatura, validade e trilha de eventos de contratos

-- 1. Novas colunas em contratos
alter table if exists public.contratos
  add column if not exists conteudo_final_html text,
  add column if not exists hash_documento text,
  add column if not exists enviado_em timestamptz,
  add column if not exists visualizado_em timestamptz,
  add column if not exists expira_em timestamptz,
  add column if not exists revogado_em timestamptz,
  add column if not exists assinatura_agencia_membro_id uuid references public.membros (id) on delete set null,
  add column if not exists assinatura_agencia_ip text,
  add column if not exists pdf_url text,
  add column if not exists pdf_hash text;

-- Atualiza a constraint de status para suportar 'assinado_cliente'
alter table if exists public.contratos drop constraint if exists contratos_status_check;
alter table if exists public.contratos
  add constraint contratos_status_check
  check (status in ('rascunho', 'aguardando_assinatura', 'assinado_cliente', 'assinado', 'cancelado'));

-- 2. Novas colunas em propostas
alter table if exists public.propostas
  add column if not exists conteudo_final_html text,
  add column if not exists hash_documento text,
  add column if not exists enviado_em timestamptz,
  add column if not exists visualizado_em timestamptz,
  add column if not exists expira_em timestamptz;

-- 3. Tabela de trilha de eventos do contrato
create table if not exists public.contrato_eventos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  tipo text not null, -- 'criado' | 'enviado' | 'visualizado' | 'assinado_cliente' | 'contra_assinado' | 'cancelado' | 'link_revogado'
  ip text,
  user_agent text,
  membro_id uuid references public.membros (id) on delete set null,
  dados jsonb default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_contrato_eventos_contrato on public.contrato_eventos (contrato_id, criado_em asc);
create index if not exists idx_contrato_eventos_agencia on public.contrato_eventos (agencia_id);

alter table public.contrato_eventos enable row level security;
drop policy if exists "contrato_eventos_agencia_policy" on public.contrato_eventos;
create policy "contrato_eventos_agencia_policy" on public.contrato_eventos
  for all using (agencia_id = private.agencia_atual());
