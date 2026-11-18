import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consultarSessao, estaConectada, iniciarSessao } from './sessao';

const config = { url: 'https://wa.clinica.com.br', key: 'k', headers: { 'X-API-Key': 'k' } };
const chamadas: Array<{ metodo: string; caminho: string; corpo?: string; chave?: string }> = [];
let sessoes: Array<{ id: string; name: string; status: string }> = [];
let qr: string | null = null;
let listaFalha = false;

beforeEach(() => {
  chamadas.length = 0;
  sessoes = [];
  qr = null;
  listaFalha = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const caminho = url.replace(config.url, '');
      chamadas.push({ metodo: init.method ?? 'GET', caminho, corpo: init.body as string | undefined, chave: (init.headers as Record<string, string>)?.['X-API-Key'] });
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
      if (caminho === '/api/sessions' && (init.method ?? 'GET') === 'GET') return listaFalha ? json({}, 500) : json(sessoes);
      if (caminho === '/api/sessions' && init.method === 'POST') {
        const s = { id: 'uuid-1', name: JSON.parse(String(init.body)).name, status: 'created' };
        sessoes.push(s);
        return json(s);
      }
      if (caminho.endsWith('/start')) return json({});
      if (caminho.endsWith('/qr')) return qr ? json({ qrCode: qr }) : json({}, 404);
      return json({}, 404);
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

const rapido = { esperar: async () => {}, tentativasQr: 2 };

describe('estaConectada', () => {
  it('reconhece os estados conectados do OpenWA em qualquer caixa', () => {
    expect(estaConectada('ready')).toBe(true);
    expect(estaConectada('CONNECTED')).toBe(true);
    expect(estaConectada('qr_ready')).toBe(false);
    expect(estaConectada(undefined)).toBe(false);
  });
});

describe('consultarSessao', () => {
  it('sem sessão: não existe, e não cria nada', async () => {
    expect(await consultarSessao({ config, sessionName: 'cliente-lais' })).toEqual({ ok: true, existe: false, conectada: false, qr: null });
    expect(chamadas.every((c) => c.metodo === 'GET')).toBe(true);
  });
  it('aguardando leitura: devolve o QR; conectada: sem QR', async () => {
    sessoes = [{ id: 'u', name: 'cliente-lais', status: 'qr_ready' }];
    qr = 'data:image/png;base64,AAA';
    expect(await consultarSessao({ config, sessionName: 'cliente-lais' })).toMatchObject({ existe: true, conectada: false, qr });
    sessoes[0].status = 'ready';
    expect(await consultarSessao({ config, sessionName: 'cliente-lais' })).toMatchObject({ conectada: true, qr: null });
  });
  it('OpenWA fora do ar vira erro legível', async () => {
    listaFalha = true;
    expect(await consultarSessao({ config, sessionName: 'x' })).toMatchObject({ ok: false, erro: expect.stringContaining('500') });
  });
});

describe('iniciarSessao', () => {
  it('cria com o nome certo, liga e devolve o QR; usa só a chave do cliente', async () => {
    qr = 'data:image/png;base64,BBB';
    const r = await iniciarSessao({ config, sessionName: 'cliente-lais', ...rapido });
    expect(r).toEqual({ ok: true, existe: true, conectada: false, qr });
    expect(chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/sessions')?.corpo).toBe(JSON.stringify({ name: 'cliente-lais' }));
    expect(chamadas.some((c) => c.caminho === '/api/sessions/uuid-1/start')).toBe(true);
    expect(chamadas.every((c) => c.chave === 'k')).toBe(true);
  });
  it('sessão que já existe não é criada de novo', async () => {
    sessoes = [{ id: 'u', name: 'cliente-lais', status: 'stopped' }];
    await iniciarSessao({ config, sessionName: 'cliente-lais', ...rapido });
    expect(chamadas.filter((c) => c.metodo === 'POST' && c.caminho === '/api/sessions')).toHaveLength(0);
    expect(chamadas.some((c) => c.caminho === '/api/sessions/u/start')).toBe(true);
  });
  it('já conectada: não liga nem pede QR', async () => {
    sessoes = [{ id: 'u', name: 'cliente-lais', status: 'ready' }];
    expect(await iniciarSessao({ config, sessionName: 'cliente-lais', ...rapido })).toMatchObject({ conectada: true, qr: null });
    expect(chamadas.some((c) => c.caminho.endsWith('/start') || c.caminho.endsWith('/qr'))).toBe(false);
  });
  it('QR ainda não saiu: volta sem QR para a tela perguntar de novo', async () => {
    expect(await iniciarSessao({ config, sessionName: 'cliente-lais', ...rapido })).toEqual({ ok: true, existe: true, conectada: false, qr: null });
  });
  it('OpenWA recusa criar: erro', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string, init: RequestInit = {}) =>
      String(url).endsWith('/api/sessions') && init.method === 'POST' ? new Response('{}', { status: 400 }) : new Response('[]', { status: 200 })
    );
    expect(await iniciarSessao({ config, sessionName: 'x', ...rapido })).toMatchObject({ ok: false, erro: expect.stringContaining('400') });
  });
});
