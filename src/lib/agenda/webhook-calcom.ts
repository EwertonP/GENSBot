/**
 * Webhook do Cal.com (e do Cal.diy, que usa o mesmo formato): verificação da
 * assinatura e leitura do payload. Funções puras: quem grava no banco é a rota.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { normalizarTelefoneBR } from '@/lib/telefone';

export type StatusReserva = 'confirmada' | 'pendente' | 'cancelada' | 'recusada' | 'remarcada';

export interface ReservaDoWebhook {
  gatilho: string;
  uid: string;
  status: StatusReserva;
  inicio: string | null;
  fim: string | null;
  titulo: string | null;
  nomeContato: string | null;
  email: string | null;
  /** Só dígitos, com código do país (ex.: 5583999990001). Vazio se a pessoa não informou. */
  telefone: string;
  /** Código do negócio do CRM, quando o link de agendamento o carregava. */
  negocioId: string | null;
  motivoCancelamento: string | null;
  /** Em remarcação: o uid da reserva antiga. */
  remarcadaDeUid: string | null;
  /** Instante em que o Cal.com gerou o evento (para ignorar eventos fora de ordem). */
  eventoEm: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Confere `x-cal-signature-256`: HMAC-SHA256 em hexadecimal do corpo EXATO recebido.
 * Precisa do texto bruto, antes de qualquer JSON.parse.
 */
export function verificarAssinaturaCalcom(corpoBruto: string, assinatura: string | null | undefined, segredo: string): boolean {
  if (!assinatura || !segredo) return false;
  const esperado = createHmac('sha256', segredo).update(corpoBruto).digest('hex');
  const recebido = assinatura.trim().toLowerCase().replace(/^sha256=/, '');
  if (!/^[0-9a-f]{64}$/.test(recebido)) return false;
  return timingSafeEqual(Buffer.from(recebido, 'hex'), Buffer.from(esperado, 'hex'));
}

/** Identifica um evento repetido (o Cal.com reenvia o mesmo corpo em novas tentativas). */
export function hashDoEvento(corpoBruto: string): string {
  return createHash('sha256').update(corpoBruto).digest('hex');
}

const STATUS_POR_GATILHO: Record<string, StatusReserva> = {
  BOOKING_CREATED: 'confirmada',
  BOOKING_REQUESTED: 'pendente',
  BOOKING_RESCHEDULED: 'confirmada',
  BOOKING_CANCELLED: 'cancelada',
  BOOKING_REJECTED: 'recusada',
};

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const dataIso = (v: unknown): string | null => {
  const t = texto(v);
  return t && !Number.isNaN(Date.parse(t)) ? t : null;
};

/** Lê o corpo do webhook. Devolve null para eventos que não são de reserva (ex.: PING). */
export function interpretarWebhookCalcom(corpo: unknown): ReservaDoWebhook | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const c = corpo as Record<string, unknown>;
  const gatilho = texto(c.triggerEvent);
  if (!gatilho) return null;
  const status = STATUS_POR_GATILHO[gatilho];
  const p = c.payload && typeof c.payload === 'object' ? (c.payload as Record<string, unknown>) : null;
  const uid = p ? texto(p.uid) : null;
  if (!status || !p || !uid) return null;

  const participantes = Array.isArray(p.attendees) ? (p.attendees as Record<string, unknown>[]) : [];
  const primeiro = participantes[0] ?? {};
  const respostas = p.responses && typeof p.responses === 'object' ? (p.responses as Record<string, { value?: unknown }>) : {};
  const bruto = texto(respostas.attendeePhoneNumber?.value) ?? texto(primeiro.phoneNumber) ?? '';

  const metadados = p.metadata && typeof p.metadata === 'object' ? (p.metadata as Record<string, unknown>) : {};
  const negocio = texto(metadados.negocio_id);

  const antiga = texto(p.rescheduleUid);
  return {
    gatilho,
    uid,
    status,
    inicio: dataIso(p.startTime),
    fim: dataIso(p.endTime),
    titulo: texto(p.title),
    nomeContato: texto(primeiro.name) ?? texto(respostas.name?.value),
    email: texto(primeiro.email) ?? texto(respostas.email?.value),
    telefone: normalizarTelefoneBR(bruto),
    negocioId: negocio && UUID.test(negocio) ? negocio : null,
    motivoCancelamento: texto(p.cancellationReason),
    remarcadaDeUid: gatilho === 'BOOKING_RESCHEDULED' && antiga && antiga !== uid ? antiga : null,
    eventoEm: dataIso(c.createdAt),
  };
}
