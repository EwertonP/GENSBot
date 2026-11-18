import { beforeEach, describe, expect, it, vi } from 'vitest';

const { contexto, cliente, config, integ, reservas, salvar } = vi.hoisted(() => ({
  contexto: vi.fn(),
  cliente: vi.fn(),
  config: vi.fn(),
  integ: vi.fn(),
  reservas: vi.fn(),
  salvar: vi.fn(),
}));

vi.mock('@/lib/clientes-server', () => ({
  getContextoAgencia: contexto,
  respostaErro: (erro: string, status: number) => Response.json({ error: erro }, { status }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => {
      const c: Record<string, unknown> = {
        select: () => c,
        eq: () => c,
        maybeSingle: async () => ({ data: t === 'clientes' ? cliente() : null }),
        then: (r: (v: unknown) => void) => r({ count: reservas() }),
      };
      return c;
    },
  },
}));
vi.mock('@/lib/atendimento/config', async () => {
  const real = await vi.importActual<typeof import('@/lib/atendimento/config')>('@/lib/atendimento/config');
  return { ...real, lerConfig: config, salvarConfig: salvar };
});
vi.mock('@/lib/agenda/integracao', async () => {
  const real = await vi.importActual<typeof import('@/lib/agenda/integracao')>('@/lib/agenda/integracao');
  return { ...real, lerIntegracao: integ };
});

import { GET, PUT } from './route';

const CLIENTE = '11111111-1111-1111-1111-111111111111';
const ctx = { params: Promise.resolve({ clienteId: CLIENTE }) };
const comPapel = (papel: string) => contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel, agencia_id: 'ag1' } } });
const put = (corpo: unknown) => PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify(corpo) }), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  comPapel('master');
  cliente.mockReturnValue({ id: CLIENTE });
  config.mockResolvedValue(null);
  integ.mockResolvedValue(null);
  reservas.mockReturnValue(0);
});

describe('/api/atendimento/[clienteId]', () => {
  it('sem login devolve o erro do contexto', async () => {
    contexto.mockResolvedValue({ ok: false, response: Response.json({ error: 'Não autorizado' }, { status: 401 }) });
    expect((await GET(new Request('http://x'), ctx)).status).toBe(401);
  });

  it('quem não é master leva 403 e nada é lido', async () => {
    for (const papel of ['membro', 'cliente']) {
      comPapel(papel);
      expect((await GET(new Request('http://x'), ctx)).status).toBe(403);
      expect((await put({ modo: 'simulacao' })).status).toBe(403);
    }
    expect(config).not.toHaveBeenCalled();
    expect(salvar).not.toHaveBeenCalled();
  });

  it('cliente de outra agência (ou inexistente) leva 404', async () => {
    cliente.mockReturnValue(null);
    expect((await GET(new Request('http://x'), ctx)).status).toBe(404);
    expect((await put({})).status).toBe(404);
    expect(salvar).not.toHaveBeenCalled();
  });

  it('id que não é uuid leva 400', async () => {
    const r = await GET(new Request('http://x'), { params: Promise.resolve({ clienteId: "1'; drop" }) });
    expect(r.status).toBe(400);
  });

  it('GET devolve o padrão desligado e nunca carrega chave nem segredo', async () => {
    config.mockResolvedValue({ openwa_key_cifrada: 'enc:segredo-do-openwa', openwa_webhook_id: 'w', modo: 'real', ligado: true });
    integ.mockResolvedValue({ id: 'i', provedor: 'calcom', api_base: 'https://api.cal.com', api_key_cifrada: 'enc:cal_live_x', webhook_token: 'tok', webhook_secret_cifrado: 'enc:hmac', calcom_webhook_id: 'cw', ativo: true });
    reservas.mockReturnValue(3);
    const corpo = await (await GET(new Request('http://x'), ctx)).json();
    expect(corpo.config).toMatchObject({ ligado: false, temChaveOpenwa: true });
    expect(corpo.agenda).toMatchObject({ ativo: true, temChave: true, webhookRegistrado: true });
    expect(corpo.reservasRecebidas).toBe(3);
    const texto = JSON.stringify(corpo);
    for (const proibido of ['enc:', 'segredo-do-openwa', 'cal_live_x', 'hmac', 'webhook_secret']) expect(texto).not.toContain(proibido);
  });

  it('PUT repassa só a agência do master, e devolve o erro de validação', async () => {
    salvar.mockResolvedValue({ ok: true, config: { ligado: false } });
    expect((await put({ modo: 'simulacao' })).status).toBe(200);
    expect(salvar.mock.calls[0].slice(1, 3)).toEqual(['ag1', CLIENTE]);
    salvar.mockResolvedValue({ ok: false, status: 400, erro: 'Modo inválido.' });
    const r = await put({ modo: 'x' });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Modo inválido.' });
  });
});
