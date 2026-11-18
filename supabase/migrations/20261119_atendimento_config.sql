-- Configuração do atendimento por WhatsApp, por cliente. Aditiva e idempotente.
-- Nasce DESLIGADA: nada responde sozinho até a etapa 4 e até alguém ligar de propósito.

-- Sem política de RLS de propósito: guarda a chave do OpenWA cifrada, então só o
-- servidor (service role) lê e escreve. A tela recebe uma visão sem segredos.
create table if not exists public.atendimento_config (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade unique,
  ligado boolean not null default false,
  -- simulacao: só registra o que responderia (whatsapp_ia_acoes); real: envia de verdade.
  modo text not null default 'simulacao' check (modo in ('simulacao', 'real')),
  sessao_nome text,
  openwa_url text,
  openwa_key_cifrada text,
  openwa_webhook_id text,
  -- {"seg":[{"de":"08:00","ate":"19:00"}], ...}; vazio = sem janela definida (a IA não responde).
  horario_atendimento jsonb not null default '{}'::jsonb,
  resposta_min_segundos integer not null default 45 check (resposta_min_segundos >= 0),
  resposta_max_segundos integer not null default 180 check (resposta_max_segundos >= resposta_min_segundos),
  limite_respostas_hora integer not null default 12 check (limite_respostas_hora >= 0),
  pausa_humano_horas integer not null default 6 check (pausa_humano_horas >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.atendimento_config enable row level security;
create index if not exists idx_atendimento_config_agencia on public.atendimento_config (agencia_id);

-- Id do webhook que o GENSBot cadastrou no Cal.com: reconectar ou girar o segredo
-- atualiza (apaga e recria) o mesmo webhook em vez de empilhar duplicados.
alter table public.agenda_integracoes add column if not exists calcom_webhook_id text;
