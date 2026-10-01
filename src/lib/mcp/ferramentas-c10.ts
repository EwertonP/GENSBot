/**
 * Ferramentas do MCP — Onda C10: métricas do Instagram.
 *
 * Mesmos dados do painel de Métricas da tela — alcance, visitas ao perfil,
 * crescimento de seguidores e as publicações com melhor desempenho —
 * reaproveitando as mesmas funções (`fetchAccountMetrics`,
 * `computeContentPerformance`) que a tela e o relatório público do cliente já
 * usam, com o token da conta buscado só aqui dentro (nunca devolvido).
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { resolverConta, str } from './ferramentas-c3';
import { fetchAccountMetrics, ALLOWED_PERIODS, type Period } from '../instagram-insights';
import { computeContentPerformance } from '../content-performance';

type Args = Record<string, unknown>;

async function tokenDaConta(instagramUserId: string): Promise<string> {
  const { data } = await db.from('instagram_accounts').select('access_token').eq('instagram_user_id', instagramUserId).maybeSingle();
  if (!data?.access_token) throw new ErroFerramenta('Essa conta não tem um token válido do Instagram — precisa ser reconectada na tela.');
  return data.access_token;
}

export const FERRAMENTAS_C10: Ferramenta[] = [
  {
    name: 'metricas_instagram',
    title: 'Métricas do Instagram',
    description:
      'Desempenho de uma conta no Instagram num período: alcance, visitas ao perfil, crescimento de seguidores e as publicações (posts/reels/stories) com melhor desempenho — mesmos dados do painel de Métricas da tela, direto da Graph API da Meta. Útil pra montar o resumo do mês de um cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' },
        periodo_dias: { type: 'number', enum: ALLOWED_PERIODS as unknown as number[], description: '7, 30 ou 90. Padrão 30 (teto da Meta pra retenção de insights é 90).' },
      },
      required: ['conta'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args: Args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta, 100));
      const periodoInformado = args.periodo_dias !== undefined ? Number(args.periodo_dias) : 30;
      if (!ALLOWED_PERIODS.includes(periodoInformado as Period)) {
        throw new ErroFerramenta(`"periodo_dias" precisa ser um de: ${ALLOWED_PERIODS.join(', ')}.`);
      }
      const periodo = periodoInformado as Period;

      const accessToken = await tokenDaConta(conta.instagram_user_id);

      const [perfil, conteudo] = await Promise.all([
        fetchAccountMetrics(conta.instagram_user_id, accessToken, periodo),
        computeContentPerformance([{ instagram_user_id: conta.instagram_user_id, access_token: accessToken }], periodo),
      ]);

      if (perfil.error) throw new Error(perfil.error);

      return {
        conta: conta.instagram_username,
        periodo_dias: periodo,
        perfil: {
          seguidores: perfil.followers_count,
          publicacoes_totais: perfil.media_count,
        },
        alcance_total: perfil.reach_total,
        visitas_ao_perfil_total: perfil.profile_views_total,
        alcance_diario: perfil.daily.map((d) => ({ data: d.date, alcance: d.reach, visitas_ao_perfil: d.profile_views })),
        crescimento_seguidores: perfil.followerGrowthUnavailable
          ? 'indisponível (a Meta só fornece esse dado pra contas com 100+ seguidores)'
          : perfil.followerGrowth.map((f) => ({ data: f.date, seguidores: f.followers })),
        resumo_conteudo: {
          posts: conteudo.summary.posts,
          reels: conteudo.summary.reels,
          stories: conteudo.summary.stories,
          alcance_total: conteudo.summary.reachTotal,
          taxa_engajamento_percent: conteudo.summary.engagementRate,
          por_formato: conteudo.summary.byFormat,
        },
        melhores_publicacoes: conteudo.topPublications.map((p) => ({
          tipo: p.media_type,
          legenda: p.caption,
          publicado_em: p.published_at,
          alcance: p.reach,
          interacoes: p.interactions,
          midia_url: p.media_url,
        })),
        melhores_stories: conteudo.topStories.map((s) => ({ publicado_em: s.published_at, alcance: s.reach, midia_url: s.media_url })),
      };
    },
  },
];
