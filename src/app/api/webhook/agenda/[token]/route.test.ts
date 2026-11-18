import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Linha = Record<string, unknown>;
const estado = {
  integ: null as Linha | null,
  hashes: new Set<string>(),
  reservas: [] as Linha[],
  negocios: [] as Linha[],
  falharGravacao: false,
};

// Banco falso em memória: só o que a rota usa.
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
      if (tabela === 'agenda_integracoes') return { data: estado.integ && f.webhook_token === estado.integ.webhook_token ? estado.integ : null };
      if (tabela === 'agenda_reservas') return { data: estado.reservas.find((r) => r.uid === f.uid) ?? null };
      if (tabela === 'crm_negocios') return { data: estado.negocios.find((n) => n.id === f.id) ?? null };
      return { data: null };
    },
    then: (resolve: (v: unknown) => void) => {
      if (tabela === 'agenda_webhook_eventos') {
        if (op === 'delete') {
          estado.hashes.delete(String(f.hash));
          return resolve({ data: null, error: null });
        }
        const h = String(payload.hash);
        if (estado.hashes.has(h)) return resolve({ data: [], error: null });
        estado.hashes.add(h);
        return resolve({ data: [{ id: 'novo' }], error: null });
      }
      if (tabela === 'agenda_reservas') {
        if (op === 'upsert') {
          if (estado.falharGravacao) return resolve({ error: { message: 'boom' } });
          const i = estado.reservas.findIndex((r) => r.uid === payload.uid);
          if (i >= 0) estado.reservas[i] = { ...estado.reservas[i], ...payload };
          else estado.reservas.push({ ...payload });
          return resolve({ error: null });
        }
        if (op === 'update') {
          estado.reservas.filter((r) => r.uid === f.uid).forEach((r) => Object.assign(r, payload));
          return resolve({ error: null });
        }
      }
      if (tabela === 'crm_negocios') return resolve({ data: estado.negocios, error: null });
      return resolve({ data: null, error: null });
    },
  };
  return api;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => from(t) } }));
vi.mock('@/lib/cripto', () => ({ descriptografarSegredo: (v?: string | null) => v ?? null }));

import { POST } from './route';

const TOKEN = 'tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SEGREDO = 'segredo-do-cliente';
const NEG = '3f792b6e-bdac-4058-89e6-fc08ce7bcb4b';

function pedido(corpo: unknown, opcoes: { segredo?: string; assinar?: boolean; token?: string } = {}) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opcoes.assinar !== false) headers['x-cal-signature-256'] = createHmac('sha256', opcoes.segredo ?? SEGREDO).update(texto).digest('hex');
  const req = new Request('http://x/api/webhook/agenda/' + TOKEN, { method: 'POST', headers, body: texto });
  return POST(req, { params: Promise.resolve({ token: opcoes.token ?? TOKEN }) });
}

const criado = (extra: Linha = {}) => ({
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2026-11-19T15:00:00.000Z',
  payload: {
    uid: 'u1',
    startTime: '2026-11-20T12:00:00Z',
    endTime: '2026-11-20T12:30:00Z',
    attendees: [{ name: 'Maria', email: 'm@e.com', phoneNumber: '+5583999990001' }],
    metadata: { negocio_id: NEG },
    ...extra,
  },
});

beforeEach(() => {
  estado.integ = { id: 'i1', agencia_id: 'ag1', cliente_id: 'cl1', webhook_token: TOKEN, webhook_secret_cifrado: SEGREDO, ativo: true };
  estado.hashes = new Set();
  estado.reservas = [];
  estado.negocios = [{ id: NEG, telefone: '5583999990001', status: 'aberto', atualizado_em: '2026-11-01' }];
  estado.falharGravacao = false;
});

describe('POST /api/webhook/agenda/[token]', () => {
  it('token malformado ou desconhecido: 404', async () => {
    expect((await pedido(criado(), { token: 'curto' })).status).toBe(404);
    estado.integ = null;
    expect((await pedido(criado())).status).toBe(404);
  });

  it('assinatura errada ou ausente: 401 e nada é gravado', async () => {
    expect((await pedido(criado(), { segredo: 'outro' })).status).toBe(401);
    expect((await pedido(criado(), { assinar: false })).status).toBe(401);
    expect(estado.reservas).toHaveLength(0);
  });

  it('sem segredo configurado falha fechado: 503', async () => {
    estado.integ = { ...estado.integ!, webhook_secret_cifrado: null };
    expect((await pedido(criado())).status).toBe(503);
  });

  it('integração inativa não grava', async () => {
    estado.integ = { ...estado.integ!, ativo: false };
    const r = await pedido(criado());
    expect(await r.json()).toMatchObject({ ignored: 'integracao_inativa' });
    expect(estado.reservas).toHaveLength(0);
  });

  it('reserva criada: grava, ligada ao negócio do metadata, com telefone normalizado', async () => {
    const r = await pedido(criado());
    expect(r.status).toBe(200);
    expect(estado.reservas).toHaveLength(1);
    expect(estado.reservas[0]).toMatchObject({
      agencia_id: 'ag1',
      cliente_id: 'cl1',
      uid: 'u1',
      status: 'confirmada',
      telefone: '5583999990001',
      negocio_id: NEG,
    });
  });

  it('negocio_id de outra agência não é aceito: cai no telefone', async () => {
    estado.negocios = [];
    await pedido(criado());
    expect(estado.reservas[0].negocio_id).toBeNull();
  });

  it('mesmo corpo reenviado é tratado como repetido', async () => {
    await pedido(criado());
    const r = await pedido(criado());
    expect(await r.json()).toMatchObject({ duplicate: true });
    expect(estado.reservas).toHaveLength(1);
  });

  it('cancelamento sem metadata mantém o vínculo do negócio', async () => {
    await pedido(criado());
    await pedido({ triggerEvent: 'BOOKING_CANCELLED', createdAt: '2026-11-19T16:00:00.000Z', payload: { uid: 'u1', cancellationReason: 'imprevisto' } });
    expect(estado.reservas[0]).toMatchObject({ status: 'cancelada', negocio_id: NEG, motivo_cancelamento: 'imprevisto' });
    // O cancelamento veio sem horário, telefone, nome nem e-mail: o que já estava guardado fica.
    expect(estado.reservas[0]).toMatchObject({
      inicio: '2026-11-20T12:00:00Z',
      fim: '2026-11-20T12:30:00Z',
      telefone: '5583999990001',
      nome_contato: 'Maria',
      email: 'm@e.com',
    });
  });

  it('evento mais antigo que o já gravado é ignorado', async () => {
    await pedido({ triggerEvent: 'BOOKING_CANCELLED', createdAt: '2026-11-19T16:00:00.000Z', payload: { uid: 'u1' } });
    const r = await pedido(criado()); // createdAt 15:00, antes do cancelamento
    expect(await r.json()).toMatchObject({ ignored: 'evento_antigo' });
    expect(estado.reservas[0].status).toBe('cancelada');
  });

  it('remarcação marca a reserva antiga', async () => {
    await pedido(criado());
    await pedido({ triggerEvent: 'BOOKING_RESCHEDULED', createdAt: '2026-11-19T17:00:00.000Z', payload: { uid: 'u2', rescheduleUid: 'u1', startTime: '2026-11-21T12:00:00Z' } });
    expect(estado.reservas.find((r) => r.uid === 'u1')!.status).toBe('remarcada');
    expect(estado.reservas.find((r) => r.uid === 'u2')!.status).toBe('confirmada');
  });

  it('PING e eventos sem reserva respondem 200 sem gravar', async () => {
    const r = await pedido({ triggerEvent: 'PING', payload: {} });
    expect(r.status).toBe(200);
    expect(estado.reservas).toHaveLength(0);
  });

  it('falha ao gravar: 500 e libera o hash para a nova tentativa', async () => {
    estado.falharGravacao = true;
    expect((await pedido(criado())).status).toBe(500);
    estado.falharGravacao = false;
    expect((await pedido(criado())).status).toBe(200);
    expect(estado.reservas).toHaveLength(1);
  });
});
