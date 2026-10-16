import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { acharSessaoOpenWA, enviarMensagemOpenWA } from './openwa-client';

const sessoesGateway = [
  { id: 'uuid-ana', name: 'membro-ana', status: 'ready' },
  { id: 'uuid-bia', name: 'membro-bia', status: 'ready' },
];

describe('acharSessaoOpenWA', () => {
  it('encontra por nome exato, com hífen/underscore trocados ou por UUID', () => {
    expect(acharSessaoOpenWA(sessoesGateway, 'membro-ana')?.id).toBe('uuid-ana');
    expect(acharSessaoOpenWA([{ id: 'u1', name: 'cliente_x' }], 'cliente-x')?.id).toBe('u1');
    expect(acharSessaoOpenWA(sessoesGateway, 'uuid-bia')?.id).toBe('uuid-bia');
  });

  it('não cai em outra sessão ativa quando o nome não existe', () => {
    expect(acharSessaoOpenWA(sessoesGateway, 'membro-carla')).toBeNull();
    expect(acharSessaoOpenWA([], 'membro-carla')).toBeNull();
  });
});

describe('enviarMensagemOpenWA', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('OPENWA_API_URL', 'https://gw.test');
    vi.stubEnv('OPENWA_API_KEY', 'k');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('não envia nada quando a sessão não existe no gateway (não usa a de outro membro)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(sessoesGateway), { status: 200 }));

    const r = await enviarMensagemOpenWA({ sessionName: 'membro-carla', para: '5583999999999', texto: 'oi' });

    expect(r.ok).toBe(false);
    expect(r.erro).toContain('membro-carla');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.endsWith('/api/sessions'))).toBe(true);
  });

  it('envia pela sessão correta quando ela existe', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/sessions')) return new Response(JSON.stringify(sessoesGateway), { status: 200 });
      return new Response(JSON.stringify({ id: 'm1' }), { status: 200 });
    });

    const r = await enviarMensagemOpenWA({ sessionName: 'membro-bia', para: '5583999999999', texto: 'oi' });

    expect(r).toEqual({ ok: true, messageId: 'm1' });
    const envio = fetchMock.mock.calls.find((c) => String(c[0]).includes('/messages/send-text'));
    expect(String(envio?.[0])).toContain('/api/sessions/uuid-bia/messages/send-text');
  });
});
