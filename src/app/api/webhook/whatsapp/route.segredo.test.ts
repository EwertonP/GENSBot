import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { segredoDaSessao } = vi.hoisted(() => ({ segredoDaSessao: vi.fn() }));
vi.mock('@/lib/openwa-segredo', () => ({ segredoDaSessao }));
vi.mock('next/server', async () => {
  const real = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...real, after: () => undefined };
});
// Sessão desconhecida: o webhook responde "unknown_session" DEPOIS de validar o segredo, o que basta para este teste.
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } }));

import { POST } from './route';

const GLOBAL = 'segredo-global-aaaaaaaaaaaaaaaa';
const DO_CLIENTE = 'segredo-do-cliente-bbbbbbbbbbbbbb';

const chamar = (cabecalhos: Record<string, string> = {}, sessao = 'cliente-1') =>
  POST(
    new Request(`http://x/api/webhook/whatsapp?session=${sessao}`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({ event: 'message.received', data: { id: 'a', from: '5583999990001@c.us', body: 'oi' } }),
    })
  );

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('OPENWA_WEBHOOK_SECRET', GLOBAL);
  segredoDaSessao.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe('segredo do webhook por sessão', () => {
  it('sem segredo nenhum: 401 sem nem consultar o banco', async () => {
    expect((await chamar()).status).toBe(401);
    expect(segredoDaSessao).not.toHaveBeenCalled();
  });

  it('sessão sem segredo próprio (legado): vale o global', async () => {
    expect((await chamar({ 'x-openwa-secret': GLOBAL })).status).toBe(200);
    expect((await chamar({ 'x-openwa-secret': 'errado' })).status).toBe(401);
  });

  it('sessão com segredo próprio: só o próprio vale, o global é recusado', async () => {
    segredoDaSessao.mockResolvedValue(DO_CLIENTE);
    expect((await chamar({ 'x-openwa-secret': GLOBAL })).status).toBe(401);
    expect((await chamar({ 'x-openwa-secret': DO_CLIENTE })).status).toBe(200);
    expect((await chamar({ authorization: `Bearer ${DO_CLIENTE}` })).status).toBe(200);
    expect(segredoDaSessao).toHaveBeenCalledWith('cliente-1');
  });

  it('erro ao ler o segredo da sessão: recusa (503), não cai no global', async () => {
    segredoDaSessao.mockRejectedValue(new Error('banco fora'));
    expect((await chamar({ 'x-openwa-secret': GLOBAL })).status).toBe(503);
  });
});
