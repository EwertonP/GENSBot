import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockMembroPapel = 'master';
let mockDemandas: any[] = [];
let mockMembros: any[] = [];
let mockClientes: any[] = [];
let mockPosts: any[] = [];
let mockVinculados: any[] = [];
let mockContas: any[] = [];
let mockArquivadas: any[] = [];

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
        const proxy: any = new Proxy(() => undefined, {
          get(_alvo, prop) {
            if (prop === 'then') return (ok: (v: any) => void) => ok({ data: mockDemandas, error: null });
            if (prop === 'select') return (cols: string) => (String(cols).trim() === 'scheduled_post_id' ? cadeia(() => ({ data: mockVinculados, error: null })) : proxy);
            return () => proxy;
          },
        });
        return proxy;
      }
      if (tabela === 'scheduled_posts') {
        return cadeia(() => ({ data: mockPosts, error: null }));
      }
      if (tabela === 'entregas_arquivadas') {
        return cadeia(() => ({ data: mockArquivadas, error: null }));
      }
      if (tabela === 'instagram_accounts') {
        return cadeia(() => ({ data: mockContas, error: null }));
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
    mockPosts = [];
    mockVinculados = [];
    mockContas = [];
    mockArquivadas = [];
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

  it('post publicado sem demanda conta como entrega de quem o agendou, e entrega sem responsável é listada', async () => {
    mockClientes = [
      { id: 'c1', nome: 'Cliente Alpha', cor: '#10b981', nicho: 'Saúde', foto_url: null, ativo: true, instagram_account_id: 'acc1' },
      { id: 'c2', nome: 'Cliente Beta', cor: '#3b82f6', nicho: 'Tech', foto_url: null, ativo: true, instagram_account_id: null },
    ];
    mockContas = [{ id: 'acc1', instagram_user_id: 'ig1' }];
    mockPosts = [
      { id: 'p1', user_id: 'm2', responsavel_id: null, instagram_user_id: 'ig1', media_type: 'REELS', caption: 'Reels direto', status: 'published', published_at: '2026-11-05T15:00:00Z' },
      { id: 'p2', user_id: 'm2', responsavel_id: 'm1', instagram_user_id: 'ig1', media_type: 'IMAGE', caption: 'Post do sócio', status: 'published', published_at: '2026-11-06T15:00:00Z' },
      { id: 'p3', user_id: 'm2', responsavel_id: 'm1', instagram_user_id: 'ig1', media_type: 'IMAGE', caption: 'Já é de uma demanda', status: 'published', published_at: '2026-11-07T15:00:00Z' },
    ];
    mockVinculados = [{ scheduled_post_id: 'p3' }];
    mockDemandas = [
      ...mockDemandas,
      { id: 'd4', titulo: 'Entregue sem responsável', tipo: 'post', status: 'publicado', mes_referencia: '2026-11-01', responsavel_id: null, co_responsaveis_ids: [], cliente_id: 'c1' },
    ];

    const res = await GET(new Request('http://localhost/api/equipe/produtividade?mes=2026-11'));
    const data = await res.json();

    // p1 conta para o João (quem agendou), p2 para o Ewerton (responsável escolhido); p3 já conta pela demanda
    const joao = data.membros.find((m: any) => m.id === 'm2');
    const ewerton = data.membros.find((m: any) => m.id === 'm1');
    expect(joao.posts_diretos).toBe(1);
    expect(joao.total_entregues).toBe(3); // d1 (co) + d2 + p1
    expect(joao.por_tipo.reel).toBe(2); // d1 reel + p1 reel
    expect(ewerton.posts_diretos).toBe(1);
    expect(ewerton.total_entregues).toBe(2); // d1 + p2

    // Resumo
    expect(data.resumo.total_posts_diretos).toBe(2);
    expect(data.resumo.total_sem_responsavel).toBe(1);
    expect(data.itens_sem_responsavel.map((i: any) => i.id)).toEqual(['d4']);
    expect(data.itens_entregues.filter((i: any) => i.origem === 'post_direto')).toHaveLength(2);

    // Cliente Alpha recebe os posts da conta ig1
    const alpha = data.clientes.find((c: any) => c.id === 'c1');
    expect(alpha.total_entregues).toBe(5); // d1 + d2 + d4 + p1 + p2
  });

  it('entregas arquivadas (demanda excluída) continuam contando, sem duplicar nem virar post direto', async () => {
    mockClientes = [
      { id: 'c1', nome: 'Cliente Alpha', cor: '#10b981', nicho: 'Saúde', foto_url: null, ativo: true, instagram_account_id: 'acc1' },
      { id: 'c2', nome: 'Cliente Beta', cor: '#3b82f6', nicho: 'Tech', foto_url: null, ativo: true, instagram_account_id: null },
    ];
    mockContas = [{ id: 'acc1', instagram_user_id: 'ig1' }];
    mockArquivadas = [
      { id: 'a1', agencia_id: 'ag-1', cliente_id: 'c1', tipo: 'carrossel', titulo: 'Já excluída', status: 'publicado', mes_referencia: '2026-11-01', responsavel_id: 'm2', co_responsaveis_ids: [], scheduled_post_id: 'p1', publicado_em: '2026-11-02T10:00:00Z' },
      { id: 'a2', agencia_id: 'ag-1', cliente_id: 'c1', tipo: 'post', titulo: 'Sem dono', status: 'publicado', mes_referencia: '2026-11-01', responsavel_id: null, co_responsaveis_ids: [], scheduled_post_id: null, publicado_em: '2026-11-03T10:00:00Z' },
      // a mesma demanda ainda existe viva (d2): não pode contar duas vezes
      { id: 'd2', agencia_id: 'ag-1', cliente_id: 'c1', tipo: 'carrossel', titulo: 'Carrossel Dicas', status: 'publicado', mes_referencia: '2026-11-01', responsavel_id: 'm2', co_responsaveis_ids: [], scheduled_post_id: null, publicado_em: null },
    ];
    // o post da demanda arquivada a1 continua existindo em scheduled_posts: não conta como post direto
    mockPosts = [{ id: 'p1', user_id: 'm2', responsavel_id: 'm2', instagram_user_id: 'ig1', media_type: 'IMAGE', caption: 'x', status: 'published', published_at: '2026-11-02T10:00:00Z' }];

    const res = await GET(new Request('http://localhost/api/equipe/produtividade?mes=2026-11'));
    const data = await res.json();

    const joao = data.membros.find((m: any) => m.id === 'm2');
    expect(joao.total_entregues).toBe(3); // d1 (co) + d2 + a1; d2 não duplica; p1 não vira post direto
    expect(joao.posts_diretos).toBe(0);
    expect(data.resumo.total_posts_diretos).toBe(0);
    expect(data.resumo.total_entregues).toBe(4); // d1 + d2 + a1 + a2
    expect(data.itens_sem_responsavel.map((i: any) => [i.id, i.arquivada])).toEqual([['a2', true]]);

    const alpha = data.clientes.find((c: any) => c.id === 'c1');
    expect(alpha.total_entregues).toBe(4);
  });
});
