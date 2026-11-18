import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  contexto: vi.fn(),
  cliente: vi.fn(),
  config: vi.fn(),
  sessao: vi.fn(),
  updates: [] as Array<{ tabela: string; campos: Record<string, unknown>; filtros: Record<string, unknown> }>,
  falharEscuta: { valor: false },
  resolver: vi.fn(),
  registrar: vi.fn(),
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
        maybeSingle: async () => ({ data: tabela === 'clientes' ? h.cliente() : tabela === 'whatsapp_sessions' ? h.sessao(filtros) : null }),
        then: (resolve: (v: unknown) => void) => {
          if (campos) h.updates.push({ tabela, campos, filtros });
          resolve({ error: tabela === 'whatsapp_sessions' && h.falharEscuta.valor ? { message: 'boom' } : null });
        },
      };
      return c;
    },
  },
}));
vi.mock('@/lib/atendimento/config', () => ({ lerConfig: h.config }));
vi.mock('@/lib/openwa-config', () => ({ configOpenWA: h.resolver }));
vi.mock('@/lib/openwa-webhook', () => ({ registrarWebhookOpenWA: h.registrar }));

import { POST } from './route';

const CLIENTE = '11111111-1111-1111-1111-111111111111';
const chamar = () => POST(new Request('https://preview-qualquer.vercel.app/x', { method: 'POST' }), { params: Promise.resolve({ clienteId: CLIENTE }) });

beforeEach(() => {
  vi.clearAllMocks();
  h.updates.length = 0;
  h.falharEscuta.valor = false;
  vi.stubEnv('OPENWA_WEBHOOK_SECRET', 'segredo-do-webhook-1234');
  h.contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel: 'master', agencia_id: 'ag1' } } });
  h.cliente.mockReturnValue({ id: CLIENTE });
  h.config.mockResolvedValue({ sessao_nome: 'cliente-lais' });
  h.sessao.mockReturnValue({ id: 'sess-1' });
  h.resolver.mockResolvedValue({ url: 'https://wa.clinica.com.br', key: 'k', headers: {}, origem: 'cliente' });
  h.registrar.mockResolvedValue({ ok: true, webhookId: 'wh-1', acao: 'criado' });
});

describe('POST /api/atendimento/[clienteId]/openwa-webhook', () => {
  it('só o master', async () => {
    h.contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel: 'membro', agencia_id: 'ag1' } } });
    expect((await chamar()).status).toBe(403);
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it('sem nome de sessão salvo: 400', async () => {
    h.config.mockResolvedValue({ sessao_nome: null });
    expect((await chamar()).status).toBe(400);
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it('sessão que não é deste cliente (ou não existe): 409, nada registrado, nada alterado', async () => {
    h.sessao.mockReturnValue(null);
    const r = await chamar();
    expect(r.status).toBe(409);
    expect(h.registrar).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it('a busca da sessão filtra por nome, cliente E agência', async () => {
    await chamar();
    expect(h.sessao).toHaveBeenCalledWith(expect.objectContaining({ session_name: 'cliente-lais', cliente_id: CLIENTE, agencia_id: 'ag1' }));
  });

  it('sem OpenWA próprio do cliente: 400 e jamais registra no OpenWA da agência', async () => {
    h.resolver.mockResolvedValue({ url: 'https://wa-agencia.exemplo.com', key: 'k', headers: {}, origem: 'ambiente' });
    const r = await chamar();
    expect(r.status).toBe(400);
    expect(h.registrar).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it('caminho feliz: desliga a escuta por IA, registra com a URL pública (não a do host da requisição) e guarda o id', async () => {
    const r = await chamar();
    expect(await r.json()).toMatchObject({ ok: true, acao: 'criado', origem: 'cliente', escutaIaDesligada: true });

    const escuta = h.updates.find((u) => u.tabela === 'whatsapp_sessions')!;
    expect(escuta.campos).toEqual({ ia_escuta_ativa: false });
    expect(escuta.filtros).toMatchObject({ id: 'sess-1', agencia_id: 'ag1' });

    const args = h.registrar.mock.calls[0][0];
    expect(args.webhookUrl).toBe('https://allingens.vercel.app/api/webhook/whatsapp?session=cliente-lais');
    expect(args.webhookUrl).not.toContain('preview-qualquer');
    expect(args.segredo).toBe('segredo-do-webhook-1234');

    expect(h.updates.find((u) => u.tabela === 'atendimento_config')!.campos).toMatchObject({ openwa_webhook_id: 'wh-1' });
  });

  it('não consegue desligar a escuta: 500 e o webhook não é cadastrado', async () => {
    h.falharEscuta.valor = true;
    expect((await chamar()).status).toBe(500);
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it('OpenWA recusa: 502 e o id do webhook não é gravado', async () => {
    h.registrar.mockResolvedValue({ ok: false, erro: 'OpenWA recusou o cadastro do webhook (400).' });
    expect((await chamar()).status).toBe(502);
    expect(h.updates.some((u) => u.tabela === 'atendimento_config')).toBe(false);
  });
});
