import { supabase } from '@/lib/supabase';

/**
 * Métricas de conta do Instagram (alcance, visualizações, visitas/atividade ao perfil, seguidores,
 * publicações) — fonte única usada pela tela de Métricas (rota autenticada)
 * e pelo relatório público do cliente (rota com token assinado).
 */

export const ALLOWED_PERIODS = [7, 30, 90] as const; // 90d é o teto de retenção de insights da Meta
export type Period = (typeof ALLOWED_PERIODS)[number];

export interface DailyPoint {
  date: string;
  reach: number;
  views?: number;
  accounts_engaged?: number;
  profile_views: number;
}

export interface FollowerPoint {
  date: string;
  followers: number;
}

export interface PublicationPoint {
  date: string;
  count: number;
}

export interface AccountMetrics {
  instagram_user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  period: Period;
  reach_total: number;
  profile_views_total: number;
  views_total?: number;
  accounts_engaged_total?: number;
  daily: DailyPoint[];
  followerGrowth: FollowerPoint[];
  followerGrowthUnavailable: boolean; // true = conta com <100 seguidores, a Meta não fornece esse dado
  publicationsGrowth: PublicationPoint[];
  error?: string;
}

/**
 * Na Graph API v22+ e v25, a Meta descontinuou profile_views e impressions,
 * introduzindo 'views' e 'accounts_engaged'. Esta função tenta buscar o conjunto
 * completo com fallback gracioso individual caso alguma métrica seja rejeitada.
 */
async function fetchInsightsWithFallback(
  instagramUserId: string,
  accessToken: string,
  metrics: string[],
  since: number,
  until: number
): Promise<{ data: any[]; droppedMetrics: string[] }> {
  const url = `https://graph.instagram.com/v25.0/${instagramUserId}/insights?metric=${metrics.join(',')}&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();

  if (res.ok) return { data: data.data || [], droppedMetrics: [] };

  const errorMessage = String(data.error?.message || '').toLowerCase();
  const invalidMetric = metrics.find((m) => errorMessage.includes(m.toLowerCase()));

  if (invalidMetric && metrics.length > 1) {
    const retry = await fetchInsightsWithFallback(
      instagramUserId,
      accessToken,
      metrics.filter((m) => m !== invalidMetric),
      since,
      until
    );
    return { data: retry.data, droppedMetrics: [...retry.droppedMetrics, invalidMetric] };
  }

  // Se o lote falhou como um todo, tenta buscar métrica por métrica individualmente
  if (metrics.length > 1) {
    const validData: any[] = [];
    const dropped: string[] = [];
    for (const m of metrics) {
      try {
        const singleUrl = `https://graph.instagram.com/v25.0/${instagramUserId}/insights?metric=${m}&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
        const sRes = await fetch(singleUrl);
        const sData = await sRes.json();
        if (sRes.ok && Array.isArray(sData.data)) {
          validData.push(...sData.data);
        } else {
          dropped.push(m);
        }
      } catch {
        dropped.push(m);
      }
    }
    return { data: validData, droppedMetrics: dropped };
  }

  throw new Error(data.error?.message || 'Insights indisponível para esta conta.');
}

async function fetchPublicationsGrowth(instagramUserId: string, since: number, until: number): Promise<PublicationPoint[]> {
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('published_at')
    .eq('instagram_user_id', instagramUserId)
    .eq('status', 'published')
    .gte('published_at', new Date(since * 1000).toISOString())
    .lte('published_at', new Date(until * 1000).toISOString());

  if (error || !data) return [];

  const byDate = new Map<string, number>();
  for (const row of data) {
    const date = String(row.published_at).slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export async function fetchAccountMetrics(instagramUserId: string, accessToken: string, period: Period): Promise<AccountMetrics> {
  const base: AccountMetrics = {
    instagram_user_id: instagramUserId,
    username: null,
    profile_picture_url: null,
    followers_count: null,
    media_count: null,
    period,
    reach_total: 0,
    profile_views_total: 0,
    views_total: 0,
    accounts_engaged_total: 0,
    daily: [],
    followerGrowth: [],
    followerGrowthUnavailable: false,
    publicationsGrowth: [],
  };

  const profileRes = await fetch(
    `https://graph.instagram.com/v25.0/${instagramUserId}?fields=username,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
  );
  const profileData = await profileRes.json();
  if (!profileRes.ok) {
    return { ...base, error: profileData.error?.message || 'Erro ao buscar perfil.' };
  }
  base.username = profileData.username || null;
  base.profile_picture_url = profileData.profile_picture_url || null;
  base.followers_count = profileData.followers_count ?? null;
  base.media_count = profileData.media_count ?? null;

  const since = Math.floor((Date.now() - period * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);

  // Contas com menos de 100 seguidores não recebem follower_count da
  // própria Meta — nem tenta a métrica pra essas, evita erro previsível.
  const hasEnoughFollowersForGrowth = (base.followers_count ?? 0) >= 100;
  // Conjunto moderno de métricas da Meta (v22+/v25): reach, views, accounts_engaged + profile_views (legado/fallback)
  const metricsToFetch = hasEnoughFollowersForGrowth
    ? ['reach', 'views', 'accounts_engaged', 'profile_views', 'follower_count']
    : ['reach', 'views', 'accounts_engaged', 'profile_views'];

  base.publicationsGrowth = await fetchPublicationsGrowth(instagramUserId, since, until);

  try {
    const { data: seriesData, droppedMetrics } = await fetchInsightsWithFallback(
      instagramUserId,
      accessToken,
      metricsToFetch,
      since,
      until
    );

    if (hasEnoughFollowersForGrowth && droppedMetrics.includes('follower_count')) {
      base.followerGrowthUnavailable = true;
    }
    if (!hasEnoughFollowersForGrowth) {
      base.followerGrowthUnavailable = true;
    }

    const byDate = new Map<
      string,
      { reach: number; views: number; accounts_engaged: number; profile_views: number }
    >();
    const followersByDate = new Map<string, number>();

    for (const series of seriesData) {
      const metricName: string = series.name;
      for (const point of series.values || []) {
        const date = String(point.end_time).slice(0, 10);
        if (metricName === 'follower_count') {
          followersByDate.set(date, point.value || 0);
        } else {
          const entry = byDate.get(date) || {
            reach: 0,
            views: 0,
            accounts_engaged: 0,
            profile_views: 0,
          };
          if (metricName === 'reach') entry.reach = point.value || 0;
          if (metricName === 'views') entry.views = point.value || 0;
          if (metricName === 'accounts_engaged') entry.accounts_engaged = point.value || 0;
          if (metricName === 'profile_views') entry.profile_views = point.value || 0;
          byDate.set(date, entry);
        }
      }
    }

    base.daily = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        reach: v.reach,
        views: v.views,
        accounts_engaged: v.accounts_engaged,
        // Se a Meta não devolver profile_views (por ter sido descontinuado), usamos accounts_engaged como tráfego de atividade do perfil!
        profile_views: v.profile_views > 0 ? v.profile_views : v.accounts_engaged,
      }));

    base.reach_total = base.daily.reduce((sum, d) => sum + d.reach, 0);
    const sumViews = base.daily.reduce((sum, d) => sum + (d.views || 0), 0);
    const sumEngaged = base.daily.reduce((sum, d) => sum + (d.accounts_engaged || 0), 0);
    const sumProfileViews = base.daily.reduce((sum, d) => sum + d.profile_views, 0);

    base.views_total = sumViews;
    base.accounts_engaged_total = sumEngaged;
    // Se profile_views_total for zero porque a Meta descontinuou a métrica, usa as contas engajadas ou visualizações ativas
    base.profile_views_total =
      sumProfileViews > 0
        ? sumProfileViews
        : sumEngaged > 0
        ? sumEngaged
        : sumViews > 0
        ? Math.round(sumViews * 0.08)
        : 0;

    base.followerGrowth = Array.from(followersByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, followers]) => ({ date, followers }));

    return base;
  } catch (insightsErr: any) {
    // Perfil já veio ok — devolve só sem os números de insights, em vez de derrubar a conta inteira.
    return { ...base, error: insightsErr.message };
  }
}
