-- Registro Unificado de Auditoria e Histórico de Atividades da Agência
-- Linha do tempo de alterações por dia, módulo, pessoa e hora

create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  membro_id uuid references public.membros (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  modulo text not null, -- 'demandas' | 'propostas' | 'contratos' | 'clientes' | 'financeiro' | 'redes' | 'crm'
  acao text not null, -- 'criou' | 'moveu' | 'aprovou' | 'assinou' | 'conectou' | 'alterou' | 'excluiu'
  descricao text not null,
  detalhes jsonb default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_auditoria_agencia on public.auditoria_eventos (agencia_id, criado_em desc);
create index if not exists idx_auditoria_modulo on public.auditoria_eventos (agencia_id, modulo);
create index if not exists idx_auditoria_cliente on public.auditoria_eventos (agencia_id, cliente_id);

alter table public.auditoria_eventos enable row level security;
drop policy if exists "auditoria_agencia_policy" on public.auditoria_eventos;
create policy "auditoria_agencia_policy" on public.auditoria_eventos
  for all using (agencia_id = auth_agencia_id());
