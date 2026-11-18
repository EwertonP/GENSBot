import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montarConfigOpenWA } from './openwa-client';
import { registrarWebhookOpenWA } from './openwa-webhook';

const config = montarConfigOpenWA('https://wa.clinica.com.br', 'k');
const URL_WH = 'https://allingens.vercel.app/api/webhook/whatsapp?session=cliente-1';
const UUID = '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a';

const resposta = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo }) as unknown as Response;
let chamadas: Array<{ url: string; method: string; body?: Record<string, unknown> }>;

function simular(rotas: { webhooks: unknown; criar?: unknown; statusCriar?: number }) {
  chamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      chamadas.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/api/sessions')) return resposta([{ id: UUID, name: 'cliente-1', status: 'ready' }]);
      if (url.includes('/webhooks') && method === 'GET') return resposta(rotas.webhooks);
      return resposta(rotas.criar ?? { id: 'wh-novo' }, rotas.statusCriar ?? 200);
    })
  );
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => vi.unstubAllGlobals());

describe('registrarWebhookOpenWA', () => {
  it('sessão sem webhook nosso: cria, com a URL com ?session=, o segredo em cabeçalho e os eventos de mensagem', async () => {
    simular({ webhooks: [] });
    const r = await registrarWebhookOpenWA({ sessionName: 'cliente-1', webhookUrl: URL_WH, segredo: 'seg-seg-seg-seg-1', config });
    expect(r).toEqual({ ok: true, webhookId: 'wh-novo', acao: 'criado' });
    const post = chamadas.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`https://wa.clinica.com.br/api/sessions/${UUID}/webhooks`);
    expect(post.body).toMatchObject({ url: URL_WH, events: ['message.received', 'message.sent'], headers: { 'x-openwa-secret': 'seg-seg-seg-seg-1' }, active: true });
  });

  it('já existe webhook para o mesmo endereço: atualiza e não duplica', async () => {
    simular({ webhooks: [{ id: 'wh-1', url: 'https://allingens.vercel.app/api/webhook/whatsapp?session=antigo' }], criar: { id: 'wh-1' } });
    const r = await registrarWebhookOpenWA({ sessionName: 'cliente-1', webhookUrl: URL_WH, segredo: 'seg-seg-seg-seg-1', config });
    expect(r).toEqual({ ok: true, webhookId: 'wh-1', acao: 'atualizado' });
    expect(chamadas.some((c) => c.method === 'POST')).toBe(false);
    expect(chamadas.find((c) => c.method === 'PUT')!.url).toContain('/webhooks/wh-1');
  });

  it('webhook de outro endereço na mesma sessão não é tocado', async () => {
    simular({ webhooks: [{ id: 'outro', url: 'https://outro.exemplo.com/hook' }] });
    const r = await registrarWebhookOpenWA({ sessionName: 'cliente-1', webhookUrl: URL_WH, segredo: 'seg-seg-seg-seg-1', config });
    expect(r).toMatchObject({ ok: true, acao: 'criado' });
    expect(chamadas.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('erros claros: sem segredo, sem endereço, sessão ausente e recusa do OpenWA', async () => {
    simular({ webhooks: [] });
    expect(await registrarWebhookOpenWA({ sessionName: 'cliente-1', webhookUrl: URL_WH, segredo: undefined, config })).toMatchObject({ ok: false, erro: expect.stringContaining('OPENWA_WEBHOOK_SECRET') });
    expect(await registrarWebhookOpenWA({ sessionName: 'cliente-1', webhookUrl: URL_WH, segredo: 'x'.repeat(16), config: montarConfigOpenWA(null, null) })).toMatchObject({ ok: false });
    expect(await registrarWebhookOpenWA({ sessionName: 'nao-existe', webhookUrl: URL_WH, segredo: 'x'.repeat(16), config })).toMatchObject({ ok: false, erro: expect.stringContaining('não encontrada') });
    simular({ webhooks: [], statusCriar: 400 });
    expect(await registrarWebhookOpenWA({ sessionName: 'cliente-1', webhookUrl: URL_WH, segredo: 'x'.repeat(16), config })).toMatchObject({ ok: false, erro: expect.stringContaining('400') });
  });
});
