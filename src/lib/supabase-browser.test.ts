import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateBrowserClient = vi.fn((_url?: string, _key?: string, _options?: any) => ({
  auth: {
    getUser: vi.fn(),
  },
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (url: string, key: string, options?: any) => mockCreateBrowserClient(url, key, options),
}));

describe('createSupabaseBrowserClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna a mesma instancia (singleton) em chamadas subsequentes no browser', async () => {
    // Simula ambiente de navegador
    (global as any).window = {};

    const { createSupabaseBrowserClient } = await import('./supabase-browser');

    const client1 = createSupabaseBrowserClient();
    const client2 = createSupabaseBrowserClient();

    expect(client1).toBe(client2);
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });
});
