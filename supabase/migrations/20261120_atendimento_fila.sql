-- Fila de respostas do atendimento por WhatsApp (etapa 4a). Aditiva e idempotente.
-- Nada responde direto: quem quer responder grava aqui com um horário (`enviar_em`), e um
-- cron por minuto decide, na hora de enviar, se ainda pode (horário, limite, pausa, silêncio).

-- Sem política de RLS de propósito: guarda texto de conversa de saúde, só o servidor (service role) lê.
create table if not exists public.atendimento_fila (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  -- Mesmo valor de whatsapp_mensagens.remetente (JID do contato).
  remetente text not null,
  texto text not null check (length(texto) between 1 and 4000),
  enviar_em timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'processando', 'enviada', 'simulada', 'descartada', 'falhou')),
  motivo text,
  -- Id que o OpenWA devolveu: é como a pausa por humano reconhece o eco da própria resposta do robô.
  message_id text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);
alter table public.atendimento_fila enable row level security;

create index if not exists idx_atendimento_fila_devidas on public.atendimento_fila (enviar_em) where status = 'pendente';
create index if not exists idx_atendimento_fila_contato on public.atendimento_fila (cliente_id, remetente, status);
create index if not exists idx_atendimento_fila_limite on public.atendimento_fila (cliente_id, processado_em) where status in ('enviada', 'simulada');
create index if not exists idx_atendimento_fila_message on public.atendimento_fila (message_id) where message_id is not null;
