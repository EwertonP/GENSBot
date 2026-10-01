import { describe, it, expect, vi } from 'vitest';

// Supabase falso e genérico: cada tabela tem um array de linhas; `.eq/.in/.gte/.lte`
// vão filtrando esse array igual a uma query real faria, e o fim da cadeia (await
// direto, ou `.maybeSingle()`) resolve com `{ data, error }`.
const tabelas: Record<string, Record<string, unknown>[]> = {};

function filtrar(rows: Record<string, unknown>[], coluna: string, op: 'eq' | 'in' | 'gte' | 'lte', valor: unknown) {
  return rows.filter((r) => {
    const v = r[coluna];
    if (op === 'eq') return v === valor;
    if (op === 'in') return (valor as unknown[]).includes(v);
    if (op === 'gte') return (v as string) >= (valor as string);
    if (op === 'lte') return (v as string) <= (valor as string);
    return true;
  });
}

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      rows = filtrar(rows, col, 'eq', val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = filtrar(rows, col, 'in', val);
      return chain;
    },
    gte: (col: string, val: unknown) => {
      rows = filtrar(rows, col, 'gte', val);
      return chain;
    },
    lte: (col: string, val: unknown) => {
      rows = filtrar(rows, col, 'lte', val);
      return chain;
    },
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

import { FERRAMENTAS_C5 } from './ferramentas-c5';

const metricas = FERRAMENTAS_C5[0];
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const ctxMembro = { tokenId: 't', clientId: 'c', membroId: 'm2', agenciaId: 'ag1', papel: 'membro' as const, nome: 'Membro' };

function seed() {
  tabelas.membros = [
    { id: 'm1', agencia_id: 'ag1' },
    { id: 'm2', agencia_id: 'ag1' },
  ];
  tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude' }];
  tabelas.automations = [
    { id: 'a1111111-1111-1111-1111-111111111111', name: 'PMPE - Raio-X', active: true, user_id: 'm1', instagram_user_id: 'ig123' },
    { id: 'a2222222-2222-2222-2222-222222222222', name: 'HUBRASIL - EBSERH', active: true, user_id: 'm2', instagram_user_id: 'ig123' },
  ];
  tabelas.analytics_events = [
    // a1: 4 comentários, 4 DMs, 2 cliques, 1 lead — dentro do período
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'comment', created_at: '2026-10-01T10:00:00Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'comment', created_at: '2026-10-01T10:01:00Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'comment', created_at: '2026-10-01T10:02:00Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'comment', created_at: '2026-10-01T10:03:00Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'welcome_dm_sent', created_at: '2026-10-01T10:00:05Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'welcome_dm_sent', created_at: '2026-10-01T10:01:05Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'welcome_dm_sent', created_at: '2026-10-01T10:02:05Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'welcome_dm_sent', created_at: '2026-10-01T10:03:05Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'link_clicked', created_at: '2026-10-01T10:10:00Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'link_clicked', created_at: '2026-10-01T10:11:00Z' },
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'lead_captured', created_at: '2026-10-01T10:15:00Z' },
    // fora do período (ano passado) — não pode contar
    { automation_id: 'a1111111-1111-1111-1111-111111111111', event_type: 'comment', created_at: '2025-01-01T10:00:00Z' },
    // a2: 1 lead só
    { automation_id: 'a2222222-2222-2222-2222-222222222222', event_type: 'lead_captured', created_at: '2026-10-01T09:00:00Z' },
  ];
  tabelas.contacts = [
    { last_automation_id: 'a1111111-1111-1111-1111-111111111111', email: 'x@y.com', phone: '+5581999998888' },
    { last_automation_id: 'a1111111-1111-1111-1111-111111111111', email: null, phone: null },
    { last_automation_id: 'a2222222-2222-2222-2222-222222222222', email: 'z@y.com', phone: null },
  ];
}

describe('metricas_automacao', () => {
  it('uma automação: funil, taxas e leads da audiência dentro do período', async () => {
    seed();
    const r = (await metricas.executar({ automacao_id: 'a1111111-1111-1111-1111-111111111111', desde: '2026-09-01', ate: '2026-10-31' }, ctxMaster)) as {
      automacao: { nome: string; conta: string };
      funil: Record<string, number>;
      taxas_de_conversao_percent: Record<string, number | null>;
      leads_na_audiencia: number;
      com_email_e_telefone: number;
    };
    expect(r.automacao).toMatchObject({ nome: 'PMPE - Raio-X', conta: 'edusaude' });
    expect(r.funil).toEqual({ comentarios: 4, mensagens_iniciais: 4, cliques_no_link: 2, leads_capturados: 1 });
    expect(r.taxas_de_conversao_percent).toEqual({ comentario_para_dm: 100, dm_para_clique: 50, clique_para_lead: 50, entrada_para_lead: 25 });
    expect(r.leads_na_audiencia).toBe(2);
    expect(r.com_email_e_telefone).toBe(1);
  });

  it('evento fora do período fica de fora da contagem', async () => {
    seed();
    const r = (await metricas.executar({ automacao_id: 'a1111111-1111-1111-1111-111111111111', desde: '2026-10-01', ate: '2026-10-02' }, ctxMaster)) as { funil: Record<string, number> };
    expect(r.funil.comentarios).toBe(4); // não conta o de 2025
  });

  it('membro não-master não vê automação de outro membro', async () => {
    seed();
    await expect(metricas.executar({ automacao_id: 'a1111111-1111-1111-1111-111111111111' }, ctxMembro)).rejects.toThrow('Automação não encontrada.');
  });

  it('automacao_id inválido é recusado antes de bater no banco', async () => {
    seed();
    await expect(metricas.executar({ automacao_id: 'não-é-uuid' }, ctxMaster)).rejects.toThrow(/uuid/);
  });

  it('sem automacao_id, lista o ranking da conta ordenado por leads capturados', async () => {
    seed();
    const r = (await metricas.executar({ conta: 'edusaude', desde: '2026-09-01', ate: '2026-10-31' }, ctxMaster)) as {
      automacoes: { nome: string; funil: { leads_capturados: number } }[];
    };
    expect(r.automacoes.map((a) => a.nome)).toEqual(['PMPE - Raio-X', 'HUBRASIL - EBSERH']);
    expect(r.automacoes[0].funil.leads_capturados).toBe(1);
  });

  it('sem automacao_id nem conta, recusa', async () => {
    seed();
    await expect(metricas.executar({}, ctxMaster)).rejects.toThrow(/automacao_id.*conta/);
  });

  it('"desde" depois de "ate" é recusado', async () => {
    seed();
    await expect(metricas.executar({ automacao_id: 'a1111111-1111-1111-1111-111111111111', desde: '2026-10-31', ate: '2026-10-01' }, ctxMaster)).rejects.toThrow(/antes/);
  });
});
