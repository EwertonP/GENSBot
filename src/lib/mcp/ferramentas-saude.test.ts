import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Supabase falso e genérico (mesmo padrão de ferramentas-c9.test.ts), com neq e contagem "head".
const tabelas: Record<string, Record<string, unknown>[]> = {};

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  let head = false;
  const chain = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      head = Boolean(opts?.head);
      return chain;
    },
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
    neq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] !== val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = rows.filter((r) => val.includes(r[col]));
      return chain;
    },
    gte: (col: string, val: unknown) => {
      rows = rows.filter((r) => String(r[col]) >= String(val));
      return chain;
    },
    then: (resolve: (v: { data: unknown[] | null; count: number; error: null }) => void) =>
      resolve({ data: head ? null : rows, count: rows.length, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

import {
  FERRAMENTAS_SAUDE,
  LIMIARES,
  problemaDeAutomacao,
  problemaDeToken,
  problemasDeAgenda,
  problemasDeDemandas,
  problemasDePosts,
} from './ferramentas-saude';

const saude = FERRAMENTAS_SAUDE[0];
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const ctxMembro = { ...ctxMaster, membroId: 'm2', papel: 'membro' as const };

const AGORA = new Date('2026-11-04T12:00:00Z').getTime();
const dias = (n: number) => new Date(AGORA + n * 24 * 60 * 60 * 1000).toISOString();
const minutos = (n: number) => new Date(AGORA + n * 60 * 1000).toISOString();

interface Resultado {
  situacao: 'tudo_certo' | 'atencao' | 'critico';
  resumo: { criticos: number; atencao: number; verificado: Record<string, number> };
  problemas: { severidade: string; area: string; onde: string; problema: string; sugestao: string }[];
  problemas_omitidos: number;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  for (const k of Object.keys(tabelas)) delete tabelas[k];
});
afterEach(() => vi.useRealTimers());

/** Agência saudável: uma conta com acesso longe de vencer, um cliente com post agendado, nada atrasado. */
function seedSaudavel() {
  tabelas.membros = [{ id: 'm1', agencia_id: 'ag1' }];
  tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude', token_expires_at: dias(50) }];
  tabelas.clientes = [{ id: 'c1', nome: 'EduSaúde', ativo: true, agencia_id: 'ag1', instagram_account_id: 'ia1' }];
  tabelas.scheduled_posts = [{ id: 'p1', instagram_user_id: 'ig123', status: 'scheduled', scheduled_at: dias(2), created_at: dias(-1), error_message: null }];
  tabelas.conteudo_items = [];
  tabelas.automations = [];
  tabelas.analytics_events = [];
}

describe('problemaDeToken', () => {
  it('longe de vencer não gera problema', () => {
    expect(problemaDeToken('edusaude', dias(40), AGORA)).toBeNull();
    expect(problemaDeToken('edusaude', dias(LIMIARES.tokenAtencaoDias + 1), AGORA)).toBeNull();
  });

  it('vencendo em até 10 dias é atenção; em até 3 dias é crítico', () => {
    expect(problemaDeToken('edusaude', dias(8), AGORA)?.severidade).toBe('atencao');
    expect(problemaDeToken('edusaude', dias(2), AGORA)?.severidade).toBe('critico');
  });

  it('já vencido é crítico e diz que publicação e automações não funcionam', () => {
    const p = problemaDeToken('edusaude', dias(-1), AGORA);
    expect(p?.severidade).toBe('critico');
    expect(p?.problema).toMatch(/venceu/);
    expect(p?.onde).toBe('@edusaude');
  });

  it('sem data (ou data inválida) é atenção, não crítico', () => {
    expect(problemaDeToken('edusaude', null, AGORA)?.severidade).toBe('atencao');
    expect(problemaDeToken('edusaude', 'lixo', AGORA)?.severidade).toBe('atencao');
  });
});

describe('problemasDePosts', () => {
  const contas = new Map([['ig123', 'edusaude']]);
  const post = (extra: Record<string, unknown>) => ({ id: 'p', instagram_user_id: 'ig123', status: 'scheduled', scheduled_at: minutos(60), created_at: minutos(-60), error_message: null, ...extra }) as never;

  it('post futuro e em dia não gera problema', () => {
    expect(problemasDePosts([post({})], contas, AGORA)).toEqual([]);
  });

  it('agendado que passou de 10 min sem sair é crítico; com 5 min ainda não', () => {
    expect(problemasDePosts([post({ scheduled_at: minutos(-5) })], contas, AGORA)).toEqual([]);
    const r = problemasDePosts([post({ scheduled_at: minutos(-30) })], contas, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ severidade: 'critico', area: 'publicacao', onde: '@edusaude' });
    expect(r[0].problema).toMatch(/30 min de atraso/);
  });

  it('falha recente aparece com o erro; falha de mais de 14 dias é ignorada', () => {
    const recente = problemasDePosts([post({ status: 'failed', created_at: dias(-3), error_message: 'Token expirado' })], contas, AGORA);
    expect(recente[0].problema).toMatch(/Token expirado/);
    expect(problemasDePosts([post({ status: 'failed', created_at: dias(-20), scheduled_at: dias(-20) })], contas, AGORA)).toEqual([]);
  });

  it('"publicando" por mais de 20 min é post preso; recém-iniciado não', () => {
    expect(problemasDePosts([post({ status: 'publishing', scheduled_at: minutos(-5) })], contas, AGORA)).toEqual([]);
    expect(problemasDePosts([post({ status: 'publishing', scheduled_at: minutos(-40) })], contas, AGORA)[0].problema).toMatch(/preso/);
  });

  it('erro muito longo é cortado', () => {
    const r = problemasDePosts([post({ status: 'failed', created_at: dias(-1), error_message: 'x'.repeat(900) })], contas, AGORA);
    expect(r[0].problema.length).toBeLessThan(320);
  });
});

describe('problemaDeAutomacao', () => {
  const auto = { id: 'a1', name: 'PMPE - Raio-X', instagram_user_id: 'ig123' };

  it('muitas mensagens e zero cliques é atenção', () => {
    expect(problemaDeAutomacao(auto, 12, 0, 'edusaude')).toMatchObject({ severidade: 'atencao', area: 'automacoes', onde: 'PMPE - Raio-X (@edusaude)' });
  });

  it('com algum clique, ou pouca amostra, não acusa nada', () => {
    expect(problemaDeAutomacao(auto, 12, 1, 'edusaude')).toBeNull();
    expect(problemaDeAutomacao(auto, LIMIARES.automacaoMinMensagens - 1, 0, 'edusaude')).toBeNull();
  });
});

describe('problemasDeDemandas', () => {
  const clientes = new Map([['c1', 'EduSaúde']]);
  const demanda = (extra: Record<string, unknown>) =>
    ({ id: 'd', cliente_id: 'c1', titulo: 'Carrossel', status: 'copy', prazo: null, data_programada: null, atualizado_em: dias(-1), ...extra }) as never;

  it('agrupa as atrasadas por cliente e usa prazo, ou data programada na falta dele', () => {
    const r = problemasDeDemandas([demanda({ prazo: '2026-10-30' }), demanda({ data_programada: '2026-10-25T10:00:00Z' }), demanda({ prazo: '2026-11-10' })], clientes, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ area: 'demandas', onde: 'EduSaúde' });
    expect(r[0].problema).toMatch(/^2 demandas atrasadas/);
  });

  it('travada entra à parte e não conta como atrasada', () => {
    const r = problemasDeDemandas([demanda({ status: 'travado', prazo: '2026-10-01' })], clientes, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].problema).toMatch(/travada/);
  });

  it('esperando o cliente há mais de 5 dias entra; há 2 dias não', () => {
    expect(problemasDeDemandas([demanda({ status: 'revisao_cliente', atualizado_em: dias(-2) })], clientes, AGORA)).toEqual([]);
    const r = problemasDeDemandas([demanda({ status: 'revisao_cliente', atualizado_em: dias(-7) })], clientes, AGORA);
    expect(r[0].problema).toMatch(/esperando o cliente/);
  });

  it('demanda em dia não gera nada', () => {
    expect(problemasDeDemandas([demanda({ prazo: '2026-11-20' })], clientes, AGORA)).toEqual([]);
  });
});

describe('problemasDeAgenda', () => {
  const cliente = { id: 'c1', nome: 'EduSaúde', instagram_user_id: 'ig123', username: 'edusaude' };
  const post = (extra: Record<string, unknown>) => ({ id: 'p', instagram_user_id: 'ig123', status: 'scheduled', scheduled_at: dias(2), created_at: null, error_message: null, ...extra }) as never;

  it('cliente com post nos próximos 7 dias está em dia', () => {
    expect(problemasDeAgenda([cliente], [post({})], new Map(), AGORA)).toEqual([]);
  });

  it('post só daqui a 10 dias, ou de outra conta, não cobre a semana', () => {
    expect(problemasDeAgenda([cliente], [post({ scheduled_at: dias(10) })], new Map(), AGORA)).toHaveLength(1);
    expect(problemasDeAgenda([cliente], [post({ instagram_user_id: 'ig999' })], new Map(), AGORA)).toHaveLength(1);
  });

  it('diz quantas demandas abertas o cliente tem na esteira', () => {
    expect(problemasDeAgenda([cliente], [], new Map([['c1', 3]]), AGORA)[0].problema).toMatch(/3 demandas abertas/);
    expect(problemasDeAgenda([cliente], [], new Map(), AGORA)[0].problema).toMatch(/Não há demandas abertas/);
  });
});

describe('saude_da_operacao', () => {
  it('só master pode usar', async () => {
    seedSaudavel();
    await expect(saude.executar({}, ctxMembro)).rejects.toThrow(/Só o master/);
  });

  it('agência saudável devolve "tudo_certo" e conta o que verificou', async () => {
    seedSaudavel();
    const r = (await saude.executar({}, ctxMaster)) as Resultado;
    expect(r.situacao).toBe('tudo_certo');
    expect(r.problemas).toEqual([]);
    expect(r.resumo.verificado).toMatchObject({ contas_instagram: 1, clientes_ativos: 1, posts_na_fila: 1, automacoes_ativas: 0, demandas_abertas: 0 });
  });

  it('junta problemas de várias áreas e põe o crítico na frente', async () => {
    seedSaudavel();
    tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude', token_expires_at: dias(8) }]; // atenção
    tabelas.scheduled_posts = [
      { id: 'p1', instagram_user_id: 'ig123', status: 'scheduled', scheduled_at: minutos(-45), created_at: dias(-1), error_message: null }, // crítico
      { id: 'p2', instagram_user_id: 'ig123', status: 'scheduled', scheduled_at: dias(2), created_at: dias(-1), error_message: null },
    ];
    tabelas.automations = [{ id: 'a1', name: 'PMPE - Raio-X', active: true, user_id: 'm1', instagram_user_id: 'ig123' }];
    tabelas.analytics_events = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, automation_id: 'a1', event_type: 'welcome_dm_sent', created_at: dias(-2) }));
    tabelas.conteudo_items = [{ id: 'd1', agencia_id: 'ag1', cliente_id: 'c1', titulo: 'Reel', status: 'copy', prazo: '2026-10-20', data_programada: null, atualizado_em: dias(-1) }];

    const r = (await saude.executar({}, ctxMaster)) as Resultado;
    expect(r.situacao).toBe('critico');
    expect(r.resumo.criticos).toBe(1);
    expect(r.problemas[0].severidade).toBe('critico');
    expect(r.problemas.map((p) => p.area).sort()).toEqual(['automacoes', 'demandas', 'instagram', 'publicacao']);
    expect(r.resumo.atencao).toBe(r.problemas.length - 1);
  });

  it('automação com cliques, de outra agência ou com eventos antigos não é acusada', async () => {
    seedSaudavel();
    tabelas.automations = [
      { id: 'a1', name: 'Com cliques', active: true, user_id: 'm1', instagram_user_id: 'ig123' },
      { id: 'a2', name: 'Antiga', active: true, user_id: 'm1', instagram_user_id: 'ig123' },
      { id: 'a3', name: 'De outra agência', active: true, user_id: 'mX', instagram_user_id: 'ig999' },
    ];
    tabelas.analytics_events = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, automation_id: 'a1', event_type: 'welcome_dm_sent', created_at: dias(-1) })),
      { id: 'c1', automation_id: 'a1', event_type: 'link_clicked', created_at: dias(-1) },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, automation_id: 'a2', event_type: 'welcome_dm_sent', created_at: dias(-40) })),
    ];
    const r = (await saude.executar({}, ctxMaster)) as Resultado;
    expect(r.problemas).toEqual([]);
    expect(r.resumo.verificado.automacoes_ativas).toBe(2);
  });

  it('cliente inativo ou sem Instagram conectado não entra na checagem de agenda', async () => {
    seedSaudavel();
    tabelas.scheduled_posts = [];
    tabelas.clientes = [
      { id: 'c1', nome: 'Inativo', ativo: false, agencia_id: 'ag1', instagram_account_id: 'ia1' },
      { id: 'c2', nome: 'Sem conta', ativo: true, agencia_id: 'ag1', instagram_account_id: null },
      { id: 'c3', nome: 'De outra agência', ativo: true, agencia_id: 'ag2', instagram_account_id: 'ia1' },
    ];
    const r = (await saude.executar({}, ctxMaster)) as Resultado;
    expect(r.problemas).toEqual([]);
  });

  it('nunca devolve o token da conta', async () => {
    seedSaudavel();
    tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude', token_expires_at: dias(1), access_token: 'SEGREDO-123' }];
    const r = await saude.executar({}, ctxMaster);
    expect(JSON.stringify(r)).not.toContain('SEGREDO-123');
  });

  it('limita a lista e informa quantos problemas ficaram de fora', async () => {
    seedSaudavel();
    tabelas.instagram_accounts = Array.from({ length: 70 }, (_, i) => ({ id: `ia${i}`, user_id: 'm1', instagram_user_id: `ig${i}`, instagram_username: `conta${i}`, token_expires_at: dias(-1) }));
    tabelas.clientes = [];
    tabelas.scheduled_posts = [];
    const r = (await saude.executar({}, ctxMaster)) as Resultado;
    expect(r.problemas).toHaveLength(60);
    expect(r.problemas_omitidos).toBe(10);
    expect(r.resumo.criticos).toBe(70);
  });
});
