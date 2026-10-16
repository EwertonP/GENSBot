import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const upsert = vi.fn();
const maybeSingle = vi.fn();
const depois: Promise<unknown>[] = [];

vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  // roda o trabalho "pós-resposta" na hora e deixa o teste esperar por ele
  after: (fn: () => Promise<void>) => {
    depois.push(Promise.resolve(fn()));
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle, eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }),
      }),
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
import { agendarReguaFollowUp, cancelarFollowUpsDoLead } from '@/lib/whatsapp-followup';
import { sincronizarMensagemEAtualizarCrm } from '@/lib/whatsapp-shadow-engine';

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

const sessao = { id: 's1', agencia_id: 'ag-1', cliente_id: null, ia_escuta_ativa: true };
const insercao = (linhas: unknown[]) => ({ select: async () => ({ data: linhas }) });

describe('POST /api/webhook/whatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    depois.length = 0;
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
    maybeSingle.mockResolvedValue({ data: { ...sessao, ia_escuta_ativa: false } });
    upsert.mockReturnValue(insercao([{ id: 'x' }]));

    const res = await post(mensagem, { 'x-openwa-secret': 'wh' });
    await Promise.all(depois);

    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ agencia_id: 'ag-1' }),
      expect.objectContaining({ ignoreDuplicates: true })
    );
    expect(agendarReguaFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({ agenciaId: 'ag-1', sessionName: 'membro-ana' })
    );
  });

  it('evento repetido pelo gateway não dispara follow-up nem IA de novo', async () => {
    maybeSingle.mockResolvedValue({ data: sessao });
    upsert.mockReturnValue(insercao([])); // já existia: nada inserido

    const res = await post(mensagem, { 'x-openwa-secret': 'wh' });
    await Promise.all(depois);

    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(depois).toHaveLength(0);
    expect(agendarReguaFollowUp).not.toHaveBeenCalled();
    expect(cancelarFollowUpsDoLead).not.toHaveBeenCalled();
    expect(sincronizarMensagemEAtualizarCrm).not.toHaveBeenCalled();
  });

  it('responde antes de a IA terminar e a análise roda no pós-resposta', async () => {
    maybeSingle.mockResolvedValue({ data: sessao });
    upsert.mockReturnValue(insercao([{ id: 'x' }]));
    let liberarIA: () => void = () => undefined;
    vi.mocked(sincronizarMensagemEAtualizarCrm).mockImplementation(
      () => new Promise<undefined>((ok) => { liberarIA = () => ok(undefined); })
    );

    const res = await post(mensagem, { 'x-openwa-secret': 'wh' });

    expect(res.status).toBe(200); // resposta saiu mesmo com a IA ainda "pensando"
    expect(depois).toHaveLength(1);
    await vi.waitFor(() => expect(sincronizarMensagemEAtualizarCrm).toHaveBeenCalled());
    liberarIA();
    await Promise.all(depois);
    expect(sincronizarMensagemEAtualizarCrm).toHaveBeenCalled();
  });
});
