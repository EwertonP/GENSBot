import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  contexto: vi.fn(),
  cliente: vi.fn(),
  config: vi.fn(),
  resolver: vi.fn(),
  existente: vi.fn(),
  iniciar: vi.fn(),
  consultar: vi.fn(),
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ campos: Record<string, unknown>; filtros: Record<string, unknown> }>,
}));

vi.mock('@/lib/clientes-server', () => ({
  getContextoAgencia: h.contexto,
  respostaErro: (erro: string, status: number) => Response.json({ error: erro }, { status }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const filtros: Record<string, unknown> = {};
      let campos: Record<string, unknown> | null = null;
      const c: Record<string, unknown> = {
        select: () => c,
        eq: (col: string, v: unknown) => ((filtros[col] = v), c),
        update: (x: Record<string, unknown>) => ((campos = x), c),
        insert: async (x: Record<string, unknown>) => (h.inserts.push(x), { error: null }),
        maybeSingle: async () => ({ data: tabela === 'clientes' ? h.cliente() : h.existente() }),
        then: (resolve: (v: unknown) => void) => {
          if (campos) h.updates.push({ campos, filtros });
          resolve({ error: null });
        },
      };
      return c;
    },
  },
}));
vi.mock('@/lib/atendimento/config', () => ({ lerConfig: h.config }));
vi.mock('@/lib/openwa-config', () => ({ configOpenWA: h.resolver }));
vi.mock('@/lib/atendimento/sessao', () => ({ iniciarSessao: h.iniciar, consultarSessao: h.consultar }));

import { GET, POST } from './route';

const CLIENTE = '11111111-1111-1111-1111-111111111111';
const ctx = { params: Promise.resolve({ clienteId: CLIENTE }) };
const req = (metodo: string) => new Request('http://x', { method: metodo });
const openwaCliente = { url: 'https://wa.clinica.com.br', key: 'k', headers: {}, origem: 'cliente' };

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.updates.length = 0;
  h.contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel: 'master', agencia_id: 'ag1' } } });
  h.cliente.mockReturnValue({ id: CLIENTE });
  h.config.mockResolvedValue({ sessao_nome: 'cliente-lais' });
  h.resolver.mockResolvedValue(openwaCliente);
  h.existente.mockReturnValue(null);
  h.iniciar.mockResolvedValue({ ok: true, existe: true, conectada: false, qr: 'data:image/png;base64,AAA' });
  h.consultar.mockResolvedValue({ ok: true, existe: true, conectada: true, qr: null });
});

describe('/api/atendimento/[clienteId]/sessao', () => {
  it('só o gestor', async () => {
    h.contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel: 'editor', agencia_id: 'ag1' } } });
    expect((await POST(req('POST'), ctx)).status).toBe(403);
    expect(h.iniciar).not.toHaveBeenCalled();
  });

  it('sem nome de sessão salvo: 400', async () => {
    h.config.mockResolvedValue({ sessao_nome: null });
    expect((await POST(req('POST'), ctx)).status).toBe(400);
  });

  it('sem OpenWA próprio do cliente: 400 e nunca mexe no da agência', async () => {
    h.resolver.mockResolvedValue({ ...openwaCliente, origem: 'ambiente' });
    expect((await POST(req('POST'), ctx)).status).toBe(400);
    expect(h.iniciar).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
  });

  it('POST: cadastra a linha deste cliente (escuta global desligada), liga pelo OpenWA do cliente e devolve o QR', async () => {
    const r = await POST(req('POST'), ctx);
    expect(await r.json()).toEqual({ existe: true, conectada: false, qr: 'data:image/png;base64,AAA', status: 'aguardando_qrcode' });
    expect(h.inserts[0]).toMatchObject({ agencia_id: 'ag1', cliente_id: CLIENTE, session_name: 'cliente-lais', ia_escuta_ativa: false, membro_id: null });
    expect(h.iniciar).toHaveBeenCalledWith(expect.objectContaining({ config: openwaCliente, sessionName: 'cliente-lais' }));
    expect(h.updates[0]).toMatchObject({ campos: { status: 'aguardando_qrcode' }, filtros: { session_name: 'cliente-lais', agencia_id: 'ag1', cliente_id: CLIENTE } });
  });

  it('nome de sessão que já é de outro cliente ou agência: 409, sem criar nem ligar', async () => {
    h.existente.mockReturnValue({ id: 's', agencia_id: 'ag1', cliente_id: 'outro-cliente' });
    expect((await POST(req('POST'), ctx)).status).toBe(409);
    h.existente.mockReturnValue({ id: 's', agencia_id: 'outra-agencia', cliente_id: CLIENTE });
    expect((await POST(req('POST'), ctx)).status).toBe(409);
    expect(h.inserts).toHaveLength(0);
    expect(h.iniciar).not.toHaveBeenCalled();
  });

  it('sessão já cadastrada deste cliente: não insere de novo', async () => {
    h.existente.mockReturnValue({ id: 's', agencia_id: 'ag1', cliente_id: CLIENTE });
    await POST(req('POST'), ctx);
    expect(h.inserts).toHaveLength(0);
    expect(h.iniciar).toHaveBeenCalled();
  });

  it('GET: só consulta (não cria) e marca conectado no banco', async () => {
    const r = await GET(req('GET'), ctx);
    expect(await r.json()).toEqual({ existe: true, conectada: true, qr: null, status: 'conectado' });
    expect(h.iniciar).not.toHaveBeenCalled();
    expect(h.updates[0].campos).toMatchObject({ status: 'conectado' });
  });

  it('OpenWA fora do ar: 502 e o status do banco não muda', async () => {
    h.consultar.mockResolvedValue({ ok: false, erro: 'O OpenWA respondeu 500 ao listar as sessões.' });
    const r = await GET(req('GET'), ctx);
    expect(r.status).toBe(502);
    expect(h.updates).toHaveLength(0);
  });
});
