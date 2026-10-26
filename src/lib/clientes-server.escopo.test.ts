import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Supabase no mesmo formato de clientes-server.test.ts: a resposta de
// qualquer consulta é `linhasNoBanco`.
let linhasNoBanco: unknown = null;

function cadeia(resultado: () => unknown) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_alvo, prop) {
      if (prop === 'then') return (ok: (v: unknown) => void) => ok(resultado());
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => cadeia(() => ({ data: linhasNoBanco, error: null })) },
}));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: vi.fn() },
    from: () => cadeia(() => ({ data: null, error: null })),
  }),
}));
vi.mock('@/lib/instagram-account', () => ({ listInstagramAccountsForUser: vi.fn() }));

import {
  escopoClientes,
  ocultarCamposFinanceiros,
  podeAcessarCliente,
  respostaSeMembroEscopado,
  type ContextoAgencia,
} from './clientes-server';

const ctx = (papel: string, extra: Record<string, unknown> = {}) =>
  ({
    membro: { id: 'm1', agencia_id: 'ag1', papel, ativo: true, ...extra },
    user: { id: 'm1' },
    supabase: {},
  }) as unknown as ContextoAgencia;

describe('escopoClientes', () => {
  beforeEach(() => {
    linhasNoBanco = null;
  });

  it('master enxerga a agência inteira', async () => {
    expect(await escopoClientes(ctx('master'))).toEqual({ total: true });
  });

  it('portal do cliente enxerga só o próprio cliente', async () => {
    expect(await escopoClientes(ctx('cliente', { cliente_id: 'c9' }))).toEqual({ total: false, ids: ['c9'] });
  });

  it('membro comum enxerga só os clientes vinculados', async () => {
    linhasNoBanco = [{ cliente_id: 'c1' }, { cliente_id: 'c2' }];
    expect(await escopoClientes(ctx('membro'))).toEqual({ total: false, ids: ['c1', 'c2'] });
  });

  it('membro sem vínculos fica sem nenhum cliente', async () => {
    linhasNoBanco = [];
    expect(await escopoClientes(ctx('membro'))).toEqual({ total: false, ids: [] });
  });
});

describe('podeAcessarCliente', () => {
  it('master pode qualquer cliente, inclusive sem id', () => {
    expect(podeAcessarCliente({ total: true }, 'qualquer')).toBe(true);
  });

  it('escopo parcial só cobre os ids listados', () => {
    const escopo = { total: false as const, ids: ['c1'] };
    expect(podeAcessarCliente(escopo, 'c1')).toBe(true);
    expect(podeAcessarCliente(escopo, 'c2')).toBe(false);
    expect(podeAcessarCliente(escopo, null)).toBe(false);
  });
});

describe('respostaSeMembroEscopado', () => {
  it('membro comum recebe 403', () => {
    const r = respostaSeMembroEscopado(ctx('membro'));
    expect(r?.status).toBe(403);
  });

  it('master e portal do cliente passam', () => {
    expect(respostaSeMembroEscopado(ctx('master'))).toBeNull();
    expect(respostaSeMembroEscopado(ctx('cliente', { cliente_id: 'c1' }))).toBeNull();
  });
});

describe('ocultarCamposFinanceiros', () => {
  const cliente = {
    id: 'c1',
    nome: 'Cliente',
    valor_mensal: 1500,
    cpf_responsavel: '000.000.000-00',
    cnpj_cpf: '00.000.000/0001-00',
    contrato_inicio: '2026-01-01',
    posts_mes: 12,
  };

  it('esconde valor, CPF e contrato de quem não é master', () => {
    const visivel = ocultarCamposFinanceiros(cliente, { total: false, ids: ['c1'] });
    expect(visivel).not.toHaveProperty('valor_mensal');
    expect(visivel).not.toHaveProperty('cpf_responsavel');
    expect(visivel).not.toHaveProperty('cnpj_cpf');
    expect(visivel).not.toHaveProperty('contrato_inicio');
    // Campos operacionais continuam.
    expect(visivel).toMatchObject({ id: 'c1', nome: 'Cliente', posts_mes: 12 });
  });

  it('master vê tudo', () => {
    expect(ocultarCamposFinanceiros(cliente, { total: true })).toEqual(cliente);
  });

  it('não altera o objeto original', () => {
    ocultarCamposFinanceiros(cliente, { total: false, ids: [] });
    expect(cliente.valor_mensal).toBe(1500);
  });
});
