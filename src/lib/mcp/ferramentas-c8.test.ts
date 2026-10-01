import { describe, it, expect, vi } from 'vitest';

// Supabase falso e genérico (mesmo padrão de ferramentas-c5/c6/c7.test.ts), com `.or()`
// a mais: entende "coluna.eq.valor,coluna.ilike.valor" (como o próprio código monta) e
// mantém as linhas que batem em QUALQUER cláusula — mesma semântica do PostgREST.
const tabelas: Record<string, Record<string, unknown>[]> = {};

function bateClausula(row: Record<string, unknown>, clausula: string): boolean {
  const [col, op, ...resto] = clausula.split('.');
  const valor = resto.join('.');
  const v = row[col];
  if (op === 'eq') return v === valor;
  if (op === 'ilike') return typeof v === 'string' && v.toLowerCase() === valor.toLowerCase();
  return false;
}

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    order: (col: string, opts?: { ascending?: boolean }) => {
      rows = [...rows].sort((a, b) => {
        const diff = String(a[col]).localeCompare(String(b[col]));
        return opts?.ascending === false ? -diff : diff;
      });
      return chain;
    },
    limit: (n: number) => {
      rows = rows.slice(0, n);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = rows.filter((r) => val.includes(r[col]));
      return chain;
    },
    or: (expr: string) => {
      const clausulas = expr.split(',');
      rows = rows.filter((r) => clausulas.some((c) => bateClausula(r, c)));
      return chain;
    },
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

import { FERRAMENTAS_C8 } from './ferramentas-c8';

const ler = FERRAMENTAS_C8[0];
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const AUTO_ID = 'a1111111-1111-1111-1111-111111111111';

function seed() {
  tabelas.membros = [{ id: 'm1', agencia_id: 'ag1' }];
  tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude' }];
  tabelas.automations = [{ id: AUTO_ID, name: 'PMPE - Raio-X', active: true, user_id: 'm1', instagram_user_id: 'ig123' }];
  tabelas.contacts = [
    {
      instagram_id: '999888777',
      instagram_user_id: 'ig123',
      name: 'Fulano da Silva',
      username: 'fulano.silva',
      email: 'fulano@gmail.com',
      phone: '+5581999998888',
      notes: 'Já tinha interesse antes',
      tags: ['PMPE', 'quente'],
      flow_state: { cargo: 'Soldado', _capture: { field: 'email' } },
      last_response_at: '2026-10-01T12:00:00Z',
      first_contact_at: '2026-09-30T10:00:00Z',
      last_automation_id: AUTO_ID,
      updated_at: '2026-10-01T12:00:00Z',
    },
    // mesma pessoa em OUTRA conta — não pode aparecer na busca pela conta errada
    { instagram_id: '999888777', instagram_user_id: 'ig999', name: 'Fulano', username: null, flow_state: {}, tags: [], updated_at: '2026-10-01T12:00:00Z' },
    // @ pendente: username igual ao próprio instagram_id
    { instagram_id: '111222333', instagram_user_id: 'ig123', name: null, username: '111222333', flow_state: {}, tags: [], updated_at: '2026-09-01T00:00:00Z' },
  ];
  tabelas.analytics_events = [
    { instagram_user_id: 'ig123', contact_id: '999888777', automation_id: AUTO_ID, event_type: 'comment', created_at: '2026-09-30T10:00:00Z' },
    { instagram_user_id: 'ig123', contact_id: '999888777', automation_id: AUTO_ID, event_type: 'lead_captured', created_at: '2026-10-01T11:00:00Z' },
  ];
  tabelas.messages = [
    { id: 'msg1', instagram_user_id: 'ig123', contact_id: '999888777', direction: 'inbound', text: 'Oi, quero o Raio-X', created_at: '2026-09-30T10:00:00Z' },
    { id: 'msg2', instagram_user_id: 'ig123', contact_id: '999888777', direction: 'outbound', text: 'Claro! Qual seu cargo?', created_at: '2026-09-30T10:01:00Z' },
  ];
}

describe('ler_contato', () => {
  it('acha pelo @ (com ou sem arroba) e traz dados, respostas, jornada e mensagens', async () => {
    seed();
    const r = (await ler.executar({ conta: 'edusaude', pessoa: '@fulano.silva' }, ctxMaster)) as {
      lead: Record<string, unknown>;
      respostas: Record<string, string>;
      jornada: { automacao: string; eventos: { evento: string; quando: string | null }[] }[];
      ultimas_mensagens: { direcao: string; texto: string | null; quando: string | null }[];
    };
    expect(r.lead).toMatchObject({ nome: 'Fulano da Silva', instagram: '@fulano.silva', arroba_pendente: false, email: 'fulano@gmail.com', telefone: '+5581999998888', origem: 'PMPE - Raio-X' });
    expect(r.respostas).toEqual({ cargo: 'Soldado' }); // sem o _capture interno
    expect(r.jornada).toEqual([{ automacao: 'PMPE - Raio-X', eventos: [{ evento: 'Deixou e-mail e telefone', quando: '2026-10-01T11:00:00Z' }, { evento: 'Comentou no post', quando: '2026-09-30T10:00:00Z' }] }]);
    expect(r.ultimas_mensagens).toEqual([
      { direcao: 'recebida', texto: 'Oi, quero o Raio-X', quando: '2026-09-30T10:00:00Z' },
      { direcao: 'enviada', texto: 'Claro! Qual seu cargo?', quando: '2026-09-30T10:01:00Z' },
    ]);
  });

  it('acha pelo instagram_id também', async () => {
    seed();
    const r = (await ler.executar({ conta: 'edusaude', pessoa: '999888777' }, ctxMaster)) as {
      lead: Record<string, unknown>;
      respostas: Record<string, string>;
      jornada: { automacao: string; eventos: { evento: string; quando: string | null }[] }[];
      ultimas_mensagens: { direcao: string; texto: string | null; quando: string | null }[];
    };
    expect(r.lead.instagram_id).toBe('999888777');
  });

  it('@ pendente (username == instagram_id) sai como null, com a flag', async () => {
    seed();
    const r = (await ler.executar({ conta: 'edusaude', pessoa: '111222333' }, ctxMaster)) as {
      lead: Record<string, unknown>;
      respostas: Record<string, string>;
      jornada: { automacao: string; eventos: { evento: string; quando: string | null }[] }[];
      ultimas_mensagens: { direcao: string; texto: string | null; quando: string | null }[];
    };
    expect(r.lead.instagram).toBeNull();
    expect(r.lead.arroba_pendente).toBe(true);
  });

  it('não vaza o contato da mesma pessoa em outra conta', async () => {
    seed();
    const r = (await ler.executar({ conta: 'edusaude', pessoa: '999888777' }, ctxMaster)) as {
      lead: Record<string, unknown>;
      respostas: Record<string, string>;
      jornada: { automacao: string; eventos: { evento: string; quando: string | null }[] }[];
      ultimas_mensagens: { direcao: string; texto: string | null; quando: string | null }[];
    };
    expect(r.lead.nome).toBe('Fulano da Silva'); // o da conta certa, não "Fulano" da ig999
  });

  it('pessoa não encontrada dá um erro claro', async () => {
    seed();
    await expect(ler.executar({ conta: 'edusaude', pessoa: 'ninguem.aqui' }, ctxMaster)).rejects.toThrow(/Nenhum lead/);
  });

  it('"pessoa" vazio é recusado', async () => {
    seed();
    await expect(ler.executar({ conta: 'edusaude', pessoa: '  ' }, ctxMaster)).rejects.toThrow(/obrigatório/);
  });
});
