import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string } | null = { id: 'user-membro' };
let mockMembro: { papel: string } | null = { papel: 'membro' };

vi.mock('@/lib/auth-api', () => ({
  getAuthUser: vi.fn(async () => mockUser),
  unauthorizedResponse: () => Response.json({ error: 'Não autorizado.' }, { status: 401 }),
}));

function cadeia(resultado: () => any) {
  const proxy: any = new Proxy(() => undefined, {
    get(_alvo, prop) {
      if (prop === 'then') return (ok: (v: any) => void) => ok(resultado());
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'membros') {
        return cadeia(() => ({ data: mockMembro, error: null }));
      }
      return cadeia(() => ({ data: null, error: null }));
    },
  },
}));

vi.mock('@/lib/instagram-account', () => ({
  listInstagramAccountsForUser: vi.fn(async () => []),
}));

import { PATCH, DELETE } from './route';

describe('/api/contacts/[id] permissões', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-membro' };
    mockMembro = { papel: 'membro' };
  });

  it('retorna 403 ao tentar PATCH sendo membro colaborador', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/contacts/c1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Nome Atualizado' }),
      }),
      { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('somente-leitura');
  });

  it('retorna 403 ao tentar DELETE sendo membro colaborador', async () => {
    const res = await DELETE(
      new Request('http://localhost/api/contacts/c1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('não têm permissão para excluir');
  });
});
