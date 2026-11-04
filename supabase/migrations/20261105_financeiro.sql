-- Financeiro da agência: receitas e despesas. Só o servidor (service role) lê e
-- escreve, e só o master acessa a tela; sem policies, como nas demais tabelas internas.
--
-- Mensalidades NÃO são gravadas de antemão: nascem do cadastro do cliente
-- (clientes.valor_mensal + dia_vencimento) e só viram linha aqui quando o mês é
-- marcado como recebido (origem = 'mensalidade').
create table if not exists lancamentos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references agencias(id) on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  vencimento date not null,
  pago boolean not null default false,
  pago_em date,
  categoria text not null default 'outros',
  origem text not null default 'manual' check (origem in ('manual', 'mensalidade')),
  competencia date,
  cliente_id uuid references clientes(id) on delete set null,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_lancamentos_agencia_venc on lancamentos (agencia_id, vencimento);
-- Uma mensalidade por cliente e mês.
create unique index if not exists uq_lancamentos_mensalidade
  on lancamentos (agencia_id, cliente_id, competencia) where origem = 'mensalidade';
alter table lancamentos enable row level security;
