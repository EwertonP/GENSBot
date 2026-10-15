import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createUser, updateUserById, deleteUser, insertMembro } = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  insertMembro: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { admin: { createUser, updateUserById, deleteUser, listUsers: vi.fn() } },
    from: (tabela: string) =>
      tabela === 'agencias'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'ag-1' } }) }) }) }
        : { insert: insertMembro },
  },
}));

import { POST } from './route';

const cadastrar = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/auth/register', { method: 'POST', body: JSON.stringify(body) }));

const dados = { name: 'Maria', email: 'Maria@Clinica.com', password: 'segredo123' };

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('exige nome, e-mail e senha', async () => {
    expect((await cadastrar({ email: 'a@b.com' })).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('e-mail que já existe é recusado sem trocar a senha nem mexer na conta', async () => {
    createUser.mockResolvedValue({ data: null, error: { code: 'email_exists', message: 'already registered' } });

    const res = await cadastrar(dados);

    expect(res.status).toBe(409);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(insertMembro).not.toHaveBeenCalled();
  });

  it('cria o membro como "membro" e inativo, nunca como master', async () => {
    createUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    insertMembro.mockResolvedValue({ error: null });

    const res = await cadastrar(dados);

    expect(res.status).toBe(200);
    expect(insertMembro).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', agencia_id: 'ag-1', email: 'maria@clinica.com', papel: 'membro', ativo: false })
    );
  });

  it('se não conseguir registrar o membro, remove a conta criada no Auth', async () => {
    createUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    insertMembro.mockResolvedValue({ error: { message: 'falhou' } });

    const res = await cadastrar(dados);

    expect(res.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });
});
