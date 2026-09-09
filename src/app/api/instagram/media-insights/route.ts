import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';

// Conjunto de métricas "provável" por tipo de mídia — a Meta muda isso com
// frequência, então a rota tenta o conjunto e, se algum nome for rejeitado,
// refaz só com os que sobraram em vez de falhar tudo.
const METRICS_BY_TYPE: Record<string, string[]> = {
  FEED: ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'],
  REELS: ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'],
  STORY: ['reach', 'replies'],
};

async function fetchInsightsWithFallback(mediaId: string, accessToken: string, metrics: string[]): Promise<any> {
  const url = `https://graph.instagram.com/v25.0/${mediaId}/insights?metric=${metrics.join(',')}&access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();

  if (res.ok) return data;

  // Erro de parâmetro inválido geralmente cita o nome da métrica rejeitada — remove
  // e tenta de novo com o que sobrou, em vez de falhar a chamada inteira.
  const invalidMetric = metrics.find((m) => data.error?.message?.includes(m));
  if (invalidMetric && metrics.length > 1) {
    return fetchInsightsWithFallback(mediaId, accessToken, metrics.filter((m) => m !== invalidMetric));
  }

  throw new Error(data.error?.message || 'Métricas indisponíveis para esta publicação.');
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const url = new URL(req.url);
    const mediaId = url.searchParams.get('media_id');
    const accountId = url.searchParams.get('account');

    if (!mediaId || !accountId) {
      return NextResponse.json({ error: 'media_id e account são obrigatórios.' }, { status: 400 });
    }

    const account = await getInstagramAccountByInstagramUserId(accountId);
    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    const productRes = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}?fields=media_product_type&access_token=${account.access_token}`
    );
    const productData = await productRes.json();
    if (!productRes.ok) {
      return NextResponse.json({ error: productData.error?.message || 'Mídia não encontrada.' }, { status: 404 });
    }

    const productType: string = productData.media_product_type || 'FEED';
    const metrics = METRICS_BY_TYPE[productType] || METRICS_BY_TYPE.FEED;

    try {
      const insightsData = await fetchInsightsWithFallback(mediaId, account.access_token, metrics);
      const values: Record<string, number> = {};
      for (const series of insightsData.data || []) {
        values[series.name] = series.values?.[0]?.value ?? series.total_value?.value ?? 0;
      }
      return NextResponse.json({ media_product_type: productType, metrics: values });
    } catch (insightsErr: any) {
      return NextResponse.json({ media_product_type: productType, metrics: {}, error: insightsErr.message });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
