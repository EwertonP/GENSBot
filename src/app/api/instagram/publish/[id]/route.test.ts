import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';

vi.mock('@/lib/auth-api', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('@/lib/instagram-account', () => ({
  getAccountForUserOrAgency: vi.fn(),
}));

vi.mock('@/lib/best-posting-time', () => ({
  getBestPostingTimes: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { getAuthUser } from '@/lib/auth-api';
import { getAccountForUserOrAgency } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';

describe('DELETE /api/instagram/publish/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna 401 quando o usuário não estiver autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/instagram/publish/post-123', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'post-123' }) });

    expect(res.status).toBe(401);
  });

  it('retorna 404 quando o post não for encontrado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user_1' } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as any);

    const req = new Request('http://localhost:3000/api/instagram/publish/post-999', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'post-999' }) });

    expect(res.status).toBe(404);
  });

  it('exclui post agendado e atualiza esteira', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user_1' } as any);
    vi.mocked(getAccountForUserOrAgency).mockResolvedValue({ id: 'acc_1' } as any);

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const updateEsteiraMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'scheduled_posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'post-123', user_id: 'user_1', instagram_user_id: 'ig_1', status: 'scheduled' },
                error: null,
              }),
            }),
          }),
          delete: deleteMock,
        } as any;
      }
      if (table === 'conteudo_items') {
        return {
          update: updateEsteiraMock,
        } as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost:3000/api/instagram/publish/post-123', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'post-123' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deleted).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(updateEsteiraMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_post_id: null,
        data_programada: null,
        status: 'agendamento',
      })
    );
  });

  it('permite excluir post já publicado do histórico', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user_1' } as any);
    vi.mocked(getAccountForUserOrAgency).mockResolvedValue({ id: 'acc_1' } as any);

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const updateEsteiraMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'scheduled_posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'post-published-1', user_id: 'user_1', instagram_user_id: 'ig_1', status: 'published' },
                error: null,
              }),
            }),
          }),
          delete: deleteMock,
        } as any;
      }
      if (table === 'conteudo_items') {
        return {
          update: updateEsteiraMock,
        } as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost:3000/api/instagram/publish/post-published-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'post-published-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deleted).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    // Não deve sobrescrever o status publicado na esteira
    expect(updateEsteiraMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_post_id: null,
      })
    );
  });
});
