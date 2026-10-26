-- Escopo de clientes por membro (ex.: editora que só enxerga os clientes dela).
--
-- Até aqui qualquer membro ativo da agência enxergava todos os clientes e todas
-- as demandas. Esta migration introduz membro_clientes: um membro comum só vê e
-- edita clientes (e demandas, contatos) dos clientes vinculados a ele. Master
-- continua vendo tudo.
--
-- Mudança de comportamento: membro comum deixa de ter acesso amplo. Ficha de
-- cliente (clientes) passa a ser editável só por master. Demandas e contatos
-- seguem editáveis pelo membro, mas só dos clientes vinculados.
--
-- Aditiva no esquema: nenhuma coluna é alterada. Só as policies de clientes,
-- cliente_contatos e conteudo_items são substituídas.

create table public.membro_clientes (
  membro_id uuid not null references public.membros (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (membro_id, cliente_id)
);

create index membro_clientes_cliente_id_idx on public.membro_clientes (cliente_id);
create index membro_clientes_agencia_id_idx on public.membro_clientes (agencia_id);

comment on table public.membro_clientes is
  'Quais clientes um membro comum pode ver e trabalhar. Master não precisa de linhas aqui.';

-- Helper de RLS: master vê tudo da agência; membro só o que estiver vinculado.
-- Fica em private pelo mesmo motivo dos outros helpers (não é API do PostgREST).
create or replace function private.cliente_permitido(p_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.e_master()
    or exists (
      select 1 from public.membro_clientes mc
      where mc.cliente_id = p_cliente_id
        and mc.membro_id = auth.uid()
    )
    -- Portal do cliente (papel 'cliente'): enxerga só o próprio cliente.
    or exists (
      select 1 from public.membros m
      where m.id = auth.uid()
        and m.ativo
        and m.papel = 'cliente'
        and m.cliente_id = p_cliente_id
    )
$$;

alter table public.membro_clientes enable row level security;

-- Membro vê os próprios vínculos; master vê e gerencia todos.
create policy membro_clientes_leitura on public.membro_clientes
  for select using (
    agencia_id = private.agencia_atual()
    and (private.e_master() or membro_id = auth.uid())
  );

-- Só master cria, altera e remove vínculos. O cliente precisa ser da mesma agência.
create policy membro_clientes_escrita_master on public.membro_clientes
  for all using (
    agencia_id = private.agencia_atual() and private.e_master()
  )
  with check (
    agencia_id = private.agencia_atual()
    and private.e_master()
    and exists (
      select 1 from public.clientes c
      where c.id = membro_clientes.cliente_id
        and c.agencia_id = membro_clientes.agencia_id
    )
  );

-- Substitui as policies amplas por agência. Ficha de cliente: leitura por escopo,
-- escrita só master.
drop policy if exists clientes_tenant on public.clientes;

create policy clientes_leitura on public.clientes
  for select using (
    agencia_id = private.agencia_atual() and private.cliente_permitido(id)
  );

create policy clientes_escrita_master on public.clientes
  for all using (
    agencia_id = private.agencia_atual() and private.e_master()
  )
  with check (
    agencia_id = private.agencia_atual() and private.e_master()
  );

-- Contatos e demandas: membro atua somente nos clientes vinculados.
drop policy if exists cliente_contatos_tenant on public.cliente_contatos;

create policy cliente_contatos_por_escopo on public.cliente_contatos
  for all using (
    agencia_id = private.agencia_atual() and private.cliente_permitido(cliente_id)
  )
  with check (
    agencia_id = private.agencia_atual() and private.cliente_permitido(cliente_id)
  );

drop policy if exists conteudo_items_tenant on public.conteudo_items;

create policy conteudo_items_por_escopo on public.conteudo_items
  for all using (
    agencia_id = private.agencia_atual() and private.cliente_permitido(cliente_id)
  )
  with check (
    agencia_id = private.agencia_atual() and private.cliente_permitido(cliente_id)
  );
