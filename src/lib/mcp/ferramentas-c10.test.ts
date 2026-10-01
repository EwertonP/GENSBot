import { describe, it, expect, vi } from 'vitest';

// Mesmo Supabase falso de ferramentas-c7/c8/c9.test.ts — só precisa resolver a conta e o token.
const tabelas: Record<string, Record<string, unknown>[]> = {};

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = rows.filter((r) => val.includes(r[col]));
      return chain;
    },
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

// fetchAccountMetrics/computeContentPerformance já são testados e usados em produção
// (tela de Métricas, relatório público) — aqui só testo a cola do MCP: conta, token,
// período e tradução de campos, não a chamada real à Graph API.
const fetchAccountMetrics = vi.fn();
const computeContentPerformance = vi.fn();
// Sem vi.importActual: o arquivo real importa '@/lib/supabase' (alias), que o
// vitest não resolve neste caminho de mock — replico só o que o c10 usa (ALLOWED_PERIODS
// são os mesmos 3 números do arquivo real).
vi.mock('../instagram-insights', () => ({ fetchAccountMetrics: (...args: unknown[]) => fetchAccountMetrics(...args), ALLOWED_PERIODS: [7, 30, 90] }));
vi.mock('../content-performance', () => ({ computeContentPerformance: (...args: unknown[]) => computeContentPerformance(...args) }));

import { FERRAMENTAS_C10 } from './ferramentas-c10';

const metricas = FERRAMENTAS_C10[0];
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };

const perfilPadrao = {
  instagram_user_id: 'ig123',
  username: 'edusaude',
  profile_picture_url: null,
  followers_count: 1200,
  media_count: 80,
  period: 30,
  reach_total: 5000,
  profile_views_total: 300,
  daily: [{ date: '2026-10-01', reach: 500, profile_views: 30 }],
  followerGrowth: [{ date: '2026-10-01', followers: 1200 }],
  followerGrowthUnavailable: false,
  publicationsGrowth: [],
};
const conteudoPadrao = {
  summary: { posts: 5, reels: 3, stories: 2, reachTotal: 5000, engagementRate: 4.2, byFormat: { posts: { count: 5, reach: 3000, interactions: 100 }, reels: { count: 3, reach: 2000, interactions: 80 }, stories: { count: 2, reach: 500, interactions: 0 } } },
  topPublications: [{ id: 'm1', media_type: 'REELS', media_url: 'https://x/1.jpg', media_count: 1, caption: 'Legenda', published_at: '2026-10-01T10:00:00Z', reach: 2000, interactions: 80 }],
  topStories: [{ id: 's1', media_url: 'https://x/s1.jpg', published_at: '2026-10-01T08:00:00Z', reach: 500 }],
};

function seed(overrides: { followersCount?: number } = {}) {
  tabelas.membros = [{ id: 'm1', agencia_id: 'ag1' }];
  tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude', access_token: 'token-secreto' }];
  fetchAccountMetrics.mockReset().mockResolvedValue({ ...perfilPadrao, followers_count: overrides.followersCount ?? perfilPadrao.followers_count });
  computeContentPerformance.mockReset().mockResolvedValue(conteudoPadrao);
}

describe('metricas_instagram', () => {
  it('monta o resultado traduzido e nunca devolve o token', async () => {
    seed();
    const r = (await metricas.executar({ conta: 'edusaude' }, ctxMaster)) as {
      conta: string;
      periodo_dias: number;
      perfil: { seguidores: number; publicacoes_totais: number };
      alcance_total: number;
      alcance_diario: { data: string; alcance: number; visitas_ao_perfil: number }[];
      crescimento_seguidores: unknown;
      resumo_conteudo: { taxa_engajamento_percent: number };
      melhores_publicacoes: { tipo: string; legenda: string | null; alcance: number; interacoes: number }[];
    };
    expect(r.conta).toBe('edusaude');
    expect(r.periodo_dias).toBe(30);
    expect(r.perfil).toEqual({ seguidores: 1200, publicacoes_totais: 80 });
    expect(r.alcance_total).toBe(5000);
    expect(r.alcance_diario).toEqual([{ data: '2026-10-01', alcance: 500, visitas_ao_perfil: 30 }]);
    expect(r.resumo_conteudo.taxa_engajamento_percent).toBe(4.2);
    expect(r.melhores_publicacoes[0]).toMatchObject({ tipo: 'REELS', legenda: 'Legenda', alcance: 2000, interacoes: 80 });
    expect(JSON.stringify(r)).not.toContain('token-secreto');
  });

  it('passa o período informado pras duas funções', async () => {
    seed();
    await metricas.executar({ conta: 'edusaude', periodo_dias: 7 }, ctxMaster);
    expect(fetchAccountMetrics).toHaveBeenCalledWith('ig123', 'token-secreto', 7);
    expect(computeContentPerformance).toHaveBeenCalledWith([{ instagram_user_id: 'ig123', access_token: 'token-secreto' }], 7);
  });

  it('período inválido é recusado antes de chamar a Meta', async () => {
    seed();
    await expect(metricas.executar({ conta: 'edusaude', periodo_dias: 15 }, ctxMaster)).rejects.toThrow(/periodo_dias/);
    expect(fetchAccountMetrics).not.toHaveBeenCalled();
  });

  it('conta sem token é recusada antes de chamar a Meta', async () => {
    seed();
    tabelas.instagram_accounts[0].access_token = null;
    await expect(metricas.executar({ conta: 'edusaude' }, ctxMaster)).rejects.toThrow(/reconectada/);
    expect(fetchAccountMetrics).not.toHaveBeenCalled();
  });

  it('crescimento de seguidores indisponível vira uma mensagem, não um array vazio enganoso', async () => {
    seed();
    fetchAccountMetrics.mockResolvedValue({ ...perfilPadrao, followerGrowthUnavailable: true, followerGrowth: [] });
    const r = (await metricas.executar({ conta: 'edusaude' }, ctxMaster)) as {
      conta: string;
      periodo_dias: number;
      perfil: { seguidores: number; publicacoes_totais: number };
      alcance_total: number;
      alcance_diario: { data: string; alcance: number; visitas_ao_perfil: number }[];
      crescimento_seguidores: unknown;
      resumo_conteudo: { taxa_engajamento_percent: number };
      melhores_publicacoes: { tipo: string; legenda: string | null; alcance: number; interacoes: number }[];
    };
    expect(r.crescimento_seguidores).toMatch(/indisponível/);
  });

  it('erro do perfil (ex: token inválido na Meta) propaga como erro da ferramenta', async () => {
    seed();
    fetchAccountMetrics.mockResolvedValue({ ...perfilPadrao, error: 'Token expirado na Meta' });
    await expect(metricas.executar({ conta: 'edusaude' }, ctxMaster)).rejects.toThrow('Token expirado na Meta');
  });
});
