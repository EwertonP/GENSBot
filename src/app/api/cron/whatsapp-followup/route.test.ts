import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const followupsPendentes = vi.fn();
const atualizar = vi.fn();
const inserirMensagem = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((tabela: string) => {
      if (tabela === 'whatsapp_followups') {
        return {
          select: () => ({ eq: () => ({ lte: () => ({ limit: followupsPendentes }) }) }),
          update: (dados: unknown) => ({ eq: (_c: string, id: string) => atualizar(dados, id) }),
        };
      }
      return { insert: inserirMensagem };
    }),
  },
}));

vi.mock('@/lib/whatsapp-sessions', async () => {
  const real = await vi.importActual<typeof import('@/lib/whatsapp-sessions')>('@/lib/whatsapp-sessions');
  return { ...real, carregarSessoesConectadas: vi.fn() };
});
vi.mock('@/lib/openwa-client', () => ({ enviarMensagemOpenWA: vi.fn() }));

import { GET } from './route';
import { carregarSessoesConectadas } from '@/lib/whatsapp-sessions';
import { enviarMensagemOpenWA } from '@/lib/openwa-client';

const chamar = (headers: Record<string, string> = {}) =>
  GET(new Request('http://localhost/api/cron/whatsapp-followup', { headers }));

const item = (extra: Record<string, unknown> = {}) => ({
  id: 'f1',
  agencia_id: 'ag-1',
  cliente_id: null,
  telefone: '5583999999999',
  mensagem: 'oi',
  etapa: 1,
  session_name: null,
  ...extra,
});

describe('GET /api/cron/whatsapp-followup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atualizar.mockResolvedValue({ error: null });
    inserirMensagem.mockResolvedValue({ error: null });
    vi.mocked(carregarSessoesConectadas).mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('em produção recusa quem não manda o segredo e não lê a fila', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 's3gredo');
    const res = await chamar();
    expect(res.status).toBe(401);
    expect(followupsPendentes).not.toHaveBeenCalled();
  });

  it('usa a sessão guardada no follow-up', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    followupsPendentes.mockResolvedValue({ data: [item({ session_name: 'membro-ana' })], error: null });
    vi.mocked(enviarMensagemOpenWA).mockResolvedValue({ ok: true, messageId: 'm1' });

    await chamar();

    expect(enviarMensagemOpenWA).toHaveBeenCalledWith(expect.objectContaining({ sessionName: 'membro-ana' }));
  });

  it('follow-up antigo sem sessão usa a geral da agência, nunca a de um membro', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    followupsPendentes.mockResolvedValue({ data: [item()], error: null });
    vi.mocked(carregarSessoesConectadas).mockResolvedValue([
      { session_name: 'membro-ana', membro_id: 'ana', cliente_id: null },
      { session_name: 'agencia-ag-1', membro_id: null, cliente_id: null },
    ]);
    vi.mocked(enviarMensagemOpenWA).mockResolvedValue({ ok: true, messageId: 'm1' });

    await chamar();

    expect(enviarMensagemOpenWA).toHaveBeenCalledWith(expect.objectContaining({ sessionName: 'agencia-ag-1' }));
  });

  it('sem nenhuma sessão adequada cancela o follow-up em vez de enviar por outro número', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    followupsPendentes.mockResolvedValue({ data: [item()], error: null });
    vi.mocked(carregarSessoesConectadas).mockResolvedValue([
      { session_name: 'membro-ana', membro_id: 'ana', cliente_id: null },
    ]);

    await chamar();

    expect(enviarMensagemOpenWA).not.toHaveBeenCalled();
    expect(atualizar).toHaveBeenCalledWith({ status: 'cancelado' }, 'f1');
  });
});
