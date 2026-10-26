import { describe, it, expect, vi, beforeEach } from 'vitest';

const cliente = vi.fn();
const insert = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((tabela: string) =>
      tabela === 'clientes'
        ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: cliente }) }) }) }
        : { insert: () => ({ select: () => ({ single: insert }) }) }
    ),
  },
}));

vi.mock('@/lib/clientes', () => ({
  ehUuid: (v: string) => /^[0-9a-f-]{36}$/i.test(v),
}));

vi.mock('@/lib/clientes-server', () => ({
  getContextoAgencia: vi.fn(),
  respostaErro: (erro: string, status: number) => Response.json({ error: erro }, { status }),
  respostaSeMembroEscopado: () => null,
  traduzirErroBanco: () => Response.json({ error: 'db' }, { status: 500 }),
}));

vi.mock('@/lib/whatsapp-sessions', async () => {
  const real = await vi.importActual<typeof import('@/lib/whatsapp-sessions')>('@/lib/whatsapp-sessions');
  return { ...real, carregarSessoesConectadas: vi.fn() };
});

vi.mock('@/lib/openwa-client', () => ({ enviarMensagemOpenWA: vi.fn() }));

import { POST } from './route';
import { getContextoAgencia } from '@/lib/clientes-server';
import { carregarSessoesConectadas } from '@/lib/whatsapp-sessions';
import { enviarMensagemOpenWA } from '@/lib/openwa-client';

const CLIENTE = '11111111-1111-1111-1111-111111111111';

const enviar = (body: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/whatsapp/messages', {
      method: 'POST',
      body: JSON.stringify({ telefone: '5583999999999', texto: 'oi', ...body }),
    })
  );

describe('POST /api/whatsapp/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContextoAgencia).mockResolvedValue({
      ok: true,
      ctx: { membro: { id: 'ana', agencia_id: 'ag-1', papel: 'master', cliente_id: null } },
    } as never);
    vi.mocked(carregarSessoesConectadas).mockResolvedValue([
      { session_name: 'membro-ana', membro_id: 'ana', cliente_id: null },
      { session_name: 'membro-bia', membro_id: 'bia', cliente_id: null },
    ]);
  });

  it('recusa cliente_id que não é da agência de quem envia', async () => {
    cliente.mockResolvedValue({ data: null });
    const res = await enviar({ cliente_id: CLIENTE });
    expect(res.status).toBe(404);
    expect(enviarMensagemOpenWA).not.toHaveBeenCalled();
  });

  it('recusa cliente_id mal formado', async () => {
    const res = await enviar({ cliente_id: '../outra-agencia' });
    expect(res.status).toBe(400);
    expect(enviarMensagemOpenWA).not.toHaveBeenCalled();
  });

  it('envia pela sessão do próprio membro, não pela de um colega', async () => {
    vi.mocked(enviarMensagemOpenWA).mockResolvedValue({ ok: true, messageId: 'm1' });
    insert.mockResolvedValue({ data: { id: 'x' }, error: null });

    const res = await enviar({});

    expect(res.status).toBe(200);
    expect(enviarMensagemOpenWA).toHaveBeenCalledWith(expect.objectContaining({ sessionName: 'membro-ana' }));
  });

  it('sem sessão disponível não tenta enviar', async () => {
    vi.mocked(carregarSessoesConectadas).mockResolvedValue([
      { session_name: 'membro-bia', membro_id: 'bia', cliente_id: null },
    ]);
    const res = await enviar({});
    expect(res.status).toBe(400);
    expect(enviarMensagemOpenWA).not.toHaveBeenCalled();
  });

  it('quando o envio falha devolve erro e não grava a mensagem como enviada', async () => {
    vi.mocked(enviarMensagemOpenWA).mockResolvedValue({ ok: false, erro: 'gateway fora' });
    const res = await enviar({});
    expect(res.status).toBe(502);
    expect(insert).not.toHaveBeenCalled();
  });
});
