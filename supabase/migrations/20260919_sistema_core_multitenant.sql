-- Sistema unificado: núcleo multi-tenant
--
-- Este banco (ManyChat Gens) passa a ser o banco único do sistema. O GENSBot
-- já vivia aqui; agora ganha a espinha que faltava — agência, membros e cargos.
--
-- Puramente aditivo: nenhuma tabela existente é alterada. As tabelas de
-- prospecção (leads, lead_activities…) não existem neste banco, então a parte
-- de retrofit da migration equivalente do ProspeccaoGens foi omitida.

create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  cnpj_cpf text,
  criado_em timestamptz not null default now()
);

comment on table public.agencias is
  'Tenant raiz. Todo dado do sistema pendura em uma agência.';

create table public.membros (
  id uuid primary key references auth.users (id) on delete cascade,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null default 'membro'
    check (papel in ('master', 'membro')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index membros_agencia_id_idx on public.membros (agencia_id);

comment on table public.membros is
  'Pessoa da equipe. 1:1 com auth.users — um login pertence a uma agência.';

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null,
  -- Chaves livres para não exigir migration a cada nova permissão;
  -- a UI valida contra a lista conhecida.
  capacidades jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  unique (agencia_id, nome)
);

create table public.membro_cargos (
  membro_id uuid not null references public.membros (id) on delete cascade,
  cargo_id uuid not null references public.cargos (id) on delete cascade,
  primary key (membro_id, cargo_id)
);

-- Helpers de RLS no schema private: em public, o PostgREST os publicaria como
-- /rest/v1/rpc/*, e são detalhe interno de policy, não API.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.agencia_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agencia_id from public.membros where id = auth.uid() and ativo
$$;

create or replace function private.e_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros
    where id = auth.uid() and ativo and papel = 'master'
  )
$$;

alter table public.agencias enable row level security;
alter table public.membros enable row level security;
alter table public.cargos enable row level security;
alter table public.membro_cargos enable row level security;

create policy agencias_leitura on public.agencias
  for select using (id = private.agencia_atual());

create policy agencias_escrita_master on public.agencias
  for update using (id = private.agencia_atual() and private.e_master())
  with check (id = private.agencia_atual());

create policy membros_leitura on public.membros
  for select using (agencia_id = private.agencia_atual());

create policy membros_escrita_master on public.membros
  for all using (agencia_id = private.agencia_atual() and private.e_master())
  with check (agencia_id = private.agencia_atual());

create policy cargos_leitura on public.cargos
  for select using (agencia_id = private.agencia_atual());

create policy cargos_escrita_master on public.cargos
  for all using (agencia_id = private.agencia_atual() and private.e_master())
  with check (agencia_id = private.agencia_atual());

create policy membro_cargos_leitura on public.membro_cargos
  for select using (
    exists (
      select 1 from public.membros m
      where m.id = membro_cargos.membro_id
        and m.agencia_id = private.agencia_atual()
    )
  );

create policy membro_cargos_escrita_master on public.membro_cargos
  for all using (
    private.e_master() and exists (
      select 1 from public.membros m
      where m.id = membro_cargos.membro_id
        and m.agencia_id = private.agencia_atual()
    )
  )
  with check (
    exists (
      select 1 from public.membros m
      where m.id = membro_cargos.membro_id
        and m.agencia_id = private.agencia_atual()
    )
  );
