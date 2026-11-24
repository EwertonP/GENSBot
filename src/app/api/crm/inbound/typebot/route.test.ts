import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const insert = vi.fn();
const update = vi.fn();
let existentes: unknown[] = [];

vi.mock('@/lib/crm', async () => ({
  normalizarWhatsApp: (t: string) => { const d = t.replace(/\D/g, ''); return !d ? '' : d.startsWith('55') && d.length >= 12 ? d : `55${d}`; },
  garantirPipelinePadrao: vi.fn(async () => ({ id: 'p1', estagios: [{ id: 'e1' }] })),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((tabela: string) => {
      if (tabela === 'agencias') return { select: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 'ag1' } }) }) }) };
      if (tabela === 'crm_negocios') {
        const chain: any = { eq: () => chain, in: () => chain, order: () => chain, limit: async () => ({ data: existentes }) };
        return {
          select: () => chain,
          update: (v: unknown) => { update(v); return { eq: async () => ({}) }; },
          insert: (v: unknown) => { insert('negocio', v); return { select: () => ({ single: async () => ({ data: { id: 'n1' }, error: null }) }) }; },
        };
      }
      return { insert: async (v: unknown) => { insert('atividade', v); return {}; } };
    }),
  },
}));

import { POST } from './route';

const post = (body: unknown, headers: Record<string, string> = { 'x-gens-secret': 'seg' }) =>
  POST(new Request('http://localhost/api/crm/inbound/typebot', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
const lead = { nome: 'Ana', whatsapp: '(83) 99999-0000', dor: 'Não aparece no Google', nicho: 'Dermatologia', faturamento: '30 mil', investimento: '3 mil', como_conheceu: 'Instagram', instagram: '@ana.derm', tamanho_empresa: 'Profissional Liberal' };

describe('POST /api/crm/inbound/typebot', () => {
  beforeEach(() => { vi.clearAllMocks(); existentes = []; vi.stubEnv('CRM_INBOUND_TYPEBOT_SECRET', 'seg'); });
  afterEach(() => vi.unstubAllEnvs());

  it('sem segredo configurado falha fechado', async () => {
    vi.stubEnv('CRM_INBOUND_TYPEBOT_SECRET', '');
    expect((await post(lead)).status).toBe(503);
  });
  it('segredo errado ou ausente: 401', async () => {
    expect((await post(lead, { 'x-gens-secret': 'errado' })).status).toBe(401);
    expect((await post(lead, {})).status).toBe(401);
  });
  it('exige nome e WhatsApp válidos', async () => {
    expect((await post({ ...lead, nome: ' ' })).status).toBe(400);
    expect((await post({ ...lead, whatsapp: '123' })).status).toBe(400);
  });
  it('cria negócio com as respostas na linha do tempo', async () => {
    const res = await post(lead);
    expect(res.status).toBe(201);
    const [, negocio] = insert.mock.calls.find((c) => c[0] === 'negocio')!;
    expect(negocio).toMatchObject({ telefone: '5583999990000', origem: 'site', estagio_id: 'e1', tags: ['Typebot', 'Nicho: Dermatologia'] });
    const [, atividades] = insert.mock.calls.find((c) => c[0] === 'atividade')!;
    expect((atividades as { descricao: string }[])[1].descricao).toContain('Dor: Não aparece no Google');
    expect((atividades as { descricao: string }[])[1].descricao).toContain('Tamanho da empresa: Profissional Liberal');
    expect(negocio).toMatchObject({ instagram_username: 'ana.derm' });
  });
  it('mesmo telefone em negócio aberto atualiza e não duplica', async () => {
    existentes = [{ id: 'n9', tags: ['x'] }];
    const res = await post(lead);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ negocioId: 'n9', duplicado: true });
    expect(insert.mock.calls.some((c) => c[0] === 'negocio')).toBe(false);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ tags: ['x', 'Typebot'] }));
  });
});
