import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const upsert = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert,
    })),
  },
}));
vi.mock('@/lib/whatsapp-shadow-engine', () => ({ sincronizarMensagemEAtualizarCrm: vi.fn() }));
vi.mock('@/lib/whatsapp-followup', () => ({
  cancelarFollowUpsDoLead: vi.fn(),
  agendarReguaFollowUp: vi.fn(),
}));

import { POST } from './route';
import { agendarReguaFollowUp } from '@/lib/whatsapp-followup';

const mensagem = {
  event: 'message',
  session: 'membro-ana',
  data: { id: 'm1', from: '5583999999999@c.us', fromMe: true, body: 'oi' },
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );

describe('POST /api/webhook/whatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPENWA_WEBHOOK_SECRET', 'wh');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('recusa chamada sem o segredo e não toca no banco', async () => {
    const res = await post(mensagem);
    expect(res.status).toBe(401);
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('recusa tudo em produção se o segredo não estiver configurado', async () => {
    vi.stubEnv('OPENWA_WEBHOOK_SECRET', '');
    const res = await post(mensagem, { 'x-openwa-secret': 'wh' });
    expect(res.status).toBe(503);
  });

  it('descarta mensagem de sessão desconhecida em vez de gravar na agência padrão', async () => {
    maybeSingle.mockResolvedValue({ data: null });
    const res = await post(mensagem, { 'x-openwa-secret': 'wh' });
    expect(await res.json()).toEqual({ ignored: 'unknown_session' });
    expect(upsert).not.toHaveBeenCalled();
    expect(agendarReguaFollowUp).not.toHaveBeenCalled();
  });

  it('grava na agência da sessão e guarda a sessão no follow-up', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 's1', agencia_id: 'ag-1', cliente_id: null, ia_escuta_ativa: false },
    });
    upsert.mockResolvedValue({ error: null });

    const res = await post(mensagem, { 'x-openwa-secret': 'wh' });

    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ agencia_id: 'ag-1' }), expect.anything());
    expect(agendarReguaFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({ agenciaId: 'ag-1', sessionName: 'membro-ana' })
    );
  });
});
