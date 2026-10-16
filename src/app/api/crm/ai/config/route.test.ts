import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const maybeSingle = vi.fn();
const upsert = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle }), eq: () => ({ maybeSingle }) }) }),
      upsert: (payload: unknown) => ({ select: () => ({ single: () => upsert(payload) }) }),
    }),
  },
}));

vi.mock('@/lib/clientes-server', () => ({
  getContextoAgencia: vi.fn(async () => ({ ok: true, ctx: { membro: { agencia_id: 'ag-1' } } })),
  respostaErro: (erro: string, status: number) => Response.json({ error: erro }, { status }),
  traduzirErroBanco: () => Response.json({ error: 'db' }, { status: 500 }),
}));

import { GET, POST } from './route';
import { descriptografarSegredo } from '@/lib/cripto';

const salvar = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/crm/ai/config', { method: 'POST', body: JSON.stringify(body) }));

describe('/api/crm/ai/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AI_KEYS_SECRET', Buffer.alloc(32, 3).toString('base64'));
    upsert.mockImplementation(async (payload: Record<string, unknown>) => ({ data: { id: 'c1', ...payload }, error: null }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('GET nunca devolve a chave, só avisa que existe', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'c1', nome_agente: 'Ana', api_key: 'enc:v1:abc' }, error: null });

    const corpo = await (await GET(new Request('http://localhost/api/crm/ai/config'))).json();

    expect(corpo.api_key).toBeUndefined();
    expect(corpo.tem_api_key).toBe(true);
    expect(corpo.nome_agente).toBe('Ana');
  });

  it('POST grava a chave criptografada e não a devolve', async () => {
    const res = await salvar({ api_key: 'sk-secreta', nome_agente: 'Ana' });
    const gravado = upsert.mock.calls[0][0] as { api_key: string };

    expect(gravado.api_key).not.toContain('sk-secreta');
    expect(descriptografarSegredo(gravado.api_key)).toBe('sk-secreta');
    const corpo = await res.json();
    expect(corpo.api_key).toBeUndefined();
    expect(corpo.tem_api_key).toBe(true);
  });

  it('sem AI_KEYS_SECRET não salva a chave em texto puro', async () => {
    vi.stubEnv('AI_KEYS_SECRET', '');
    const res = await salvar({ api_key: 'sk-secreta', nome_agente: 'Ana' });
    expect(res.status).toBe(500);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('POST sem chave nova não mexe na chave já salva', async () => {
    await salvar({ nome_agente: 'Ana' });
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('api_key');
  });
});
