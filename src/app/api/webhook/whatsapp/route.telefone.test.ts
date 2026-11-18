import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsert, cancelar, agendar, sincronizar, atender } = vi.hoisted(() => ({
  atender: vi.fn(),
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
vi.mock('@/lib/openwa-segredo', () => ({ segredoDaSessao: async () => null }));
vi.mock('@/lib/atendimento/assistente', () => ({ tratarMensagemDoPaciente: atender }));
vi.mock('@/lib/whatsapp-shadow-engine', () => ({ sincronizarMensagemEAtualizarCrm: sincronizar }));

import { POST } from './route';

const chamar = (data: Record<string, unknown>) =>
  POST(new Request('http://x/api/webhook/whatsapp', { method: 'POST', body: JSON.stringify({ event: 'message', session: 'cliente-1', data }) }));

// Formato real do OpenWA: evento com ponto, sessionId em UUID e o nome da sessão na URL cadastrada.
const chamarOpenWA = (evento: string, data: Record<string, unknown>) =>
  POST(
    new Request('http://x/api/webhook/whatsapp?session=cliente-1', {
      method: 'POST',
      body: JSON.stringify({ event: evento, sessionId: '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a', timestamp: '2026-11-18T10:00:00Z', data }),
    })
  );

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

  it('mensagem enviada por nós: o contato é o chatId, não o próprio número', async () => {
    await chamar({ id: 'c', fromMe: true, from: '5583988880000@c.us', to: '5583999990001@c.us', chatId: '5583999990001@c.us', body: 'olá' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ remetente: '5583999990001@c.us', de_mim: true });
    await rodarAdiados();
    expect(agendar).toHaveBeenCalledWith(expect.objectContaining({ telefone: '+5583999990001' }));
  });

  it('enviada por nós sem chatId: mantém o `from` de antes (nada muda para formatos antigos)', async () => {
    await chamar({ id: 'c2', fromMe: true, from: '5583999990001@c.us', body: 'olá' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ remetente: '5583999990001@c.us', de_mim: true });
  });

  it('formato real do OpenWA (message.received, sessionId e ?session=) é processado', async () => {
    const r = await chamarOpenWA('message.received', {
      id: 'true_5583999990001@c.us_3EB0',
      from: '5583999990001@c.us',
      chatId: '5583999990001@c.us',
      body: 'oi, quero marcar',
      fromMe: false,
      contact: { pushName: 'Maria' },
    });
    expect(await r.json()).toMatchObject({ processed: true });
    expect(upsert.mock.calls[0][0]).toMatchObject({ session_id: 's1', nome_contato: 'Maria', conteudo: 'oi, quero marcar' });
  });

  it('message.sent do OpenWA conta como mensagem nossa', async () => {
    await chamarOpenWA('message.sent', { id: 'x', chatId: '5583999990001@c.us', from: '5583988880000@c.us', fromMe: true, body: 'ok' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ de_mim: true, remetente: '5583999990001@c.us' });
  });

  it('outros eventos do OpenWA (ex.: session.status) não viram mensagem', async () => {
    await chamarOpenWA('session.status', { status: 'ready' });
    expect(upsert).not.toHaveBeenCalled();
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

describe('atendimento por IA no webhook', () => {
  it('mensagem de texto do paciente chama o assistente (depois da resposta), com a sessão e o contato', async () => {
    await chamarOpenWA('message.received', { id: 'p1', from: '5583999990001@c.us', body: 'quero marcar consulta', contact: { pushName: 'Maria' } });
    expect(atender).not.toHaveBeenCalled(); // roda em after(), não segura o gateway
    await rodarAdiados();
    expect(atender).toHaveBeenCalledWith(expect.objectContaining({ agenciaId: 'ag1', clienteId: 'cl1', remetente: '5583999990001@c.us', sessionName: 'cliente-1', texto: 'quero marcar consulta' }));
  });
  it('mensagem da secretária não chama o assistente', async () => {
    await chamarOpenWA('message.sent', { id: 's1', chatId: '5583999990001@c.us', fromMe: true, body: 'Olá!' });
    await rodarAdiados();
    expect(atender).not.toHaveBeenCalled();
  });
  it('falha do assistente não derruba o resto do processamento', async () => {
    atender.mockRejectedValueOnce(new Error('boom'));
    await chamarOpenWA('message.received', { id: 'p2', from: '5583999990001@c.us', body: 'oi' });
    await rodarAdiados();
    expect(sincronizar).toHaveBeenCalled();
  });
});
