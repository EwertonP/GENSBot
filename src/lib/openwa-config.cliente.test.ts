import { beforeEach, describe, expect, it, vi } from 'vitest';

const { maybeSingle, eq } = vi.hoisted(() => ({ maybeSingle: vi.fn(), eq: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => {
      const c: Record<string, unknown> = {
        select: () => c,
        eq: (...a: unknown[]) => (eq(...a), c),
        maybeSingle,
      };
      return c;
    },
  },
}));
vi.mock('./cripto', () => ({ descriptografarSegredo: (v?: string | null) => (v === 'ilegivel' ? null : v ? `claro:${v}` : null) }));

import { configOpenWA } from './openwa-config';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENWA_API_URL', 'https://wa-agencia.exemplo.com');
  vi.stubEnv('OPENWA_API_KEY', 'chave-da-agencia');
});

describe('configOpenWA', () => {
  it('sem cliente, usa o ambiente e não toca no banco', async () => {
    const c = await configOpenWA();
    expect(c).toMatchObject({ url: 'https://wa-agencia.exemplo.com', key: 'chave-da-agencia', origem: 'ambiente' });
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('cliente sem linha ou sem URL própria cai no ambiente', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await configOpenWA({ clienteId: 'c1' })).origem).toBe('ambiente');
    maybeSingle.mockResolvedValueOnce({ data: { openwa_url: null, openwa_key_cifrada: null }, error: null });
    expect((await configOpenWA({ clienteId: 'c1' })).origem).toBe('ambiente');
  });

  it('cliente com OpenWA próprio usa o dele, com a chave decifrada', async () => {
    maybeSingle.mockResolvedValue({ data: { openwa_url: 'wa.clinica.com.br', openwa_key_cifrada: 'enc' }, error: null });
    const c = await configOpenWA({ clienteId: 'c1', agenciaId: 'ag1' });
    expect(c).toMatchObject({ url: 'https://wa.clinica.com.br', key: 'claro:enc', origem: 'cliente' });
    expect(eq).toHaveBeenCalledWith('agencia_id', 'ag1');
  });

  it('chave do cliente ilegível: erro, nunca cai no OpenWA da agência', async () => {
    maybeSingle.mockResolvedValue({ data: { openwa_url: 'wa.clinica.com.br', openwa_key_cifrada: 'ilegivel' }, error: null });
    await expect(configOpenWA({ clienteId: 'c1' })).rejects.toThrow(/não pôde ser lida/);
  });

  it('erro de banco: erro, nunca cai no ambiente', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(configOpenWA({ clienteId: 'c1' })).rejects.toThrow(/boom/);
  });
});
