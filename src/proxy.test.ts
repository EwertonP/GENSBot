import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

import { proxy, config } from './proxy';

describe('proxy middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('config matcher exclui rotas api, estaticos e imagens', () => {
    const matcherPattern = config.matcher[0];
    const regex = new RegExp(`^${matcherPattern}$`);

    // Deve ignorar (não dar match)
    expect(regex.test('/api/conteudo/123')).toBe(false);
    expect(regex.test('/api/clientes')).toBe(false);
    expect(regex.test('/_next/static/chunks/main.js')).toBe(false);
    expect(regex.test('/favicon.ico')).toBe(false);
    expect(regex.test('/logo.png')).toBe(false);

    // Deve dar match (rotas de pagina que precisam de proxy)
    expect(regex.test('/')).toBe(true);
    expect(regex.test('/login')).toBe(true);
    expect(regex.test('/register')).toBe(true);
  });

  it('ignora requisicoes para /api sem invocar getUser()', async () => {
    const req = new NextRequest('http://localhost:3000/api/conteudo/item-123', {
      method: 'DELETE',
    });

    const res = await proxy(req);

    // Não deve chamar getUser nem criar cliente desnecessário
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('ignora requisicoes para rotas publicas (/aprovacao, /relatorio, etc.) sem chamar getUser()', async () => {
    const req = new NextRequest('http://localhost:3000/aprovacao/token-xyz-123');

    const res = await proxy(req);

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redireciona para /login se usuario nao autenticado acessar rota protegida', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new NextRequest('http://localhost:3000/');
    const res = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('permite acesso a rota protegida quando usuario esta autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } } });

    const req = new NextRequest('http://localhost:3000/');
    const res = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redireciona para / se usuario autenticado tentar acessar /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } } });

    const req = new NextRequest('http://localhost:3000/login');
    const res = await proxy(req);

    expect(mockGetUser).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });
});
