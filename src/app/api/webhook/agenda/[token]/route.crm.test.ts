import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Linha = Record<string, unknown>;
const { crm } = vi.hoisted(() => ({ crm: vi.fn() }));
const estado = { reservas: [] as Linha[], hashes: new Set<string>() };

function from(tabela: string) {
  const f: Record<string, unknown> = {};
  let op = 'select';
  let payload: Linha = {};
  const api: Record<string, unknown> = {
    select: () => api,
    eq: (c: string, v: unknown) => ((f[c] = v), api),
    ilike: () => api,
    limit: () => api,
    upsert: (p: Linha) => ((op = 'upsert'), (payload = p), api),
    update: (p: Linha) => ((op = 'update'), (payload = p), api),
    delete: () => ((op = 'delete'), api),
    maybeSingle: async () => {
      if (tabela === 'agenda_integracoes') return { data: { id: 'i1', agencia_id: 'ag1', cliente_id: 'cl1', webhook_secret_cifrado: 'seg', ativo: true } };
      if (tabela === 'agenda_reservas') return { data: estado.reservas.find((r) => r.uid === f.uid) ?? null };
      return { data: null };
    },
    then: (resolve: (v: unknown) => void) => {
      if (tabela === 'agenda_webhook_eventos' && op === 'upsert') {
        const h = String(payload.hash);
        if (estado.hashes.has(h)) return resolve({ data: [], error: null });
        estado.hashes.add(h);
        return resolve({ data: [{ id: 'x' }], error: null });
      }
      if (tabela === 'agenda_reservas' && op === 'upsert') {
        const i = estado.reservas.findIndex((r) => r.uid === payload.uid);
        if (i >= 0) estado.reservas[i] = { ...estado.reservas[i], ...payload };
        else estado.reservas.push({ ...payload });
      }
      if (tabela === 'agenda_reservas' && op === 'update') estado.reservas.filter((r) => r.uid === f.uid).forEach((r) => Object.assign(r, payload));
      resolve({ data: null, error: null });
    },
  };
  return api;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => from(t) } }));
vi.mock('@/lib/cripto', () => ({ descriptografarSegredo: (v?: string | null) => v ?? null }));
vi.mock('@/lib/agenda/crm-reserva-server', () => ({ aplicarReservaNoCrm: crm }));

import { POST } from './route';

const TOKEN = 'tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const enviar = (corpo: unknown) => {
  const texto = JSON.stringify(corpo);
  return POST(
    new Request('http://x', { method: 'POST', headers: { 'x-cal-signature-256': createHmac('sha256', 'seg').update(texto).digest('hex') }, body: texto }),
    { params: Promise.resolve({ token: TOKEN }) }
  );
};
const evento = (gatilho: string, payload: Linha, createdAt: string) => ({ triggerEvent: gatilho, createdAt, payload });

beforeEach(() => {
  vi.clearAllMocks();
  estado.reservas = [];
  estado.hashes = new Set();
  crm.mockResolvedValue({ ok: true, acao: 'aplicado', negocioId: 'n1' });
});

describe('webhook da agenda → CRM', () => {
  it('chama o CRM com a agência, o cliente e a integração da URL (nunca do corpo)', async () => {
    const r = await enviar(evento('BOOKING_CREATED', { uid: 'u1', startTime: '2026-11-23T16:00:00Z', attendees: [{ name: 'Maria', phoneNumber: '+5583999990001' }], metadata: { agencia_id: 'OUTRA', negocio_id: 'x' } }, '2026-11-18T12:00:00Z'));
    expect(await r.json()).toMatchObject({ ok: true, crm: 'aplicado' });
    expect(crm).toHaveBeenCalledWith(expect.objectContaining({ agenciaId: 'ag1', clienteId: 'cl1', integracaoId: 'i1', reservaJaRemarcada: false }));
    expect(crm.mock.calls[0][0].reserva).toMatchObject({ uid: 'u1', status: 'confirmada', telefone: '5583999990001' });
  });

  it('falha no CRM: o webhook continua respondendo 200 e a reserva fica gravada', async () => {
    crm.mockResolvedValue({ ok: false, acao: 'falhou', erro: 'boom' });
    const r = await enviar(evento('BOOKING_CREATED', { uid: 'u1', startTime: '2026-11-23T16:00:00Z' }, '2026-11-18T12:00:00Z'));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, crm: 'falhou' });
    expect(estado.reservas).toHaveLength(1);
  });

  it('a reserva antiga remarcada NÃO volta a "cancelada" se o cancelamento dela chegar depois', async () => {
    await enviar(evento('BOOKING_CREATED', { uid: 'velha', startTime: '2026-11-23T16:00:00Z' }, '2026-11-18T12:00:00Z'));
    await enviar(evento('BOOKING_RESCHEDULED', { uid: 'nova', rescheduleUid: 'velha', startTime: '2026-11-24T16:00:00Z' }, '2026-11-18T12:05:00Z'));
    expect(estado.reservas.find((r) => r.uid === 'velha')!.status).toBe('remarcada');

    crm.mockClear();
    await enviar(evento('BOOKING_CANCELLED', { uid: 'velha' }, '2026-11-18T12:06:00Z'));
    expect(estado.reservas.find((r) => r.uid === 'velha')!.status).toBe('remarcada');
    expect(crm.mock.calls[0][0]).toMatchObject({ reservaJaRemarcada: true });
  });

  it('evento repetido não chama o CRM de novo', async () => {
    const ev = evento('BOOKING_CREATED', { uid: 'u1', startTime: '2026-11-23T16:00:00Z' }, '2026-11-18T12:00:00Z');
    await enviar(ev);
    await enviar(ev);
    expect(crm).toHaveBeenCalledTimes(1);
  });
});
