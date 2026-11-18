import { afterEach, describe, expect, it, vi } from 'vitest';
import { apagarWebhookCalcom, apiBaseValida, criarWebhookCalcom, TRIGGERS_AGENDA, validarChaveCalcom } from './calcom-client';

afterEach(() => vi.unstubAllGlobals());

const resp = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo }) as unknown as Response;
const fetchFalso = (r: Response | Error) => {
  const f = vi.fn(async () => {
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal('fetch', f);
  return f;
};

describe('apiBaseValida', () => {
  it('aceita https com domínio e tira o caminho', () => {
    expect(apiBaseValida('https://api.cal.com/v2')).toBe('https://api.cal.com');
    expect(apiBaseValida(' https://api-agenda.dralaisleal.com.br ')).toBe('https://api-agenda.dralaisleal.com.br');
  });
  it('recusa http, IP, localhost, rede interna e lixo', () => {
    for (const ruim of ['http://api.cal.com', 'https://127.0.0.1', 'https://10.0.0.5:5555', 'https://localhost', 'https://servico.internal', 'https://[::1]', 'cal.com', '', null]) {
      expect(apiBaseValida(ruim as string)).toBeNull();
    }
  });
});

describe('validarChaveCalcom', () => {
  it('chave boa devolve o usuário e usa o cabeçalho de versão', async () => {
    const f = fetchFalso(resp({ status: 'success', data: { username: 'dralais' } }));
    expect(await validarChaveCalcom('https://api.cal.com', 'cal_live_x')).toEqual({ ok: true, username: 'dralais' });
    const init = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[0]).toBe('https://api.cal.com/v2/me');
    expect((init[1].headers as Record<string, string>)['cal-api-version']).toBe('2024-06-14');
  });
  it('chave errada, erro do servidor e falha de rede viram mensagens claras', async () => {
    fetchFalso(resp({}, 401));
    expect(await validarChaveCalcom('https://api.cal.com', 'x')).toMatchObject({ ok: false, erro: expect.stringContaining('recusada') });
    fetchFalso(resp({}, 500));
    expect(await validarChaveCalcom('https://api.cal.com', 'x')).toMatchObject({ ok: false, erro: expect.stringContaining('500') });
    fetchFalso(new Error('timeout'));
    expect(await validarChaveCalcom('https://api.cal.com', 'x')).toMatchObject({ ok: false, erro: expect.stringContaining('timeout') });
  });
});

describe('webhook no Cal.com', () => {
  it('cria com os gatilhos de reserva e devolve o id', async () => {
    const f = fetchFalso(resp({ status: 'success', data: { id: 'wh-1' } }));
    expect(await criarWebhookCalcom('https://api.cal.com', 'k', { subscriberUrl: 'https://x/api/webhook/agenda/t', secret: 's' })).toEqual({ ok: true, id: 'wh-1' });
    const corpo = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo).toEqual({ subscriberUrl: 'https://x/api/webhook/agenda/t', triggers: TRIGGERS_AGENDA, active: true, secret: 's' });
  });
  it('recusa do Cal.com e resposta sem id são erros', async () => {
    fetchFalso(resp({}, 400));
    expect(await criarWebhookCalcom('https://api.cal.com', 'k', { subscriberUrl: 'u', secret: 's' })).toMatchObject({ ok: false });
    fetchFalso(resp({ data: {} }));
    expect(await criarWebhookCalcom('https://api.cal.com', 'k', { subscriberUrl: 'u', secret: 's' })).toMatchObject({ ok: false });
  });
  it('apagar: sucesso e 404 contam como apagado; erro não', async () => {
    fetchFalso(resp({}, 200));
    expect(await apagarWebhookCalcom('https://api.cal.com', 'k', 'wh-1')).toBe(true);
    fetchFalso(resp({}, 404));
    expect(await apagarWebhookCalcom('https://api.cal.com', 'k', 'wh-1')).toBe(true);
    fetchFalso(resp({}, 500));
    expect(await apagarWebhookCalcom('https://api.cal.com', 'k', 'wh-1')).toBe(false);
    fetchFalso(new Error('rede'));
    expect(await apagarWebhookCalcom('https://api.cal.com', 'k', 'wh-1')).toBe(false);
  });
});
