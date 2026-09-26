import { NextResponse } from 'next/server';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { verificarTokenRelatorio } from '@/lib/relatorio-token';
import { fetchAccountMetrics } from '@/lib/instagram-insights';
import { computeContentPerformance } from '@/lib/content-performance';

/**
 * Dados do relatório público (/relatorio/[token]). Sem login, então:
 *  - só aceita token assinado (lib/relatorio-token.ts);
 *  - a conta precisa continuar pertencendo a quem gerou o link;
 *  - devolve SÓ números reais da Meta — nenhum fallback "de exemplo" e nada
 *    de outras contas (a versão antiga caía em scheduled_posts sem filtro).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const data = verificarTokenRelatorio(token);
  if (!data) {
    return NextResponse.json({ error: 'Link de relatório inválido ou expirado.' }, { status: 401 });
  }

  try {
    const account = await getInstagramAccountByInstagramUserId(data.accountId);
    if (!account || account.user_id !== data.ownerId) {
      return NextResponse.json({ error: 'Esta conta não está mais disponível para relatório.' }, { status: 404 });
    }

    const [metrics, content] = await Promise.all([
      fetchAccountMetrics(account.instagram_user_id, account.access_token, data.period),
      computeContentPerformance([{ instagram_user_id: account.instagram_user_id, access_token: account.access_token }], data.period),
    ]);

    return NextResponse.json(
      {
        cliente: data.clienteNome,
        period: data.period,
        geradoEm: new Date().toISOString(),
        account: {
          username: metrics.username,
          profile_picture_url: metrics.profile_picture_url,
          followers_count: metrics.followers_count,
        },
        metrics: {
          reach_total: metrics.reach_total,
          profile_views_total: metrics.profile_views_total,
          daily: metrics.daily,
          followerGrowth: metrics.followerGrowth,
          followerGrowthUnavailable: metrics.followerGrowthUnavailable,
          error: metrics.error ?? null,
        },
        content: {
          summary: content.summary,
          topPublications: content.topPublications,
        },
      },
      // Cache curto na borda: o cliente pode recarregar à vontade sem estourar a cota da Graph API.
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (err: unknown) {
    console.error('Erro ao montar relatório público:', err);
    return NextResponse.json({ error: 'Não foi possível carregar os dados agora. Tente novamente em instantes.' }, { status: 502 });
  }
}
