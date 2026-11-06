import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockMembroPapel = 'master';
let mockDemandas: any[] = [];
let mockMembros: any[] = [];
let mockClientes: any[] = [];

vi.mock('@/lib/clientes-server', () => ({
  getContextoAgencia: vi.fn(async () => ({
    ok: true,
    ctx: {
      membro: {
        id: 'user-admin',
        agencia_id: 'ag-1',
        papel: mockMembroPapel,
      },
    },
  })),
  respostaErro: (erro: string, status: number) =>
    Response.json({ error: erro }, { status }),
}));

function cadeia(resultado: () => any) {
  const proxy: any = new Proxy(() => undefined, {
    get(_alvo, prop) {
      if (prop === 'then') return (ok: (v: any) => void) => ok(resultado());
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'membros') {
        return cadeia(() => ({ data: mockMembros, error: null }));
      }
      if (tabela === 'clientes') {
        return cadeia(() => ({ data: mockClientes, error: null }));
      }
      if (tabela === 'conteudo_items') {
        return cadeia(() => ({ data: mockDemandas, error: null }));
      }
      return cadeia(() => ({ data: [], error: null }));
    },
  },
}));

import { GET } from './route';

describe('/api/equipe/produtividade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembroPapel = 'master';
    mockMembros = [
      { id: 'm1', nome: 'Ewerton', email: 'e@gens.com', papel: 'master', cargo: 'Sócio', foto_url: null, ativo: true },
      { id: 'm2', nome: 'João', email: 'j@gens.com', papel: 'membro', cargo: 'Editor', foto_url: null, ativo: true },
    ];
    mockClientes = [
      { id: 'c1', nome: 'Cliente Alpha', cor: '#10b981', nicho: 'Saúde', foto_url: null, ativo: true },
      { id: 'c2', nome: 'Cliente Beta', cor: '#3b82f6', nicho: 'Tech', foto_url: null, ativo: true },
    ];
    mockDemandas = [
      {
        id: 'd1',
        titulo: 'Reels Novidades',
        tipo: 'reel',
        status: 'publicado',
        mes_referencia: '2026-11-01',
        responsavel_id: 'm1',
        co_responsaveis_ids: ['m2'],
        cliente_id: 'c1',
      },
      {
        id: 'd2',
        titulo: 'Carrossel Dicas',
        tipo: 'carrossel',
        status: 'publicado',
        mes_referencia: '2026-11-01',
        responsavel_id: 'm2',
        co_responsaveis_ids: [],
        cliente_id: 'c1',
      },
      {
        id: 'd3',
        titulo: 'Post Frase',
        tipo: 'post',
        status: 'criacao_arte',
        mes_referencia: '2026-11-01',
        responsavel_id: 'm2',
        co_responsaveis_ids: [],
        cliente_id: 'c2',
      },
    ];
  });

  it('bloqueia acesso com 403 para quem não é master', async () => {
    mockMembroPapel = 'membro';
    const res = await GET(new Request('http://localhost/api/equipe/produtividade?mes=2026-11'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Apenas administradores');
  });

  it('calcula métricas de produtividade corretamente para master', async () => {
    const res = await GET(new Request('http://localhost/api/equipe/produtividade?mes=2026-11'));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Resumo
    expect(data.resumo.total_demandas).toBe(3);
    expect(data.resumo.total_entregues).toBe(2);
    expect(data.resumo.total_em_andamento).toBe(1);
    expect(data.resumo.taxa_entrega).toBe(67); // 2/3 = ~67%

    // Membro 1 (Ewerton): 1 como titular publicado + 0 como co-autor = 1 entregue
    const ewerton = data.membros.find((m: any) => m.id === 'm1');
    expect(ewerton).toBeDefined();
    expect(ewerton.total_entregues).toBe(1);
    expect(ewerton.como_principal).toBe(1);
    expect(ewerton.por_tipo.reel).toBe(1);

    // Membro 2 (João): 1 como titular publicado + 1 como co-responsável (d1) = 2 entregues
    const joao = data.membros.find((m: any) => m.id === 'm2');
    expect(joao).toBeDefined();
    expect(joao.total_entregues).toBe(2);
    expect(joao.como_principal).toBe(1);
    expect(joao.como_co_responsavel).toBe(1);
    expect(joao.total_em_andamento).toBe(1); // d3

    // Cliente Alpha: 2 entregues, 100% entrega
    const cliAlpha = data.clientes.find((c: any) => c.id === 'c1');
    expect(cliAlpha).toBeDefined();
    expect(cliAlpha.total_entregues).toBe(2);
    expect(cliAlpha.total_demandas).toBe(2);
    expect(cliAlpha.taxa_entrega).toBe(100);

    // Cliente Beta: 0 entregues, 1 em andamento
    const cliBeta = data.clientes.find((c: any) => c.id === 'c2');
    expect(cliBeta).toBeDefined();
    expect(cliBeta.total_entregues).toBe(0);
    expect(cliBeta.total_demandas).toBe(1);
    expect(cliBeta.taxa_entrega).toBe(0);
  });

  it('considera demandas em agendamento ou com concluida=true como entregues', async () => {
    mockDemandas = [
      {
        id: 'd1',
        titulo: 'Reels Agendado',
        tipo: 'reel',
        status: 'agendamento',
        concluida: true,
        mes_referencia: '2026-11-01',
        responsavel_id: 'm1',
        co_responsaveis_ids: [],
        cliente_id: 'c1',
      },
      {
        id: 'd2',
        titulo: 'Post Pronto Publicar',
        tipo: 'post',
        status: 'pronto_publicar',
        concluida: false,
        mes_referencia: '2026-11-01',
        responsavel_id: 'm2',
        co_responsaveis_ids: [],
        cliente_id: 'c2',
      },
      {
        id: 'd3',
        titulo: 'Post em Aberto',
        tipo: 'post',
        status: 'roteiro',
        concluida: false,
        mes_referencia: '2026-11-01',
        responsavel_id: 'm2',
        co_responsaveis_ids: [],
        cliente_id: 'c2',
      },
    ];

    const res = await GET(new Request('http://localhost/api/equipe/produtividade?mes=2026-11'));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.resumo.total_demandas).toBe(3);
    expect(data.resumo.total_entregues).toBe(2); // d1 (agendamento) e d2 (pronto_publicar)
    expect(data.resumo.total_em_andamento).toBe(1); // d3
  });
});
