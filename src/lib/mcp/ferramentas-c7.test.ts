import { describe, it, expect, vi } from 'vitest';

// Supabase falso e genérico (mesmo padrão de ferramentas-c5/c6.test.ts), com `.insert()`
// síncrono: empurra a linha pra tabela e já vira o `rows` da cadeia, pra `.select().single()`
// devolver exatamente o que acabou de ser inserido (como o Supabase de verdade faz).
const tabelas: Record<string, Record<string, unknown>[]> = {};

function filtrar(rows: Record<string, unknown>[], coluna: string, op: 'eq' | 'in', valor: unknown) {
  return rows.filter((r) => (op === 'eq' ? r[coluna] === valor : (valor as unknown[]).includes(r[coluna])));
}

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    order: (col: string, opts: { ascending: boolean }) => {
      rows = [...rows].sort((a, b) => {
        const diff = String(a[col]).localeCompare(String(b[col]));
        return opts.ascending ? diff : -diff;
      });
      return chain;
    },
    limit: () => chain,
    eq: (col: string, val: unknown) => {
      rows = filtrar(rows, col, 'eq', val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = filtrar(rows, col, 'in', val);
      return chain;
    },
    insert: (values: Record<string, unknown>) => {
      (tabelas[nome] ||= []).push(values);
      rows = [values];
      return chain;
    },
    single: async () => (rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not exactly one row' } }),
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

import { FERRAMENTAS_C7 } from './ferramentas-c7';

const [criar, listar] = FERRAMENTAS_C7;
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const ctxMembro = { tokenId: 't', clientId: 'c', membroId: 'm2', agenciaId: 'ag1', papel: 'membro' as const, nome: 'Membro' };
const AUTO_ID = 'a1111111-1111-1111-1111-111111111111';
const AUTO_OUTRA_CONTA_ID = 'a2222222-2222-2222-2222-222222222222';

function seed() {
  tabelas.membros = [
    { id: 'm1', agencia_id: 'ag1' },
    { id: 'm2', agencia_id: 'ag1' },
  ];
  tabelas.instagram_accounts = [
    { id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude' },
    { id: 'ia2', user_id: 'm1', instagram_user_id: 'ig999', instagram_username: 'outraconta' },
  ];
  tabelas.automations = [
    { id: AUTO_ID, name: 'PMPE - Raio-X', active: false, user_id: 'm1', instagram_user_id: 'ig123' },
    { id: AUTO_OUTRA_CONTA_ID, name: 'Da outra conta', active: false, user_id: 'm1', instagram_user_id: 'ig999' },
  ];
  tabelas.utm_links = [];
}

describe('criar_link_utm', () => {
  it('gera a url com os parâmetros UTM e a url curta, com o fallback de origem', async () => {
    seed();
    const r = (await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com/curso', utm_source: 'instagram', utm_campaign: 'pmpe_raiox' }, ctxMaster)) as {
      url_com_utm: string;
      url_curta: string;
      url_destino: string;
    };
    expect(r.url_destino).toBe('https://exemplo.com/curso');
    expect(r.url_com_utm).toBe('https://exemplo.com/curso?utm_source=instagram&utm_campaign=pmpe_raiox');
    expect(r.url_curta).toMatch(/^https:\/\/allingens\.vercel\.app\/r\/[0-9a-f]{6}$/);
    expect(tabelas.utm_links).toHaveLength(1);
    expect(tabelas.utm_links[0]).toMatchObject({ instagram_user_id: 'ig123', user_id: 'm1' });
  });

  it('usa a origem do contexto (claude.ai) quando presente', async () => {
    seed();
    const r = (await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com' }, { ...ctxMaster, origem: 'https://claude.ai' })) as { url_curta: string };
    expect(r.url_curta?.startsWith('https://claude.ai/r/')).toBe(true);
  });

  it('base_url inválida é recusada', async () => {
    seed();
    await expect(criar.executar({ conta: 'edusaude', base_url: 'não é url' }, ctxMaster)).rejects.toThrow(/válida/);
  });

  it('base_url vazia é recusada antes de tentar criar', async () => {
    seed();
    await expect(criar.executar({ conta: 'edusaude', base_url: '' }, ctxMaster)).rejects.toThrow(/obrigatória/);
  });

  it('membro não pode criar link numa conta que não é dele', async () => {
    seed();
    await expect(criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com' }, ctxMembro)).rejects.toThrow(/contas que conectou/);
  });

  it('liga o link a uma automação da mesma conta', async () => {
    seed();
    const r = (await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com', automacao_id: AUTO_ID }, ctxMaster)) as { automacao_id: string | null };
    expect(r.automacao_id).toBe(AUTO_ID);
  });

  it('recusa ligar o link a uma automação de outra conta', async () => {
    seed();
    await expect(criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com', automacao_id: AUTO_OUTRA_CONTA_ID }, ctxMaster)).rejects.toThrow(/outra conta/);
  });
});

describe('listar_links_utm', () => {
  it('lista só os links da conta pedida', async () => {
    seed();
    await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com/a' }, ctxMaster);
    await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com/b', automacao_id: AUTO_ID }, ctxMaster);
    const r = (await listar.executar({ conta: 'edusaude' }, ctxMaster)) as { links: { url_destino: string }[] };
    expect(r.links.map((l) => l.url_destino).sort()).toEqual(['https://exemplo.com/a', 'https://exemplo.com/b']);
  });

  it('filtra por automacao_id', async () => {
    seed();
    await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com/a' }, ctxMaster);
    await criar.executar({ conta: 'edusaude', base_url: 'https://exemplo.com/b', automacao_id: AUTO_ID }, ctxMaster);
    const r = (await listar.executar({ conta: 'edusaude', automacao_id: AUTO_ID }, ctxMaster)) as { links: { url_destino: string }[] };
    expect(r.links).toHaveLength(1);
    expect(r.links[0].url_destino).toBe('https://exemplo.com/b');
  });
});
