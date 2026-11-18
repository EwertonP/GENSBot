import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsert, cancelar, agendar, sincronizar } = vi.hoisted(() => ({
  upsert: vi.fn(),
  cancelar: vi.fn(),
  agendar: vi.fn(),
  sincronizar: vi.fn(),
}));
const adiados: Array<() => Promise<void>> = [];

vi.mock('next/server', async () => {
  const real = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...real, after: (fn: () => Promise<void>) => void adiados.push(fn) };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'whatsapp_sessions') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 's1', agencia_id: 'ag1', cliente_id: 'cl1' } }) }) }),
        };
      }
      return {
        upsert: (...a: unknown[]) => ({ select: async () => ({ data: upsert(...a) }) }),
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }),
      };
    },
  },
}));
vi.mock('@/lib/segredos', () => ({ validarWebhookOpenWA: () => null }));

vi.mock('@/lib/whatsapp-followup', () => ({ cancelarFollowUpsDoLead: cancelar, agendarReguaFollowUp: agendar }));
vi.mock('@/lib/whatsapp-shadow-engine', () => ({ sincronizarMensagemEAtualizarCrm: sincronizar }));

import { POST } from './route';

const chamar = (data: Record<string, unknown>) =>
  POST(new Request('http://x/api/webhook/whatsapp', { method: 'POST', body: JSON.stringify({ event: 'message', session: 'cliente-1', data }) }));

async function rodarAdiados() {
  while (adiados.length) await adiados.shift()!();
}

beforeEach(() => {
  vi.clearAllMocks();
  adiados.length = 0;
  upsert.mockReturnValue([{ id: 'm1' }]);
});

describe('webhook do WhatsApp', () => {
  it('grava o JID sem mutilar (a regex antiga /D/g só apagava a letra D)', async () => {
    await chamar({ id: 'a', from: '5583999990001@c.us', body: 'oi' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ remetente: '5583999990001@c.us', de_mim: false });
  });

  it('mensagem do paciente cancela follow-up usando o telefone internacional', async () => {
    await chamar({ id: 'b', from: '5583999990001@c.us', body: 'oi' });
    await rodarAdiados();
    expect(cancelar).toHaveBeenCalledWith('ag1', '+5583999990001');
    expect(agendar).not.toHaveBeenCalled();
    expect(sincronizar).toHaveBeenCalledWith(expect.objectContaining({ remetenteTelefone: '+5583999990001' }));
  });

  it('mensagem enviada por nós: o contato é o destinatário, não o próprio número', async () => {
    await chamar({ id: 'c', fromMe: true, from: '5583988880000@c.us', to: '5583999990001@c.us', body: 'olá' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ remetente: '5583999990001@c.us', de_mim: true });
    await rodarAdiados();
    expect(agendar).toHaveBeenCalledWith(expect.objectContaining({ telefone: '+5583999990001' }));
  });

  it('@lid sem telefone: guarda a mensagem mas não cria lead nem follow-up', async () => {
    const r = await chamar({ id: 'd', from: '184730592839482@lid', body: 'oi' });
    expect(await r.json()).toMatchObject({ skipped: 'sem_telefone' });
    expect(upsert).toHaveBeenCalledTimes(1);
    await rodarAdiados();
    expect(cancelar).not.toHaveBeenCalled();
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('@lid com senderPhone (RESOLVE_LID_TO_PHONE) usa o telefone resolvido', async () => {
    await chamar({ id: 'e', from: '184730592839482@lid', senderPhone: '5583999990001', body: 'oi' });
    await rodarAdiados();
    expect(cancelar).toHaveBeenCalledWith('ag1', '+5583999990001');
  });

  it('mensagens de grupo e repetidas não processam', async () => {
    expect(await (await chamar({ id: 'f', from: '1203@g.us', body: 'x' })).json()).toMatchObject({ ignored: 'group_message' });
    upsert.mockReturnValue([]);
    expect(await (await chamar({ id: 'g', from: '5583999990001@c.us', body: 'x' })).json()).toMatchObject({ duplicate: true });
    await rodarAdiados();
    expect(cancelar).not.toHaveBeenCalled();
  });
});
