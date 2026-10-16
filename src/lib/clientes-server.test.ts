import { describe, it, expect, vi, beforeEach } from 'vitest';

type Chamada = { tabela: string; metodo: string };
const chamadas: Chamada[] = [];
let membroNoBanco: unknown = null;
const getUser = vi.fn();

function cadeia(tabela: string, resultado: () => unknown) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_alvo, prop) {
      if (prop === 'then') return (ok: (v: unknown) => void) => ok(resultado());
      return () => {
        chamadas.push({ tabela, metodo: String(prop) });
        return proxy;
      };
    },
  });
  return proxy;
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (tabela: string) => cadeia(tabela, () => ({ data: membroNoBanco, error: null })) },
}));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    from: (tabela: string) => cadeia(tabela, () => ({ data: null, error: null })),
  }),
}));
vi.mock('@/lib/instagram-account', () => ({ listInstagramAccountsForUser: vi.fn() }));

import { getContextoAgencia } from './clientes-server';

const usuario = { id: 'u1', email: 'novo@exemplo.com', user_metadata: {} };
const escreveu = () => chamadas.some((c) => ['upsert', 'insert', 'update'].includes(c.metodo));

describe('getContextoAgencia', () => {
  beforeEach(() => {
    chamadas.length = 0;
    membroNoBanco = null;
    getUser.mockReset();
  });

  it('sem sessão devolve 401', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await getContextoAgencia();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('conta sem vínculo com agência recebe 403 e não vira master', async () => {
    getUser.mockResolvedValue({ data: { user: usuario } });
    membroNoBanco = null;

    const r = await getContextoAgencia();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
    expect(escreveu()).toBe(false);
  });

  it('membro inativo recebe 403 e não é reativado sozinho', async () => {
    getUser.mockResolvedValue({ data: { user: usuario } });
    membroNoBanco = { id: 'u1', agencia_id: 'ag-1', papel: 'membro', ativo: false };

    const r = await getContextoAgencia();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
    expect(escreveu()).toBe(false);
  });

  it('membro ativo entra normalmente', async () => {
    getUser.mockResolvedValue({ data: { user: usuario } });
    membroNoBanco = { id: 'u1', agencia_id: 'ag-1', papel: 'membro', ativo: true };

    const r = await getContextoAgencia();

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ctx.membro.agencia_id).toBe('ag-1');
  });
});
