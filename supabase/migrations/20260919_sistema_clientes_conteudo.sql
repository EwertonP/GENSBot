-- Sistema unificado: clientes e esteira de conteúdo
--
-- O elo que faltava no GENSBot: cada conta de Instagram já conectada
-- (instagram_accounts) passa a poder pertencer a um cliente da agência.
-- Aditivo — nenhuma tabela existente é alterada.

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,

  -- Identificação
  nome text not null,
  foto_url text,
  cor text,
  nicho text,

  -- O vínculo com o GENSBot: a conta de Instagram conectada deste cliente.
  -- on delete set null: desconectar a conta não pode apagar o cliente.
  instagram_account_id uuid unique
    references public.instagram_accounts (id) on delete set null,

  -- Origem comercial. Sem FK para leads: o CRM da agência mora em outro banco
  -- por enquanto, então guardamos só o ponteiro.
  lead_id uuid,
  responsavel_venda_id uuid references public.membros (id) on delete set null,
  convertido_em timestamptz,

  -- Fiscal / contrato
  cnpj_cpf text,
  responsavel_legal text,
  cpf_responsavel text,
  endereco text,
  valor_mensal numeric(10, 2),
  dia_vencimento smallint check (dia_vencimento between 1 and 31),
  contrato_inicio date,
  contrato_duracao_meses smallint,
  contrato_arquivo_url text,

  -- Operação
  posts_mes smallint,
  reels_mes smallint,
  dia_revisao smallint check (dia_revisao between 0 and 6),
  responsavel_fixo_id uuid references public.membros (id) on delete set null,
  etapa text,
  observacoes text,
  concorrentes text,
  briefing text,

  drive_pasta_id text,

  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index clientes_agencia_id_idx on public.clientes (agencia_id);

comment on column public.clientes.instagram_account_id is
  'Conta de Instagram do GENSBot que pertence a este cliente. Uma conta, um cliente.';
comment on column public.clientes.dia_revisao is
  'Dia da semana da revisão: 0 = domingo, 6 = sábado.';
comment on column public.clientes.etapa is
  'Etapa do ciclo operacional (onboarding → recorrente). Texto livre porque a lista varia e não vale travar em check constraint agora.';

create table public.cliente_contatos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  cargo text,
  telefone text,
  email text,
  e_grupo_whatsapp boolean not null default false,
  criado_em timestamptz not null default now()
);

create index cliente_contatos_cliente_id_idx on public.cliente_contatos (cliente_id);

-- Cofre de acessos. Visível apenas para master — ver policy abaixo.
create table public.cliente_acessos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  servico text not null,
  usuario text,
  -- Cifrado pela aplicação; o banco nunca vê o valor em claro.
  senha_cifrada text,
  notas text,
  criado_em timestamptz not null default now()
);

create index cliente_acessos_cliente_id_idx on public.cliente_acessos (cliente_id);

create table public.conteudo_items (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,

  tipo text not null
    check (tipo in ('post', 'reel', 'story', 'avulso')),

  -- Esteira de 13 estados. 'travado' é exceção, não etapa da fila.
  status text not null default 'planejamento'
    check (status in (
      'planejamento',
      'copy',
      'criacao_arte',
      'revisao_arte',
      'em_gravacao',
      'em_edicao',
      'revisao_interna',
      'revisao_cliente',
      'agendamento',
      'revisao_agendamento',
      'pronto_publicar',
      'publicado',
      'travado'
    )),

  titulo text,
  legenda text,

  -- Sempre dia 1 — é um mês, não uma data.
  mes_referencia date not null,
  ordem smallint not null default 0,
  data_programada timestamptz,
  publicado_em timestamptz,

  responsavel_id uuid references public.membros (id) on delete set null,
  editor_id uuid references public.membros (id) on delete set null,

  -- Quando publicado pelo GENSBot, aponta para o agendamento correspondente.
  scheduled_post_id uuid references public.scheduled_posts (id) on delete set null,

  arquivos jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index conteudo_items_cliente_mes_idx
  on public.conteudo_items (cliente_id, mes_referencia);
create index conteudo_items_agencia_status_idx
  on public.conteudo_items (agencia_id, status);
create index conteudo_items_responsavel_idx
  on public.conteudo_items (responsavel_id);
create index conteudo_items_scheduled_post_idx
  on public.conteudo_items (scheduled_post_id);

comment on column public.conteudo_items.scheduled_post_id is
  'Elo com scheduled_posts do GENSBot: a esteira decide QUANDO está pronto, o GENSBot publica.';

create or replace function public.toca_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.toca_atualizado_em();

create trigger conteudo_items_atualizado_em
  before update on public.conteudo_items
  for each row execute function public.toca_atualizado_em();

alter table public.clientes enable row level security;
alter table public.cliente_contatos enable row level security;
alter table public.cliente_acessos enable row level security;
alter table public.conteudo_items enable row level security;

create policy clientes_tenant on public.clientes
  for all using (agencia_id = private.agencia_atual())
  with check (agencia_id = private.agencia_atual());

create policy cliente_contatos_tenant on public.cliente_contatos
  for all using (agencia_id = private.agencia_atual())
  with check (agencia_id = private.agencia_atual());

-- Senhas e acessos: só master, mesmo dentro da agência.
create policy cliente_acessos_master on public.cliente_acessos
  for all using (agencia_id = private.agencia_atual() and private.e_master())
  with check (agencia_id = private.agencia_atual() and private.e_master());

create policy conteudo_items_tenant on public.conteudo_items
  for all using (agencia_id = private.agencia_atual())
  with check (agencia_id = private.agencia_atual());
