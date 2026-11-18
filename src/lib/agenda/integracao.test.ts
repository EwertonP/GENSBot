import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { validar, criar, apagar, cripto } = vi.hoisted(() => ({
  validar: vi.fn(),
  criar: vi.fn(),
  apagar: vi.fn(),
  cripto: { disponivel: true },
}));

vi.mock('./calcom-client', async () => {
  const real = await vi.importActual<typeof import('./calcom-client')>('./calcom-client');
  return { ...real, validarChaveCalcom: validar, criarWebhookCalcom: criar, apagarWebhookCalcom: apagar };
});
vi.mock('@/lib/cripto', () => ({
  segredoDisponivel: () => cripto.disponivel,
  criptografarSegredo: (t: string) => `enc:${t}`,
  descriptografarSegredo: (v?: string | null) => (v?.startsWith('enc:') ? v.slice(4) : null),
}));

import { conectarAgenda, desconectarAgenda, gerarCredenciaisWebhook, paraPublica } from './integracao';

type Linha = Record<string, unknown>;
let tabela: Linha | null;
let gravacoes: Linha[];

const db = {
  from: () => {
    const c: Record<string, unknown> = {};
    let op = 'select';
    let payload: Linha = {};
    Object.assign(c, {
      select: () => c,
      eq: () => c,
      upsert: (p: Linha) => ((op = 'upsert'), (payload = p), c),
      update: (p: Linha) => ((op = 'update'), (payload = p), c),
      maybeSingle: async () => ({ data: tabela }),
      single: async () => {
        if (op === 'upsert') {
          tabela = { id: 'i1', ...payload };
          gravacoes.push(payload);
          return { data: tabela, error: null };
        }
        return { data: tabela, error: null };
      },
      then: (resolve: (v: unknown) => void) => {
        if (op === 'update') {
          tabela = { ...tabela, ...payload };
          gravacoes.push(payload);
        }
        resolve({ error: null });
      },
    });
    return c;
  },
} as unknown as SupabaseClient;

const base = { db, agenciaId: 'ag1', clienteId: 'cl1', apiKey: 'cal_live_0123456789abcdef' };

beforeEach(() => {
  vi.clearAllMocks();
  tabela = null;
  gravacoes = [];
  cripto.disponivel = true;
  validar.mockResolvedValue({ ok: true, username: 'dralais' });
  criar.mockResolvedValue({ ok: true, id: 'wh-1' });
  apagar.mockResolvedValue(true);
});

describe('gerarCredenciaisWebhook', () => {
  it('token e segredo aleatórios e de bom tamanho', () => {
    const a = gerarCredenciaisWebhook();
    const b = gerarCredenciaisWebhook();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a.segredo).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.segredo).not.toBe(b.segredo);
  });
});

describe('conectarAgenda', () => {
  it('primeira conexão: confere a chave, cadastra o webhook e guarda tudo cifrado', async () => {
    const r = await conectarAgenda(base);
    expect(r).toMatchObject({ ok: true, usuario: 'dralais', integracao: { ativo: true, temChave: true, webhookRegistrado: true } });
    expect(validar).toHaveBeenCalledWith('https://api.cal.com', 'cal_live_0123456789abcdef');
    const salvo = gravacoes[0];
    expect(salvo.api_key_cifrada).toBe('enc:cal_live_0123456789abcdef');
    expect(String(salvo.webhook_secret_cifrado)).toMatch(/^enc:[0-9a-f]{64}$/);
    expect(salvo.calcom_webhook_id).toBe('wh-1');
    expect(criar.mock.calls[0][2].subscriberUrl).toBe(`https://allingens.vercel.app/api/webhook/agenda/${salvo.webhook_token}`);
  });

  it('a visão pública nunca traz chave nem segredo', async () => {
    const r = await conectarAgenda(base);
    const texto = JSON.stringify(r);
    expect(texto).not.toContain('cal_live_');
    expect(texto).not.toContain('enc:');
    expect(texto).not.toContain('webhook_secret');
  });

  it('chave recusada pelo Cal.com: nada é guardado', async () => {
    validar.mockResolvedValue({ ok: false, erro: 'A chave do Cal.com foi recusada.' });
    expect(await conectarAgenda(base)).toMatchObject({ ok: false, status: 400 });
    expect(gravacoes).toHaveLength(0);
    expect(criar).not.toHaveBeenCalled();
  });

  it('reconectar apaga o webhook antigo e mantém o token do endereço', async () => {
    await conectarAgenda(base);
    const tokenOriginal = gravacoes[0].webhook_token;
    criar.mockResolvedValue({ ok: true, id: 'wh-2' });
    await conectarAgenda({ ...base, apiKey: 'cal_live_outra_chave_0123456' });
    expect(apagar).toHaveBeenCalledWith('https://api.cal.com', 'cal_live_0123456789abcdef', 'wh-1');
    expect(gravacoes[1].webhook_token).toBe(tokenOriginal);
    expect(gravacoes[1].calcom_webhook_id).toBe('wh-2');
  });

  it('falha ao apagar o webhook antigo: conecta, mas avisa em vez de calar', async () => {
    await conectarAgenda(base);
    apagar.mockResolvedValue(false);
    criar.mockResolvedValue({ ok: true, id: 'wh-2' });
    const r = await conectarAgenda({ ...base, apiKey: 'cal_live_outra_chave_0123456' });
    expect(r).toMatchObject({ ok: true, aviso: expect.stringContaining('apagar o webhook antigo') });
    // Sem falha, não há aviso nenhum.
    apagar.mockResolvedValue(true);
    expect((await conectarAgenda(base)) as Record<string, unknown>).not.toHaveProperty('aviso');
  });

  it('Cal.com recusa o webhook: guarda inativa e avisa (502)', async () => {
    criar.mockResolvedValue({ ok: false, erro: 'O Cal.com recusou o cadastro do webhook (400).' });
    expect(await conectarAgenda(base)).toMatchObject({ ok: false, status: 502 });
    expect(gravacoes[0]).toMatchObject({ ativo: false, calcom_webhook_id: null });
  });

  it('valida a entrada: sem cifra, chave curta e endereço inseguro', async () => {
    cripto.disponivel = false;
    expect(await conectarAgenda(base)).toMatchObject({ ok: false, status: 503 });
    cripto.disponivel = true;
    expect(await conectarAgenda({ ...base, apiKey: 'curta' })).toMatchObject({ ok: false, status: 400 });
    expect(await conectarAgenda({ ...base, apiBase: 'http://10.0.0.5' })).toMatchObject({ ok: false, status: 400 });
    expect(validar).not.toHaveBeenCalled();
  });
});

describe('desconectarAgenda', () => {
  it('apaga o webhook, limpa os segredos e desativa', async () => {
    await conectarAgenda(base);
    const r = await desconectarAgenda({ db, agenciaId: 'ag1', clienteId: 'cl1' });
    expect(r).toMatchObject({ ok: true, integracao: null });
    expect(apagar).toHaveBeenCalledWith('https://api.cal.com', 'cal_live_0123456789abcdef', 'wh-1');
    expect(tabela).toMatchObject({ ativo: false, api_key_cifrada: null, webhook_secret_cifrado: null, calcom_webhook_id: null });
  });

  it('não conseguiu apagar no Cal.com: desativa mas não finge que terminou', async () => {
    await conectarAgenda(base);
    apagar.mockResolvedValue(false);
    const r = await desconectarAgenda({ db, agenciaId: 'ag1', clienteId: 'cl1' });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(tabela).toMatchObject({ ativo: false, calcom_webhook_id: 'wh-1' });
  });

  it('sem integração, não há o que desconectar', async () => {
    expect(await desconectarAgenda({ db, agenciaId: 'ag1', clienteId: 'cl1' })).toEqual({ ok: true, integracao: null });
  });
});

describe('paraPublica', () => {
  it('mostra só o que a tela precisa', () => {
    const p = paraPublica({ id: 'i', provedor: 'calcom', api_base: 'https://api.cal.com', api_key_cifrada: 'x', webhook_token: 'tok', webhook_secret_cifrado: 'y', calcom_webhook_id: null, ativo: false });
    expect(p).toEqual({ id: 'i', provedor: 'calcom', apiBase: 'https://api.cal.com', ativo: false, temChave: true, webhookRegistrado: false, urlWebhook: 'https://allingens.vercel.app/api/webhook/agenda/tok' });
  });
});
