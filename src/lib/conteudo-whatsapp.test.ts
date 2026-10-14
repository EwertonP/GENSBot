import { describe, expect, it, vi, beforeEach } from 'vitest';
import { notificarGrupoAprovacaoConteudo } from './conteudo-whatsapp';

// Mock de serviceSupabase e enviarMensagemOpenWA
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

vi.mock('@/lib/openwa-client', () => {
  return {
    enviarMensagemOpenWA: vi.fn().mockResolvedValue({ ok: true, messageId: 'msg-123' }),
  };
});

describe('notificarGrupoAprovacaoConteudo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloqueia envio duplicado imediato (cooldown de 15 segundos)', async () => {
    const { supabase } = await import('@/lib/supabase');
    const { enviarMensagemOpenWA } = await import('@/lib/openwa-client');

    const fakeCliente = {
      id: 'cli-123',
      nome: 'Cliente Teste',
      whatsapp_grupo_id: '1203630283921@g.us',
      contatos: [],
    };

    const fakeSessoes = [
      {
        session_name: 'sessao-ewerton',
        membro_id: 'mem-1',
        cliente_id: null,
        status: 'conectado',
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === 'clientes') {
            return { data: fakeCliente, error: null };
          }
          return { data: null, error: null };
        }),
      };

      if (table === 'whatsapp_sessions') {
        builder.eq = vi.fn().mockImplementation((col: string, val: string) => {
          if (col === 'status' && val === 'conectado') {
            return Promise.resolve({ data: fakeSessoes, error: null });
          }
          return builder;
        });
      }

      return builder;
    });

    // 1º envio: deve disparar com sucesso
    const r1 = await notificarGrupoAprovacaoConteudo({
      agenciaId: 'ag-1',
      clienteId: 'cli-123',
      conteudoId: 'post-test-anti-dup',
      tituloPost: 'Post Anti Dup',
      tokenAprovacao: 'token-123',
      remetenteId: 'mem-1',
    });

    expect(r1.ok).toBe(true);
    expect(r1.enviado).toBe(true);
    expect(enviarMensagemOpenWA).toHaveBeenCalledTimes(1);

    // 2º envio imediato para o mesmo post: deve ser barrado pelo cooldown para evitar duplicação
    const r2 = await notificarGrupoAprovacaoConteudo({
      agenciaId: 'ag-1',
      clienteId: 'cli-123',
      conteudoId: 'post-test-anti-dup',
      tituloPost: 'Post Anti Dup',
      tokenAprovacao: 'token-123',
      remetenteId: 'mem-1',
    });

    expect(r2.ok).toBe(true);
    expect(r2.enviado).toBe(false);
    expect(r2.jaEnviadoRecentemente).toBe(true);
    expect(enviarMensagemOpenWA).toHaveBeenCalledTimes(1); // Não chamou uma 2ª vez!

    // 3º envio com forcarReenvio = true: deve disparar
    const r3 = await notificarGrupoAprovacaoConteudo({
      agenciaId: 'ag-1',
      clienteId: 'cli-123',
      conteudoId: 'post-test-anti-dup',
      tituloPost: 'Post Anti Dup',
      tokenAprovacao: 'token-123',
      remetenteId: 'mem-1',
      forcarReenvio: true,
    });

    expect(r3.ok).toBe(true);
    expect(r3.enviado).toBe(true);
    expect(enviarMensagemOpenWA).toHaveBeenCalledTimes(2);
  });
});
