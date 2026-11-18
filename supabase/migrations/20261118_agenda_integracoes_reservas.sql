-- Agenda (Cal.com / Cal.diy): integração por cliente e reservas recebidas por webhook.
-- Aditiva e idempotente: só cria tabelas, índices e políticas que ainda não existem.

-- Uma integração de agenda por cliente. Guarda a chave de API e o segredo do webhook
-- CIFRADOS (src/lib/cripto.ts). Sem política de RLS de propósito: só o servidor
-- (service role) lê e escreve; a tela mostra uma versão sem os segredos.
create table if not exists public.agenda_integracoes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  provedor text not null default 'calcom' check (provedor in ('calcom', 'caldiy')),
  api_base text not null default 'https://api.cal.com',
  api_key_cifrada text,
  webhook_token text not null unique,
  webhook_secret_cifrado text,
  ativo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, provedor)
);
alter table public.agenda_integracoes enable row level security;
create index if not exists idx_agenda_integracoes_agencia on public.agenda_integracoes (agencia_id);

-- Reservas vistas pelo webhook. `uid` é o código da reserva no Cal.com.
create table if not exists public.agenda_reservas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  integracao_id uuid not null references public.agenda_integracoes (id) on delete cascade,
  uid text not null,
  status text not null check (status in ('confirmada', 'pendente', 'cancelada', 'recusada', 'remarcada')),
  inicio timestamptz,
  fim timestamptz,
  titulo text,
  nome_contato text,
  email text,
  telefone text,
  negocio_id uuid references public.crm_negocios (id) on delete set null,
  gatilho_ultimo text,
  evento_em timestamptz,
  motivo_cancelamento text,
  remarcada_de_uid text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (integracao_id, uid)
);
alter table public.agenda_reservas enable row level security;
create index if not exists idx_agenda_reservas_agencia_inicio on public.agenda_reservas (agencia_id, inicio);
create index if not exists idx_agenda_reservas_negocio on public.agenda_reservas (negocio_id);
create index if not exists idx_agenda_reservas_telefone on public.agenda_reservas (telefone);

drop policy if exists "agenda_reservas_agencia_policy" on public.agenda_reservas;
create policy "agenda_reservas_agencia_policy" on public.agenda_reservas
  for all to authenticated
  using (agencia_id = private.agencia_atual())
  with check (agencia_id = private.agencia_atual());

-- Eventos já processados (o Cal.com reenvia o mesmo corpo em novas tentativas).
-- Também sem política: uso interno do servidor.
create table if not exists public.agenda_webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  integracao_id uuid not null references public.agenda_integracoes (id) on delete cascade,
  hash text not null,
  criado_em timestamptz not null default now(),
  unique (integracao_id, hash)
);
alter table public.agenda_webhook_eventos enable row level security;
