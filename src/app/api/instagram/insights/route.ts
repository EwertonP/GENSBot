import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { listInstagramAccountsForUser, getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';

const ALLOWED_PERIODS = [7, 30, 90] as const; // 90d é o teto de retenção de insights da Meta
type Period = (typeof ALLOWED_PERIODS)[number];

interface DailyPoint {
  date: string;
  reach: number;
  profile_views: number;
}

interface FollowerPoint {
  date: string;
  followers: number;
}

interface PublicationPoint {
  date: string;
  count: number;
}

interface AccountMetrics {
  instagram_user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  period: Period;
  reach_total: number;
  profile_views_total: number;
  daily: DailyPoint[];
  followerGrowth: FollowerPoint[];
  followerGrowthUnavailable: boolean; // true = conta com <100 seguidores, a Meta não fornece esse dado
  publicationsGrowth: PublicationPoint[];
  error?: string;
}

/**
 * Alguns nomes de métrica podem ser rejeitados pela Graph API dependendo da
 * versão/conta (ex: profile_views tem histórico de mudança entre versões —
 * PLANO_REDESIGN_2.0.md Parte 4 pede confirmar isso contra a resposta real
 * em vez de supor). Tenta o conjunto inteiro e, se um nome for rejeitado,
 * refaz só com o que sobrou em vez de falhar a chamada toda.
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

  const invalidMetric = metrics.find((m) => data.error?.message?.includes(m));
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

async function fetchAccountMetrics(instagramUserId: string, accessToken: string, period: Period): Promise<AccountMetrics> {
  const base: AccountMetrics = {
    instagram_user_id: instagramUserId,
    username: null,
    profile_picture_url: null,
    followers_count: null,
    media_count: null,
    period,
    reach_total: 0,
    profile_views_total: 0,
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
  const metricsToFetch = hasEnoughFollowersForGrowth
    ? ['reach', 'profile_views', 'follower_count']
    : ['reach', 'profile_views'];

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

    const byDate = new Map<string, { reach: number; profile_views: number }>();
    const followersByDate = new Map<string, number>();

    for (const series of seriesData) {
      const metricName: string = series.name;
      for (const point of series.values || []) {
        const date = String(point.end_time).slice(0, 10);
        if (metricName === 'follower_count') {
          followersByDate.set(date, point.value || 0);
        } else if (metricName === 'reach' || metricName === 'profile_views') {
          const entry = byDate.get(date) || { reach: 0, profile_views: 0 };
          entry[metricName] = point.value || 0;
          byDate.set(date, entry);
        }
      }
    }

    base.daily = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, reach: v.reach, profile_views: v.profile_views }));
    base.reach_total = base.daily.reduce((sum, d) => sum + d.reach, 0);
    base.profile_views_total = base.daily.reduce((sum, d) => sum + d.profile_views, 0);

    base.followerGrowth = Array.from(followersByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, followers]) => ({ date, followers }));

    return base;
  } catch (insightsErr: any) {
    // Perfil já veio ok — devolve só sem os números de insights, em vez de derrubar a conta inteira.
    return { ...base, error: insightsErr.message };
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const url = new URL(req.url);
    const accountParam = url.searchParams.get('account');
    const periodParam = Number(url.searchParams.get('period'));
    const period = (ALLOWED_PERIODS.includes(periodParam as Period) ? periodParam : 7) as Period;
    const isAggregate = !accountParam || accountParam === 'all';

    let targets: { instagram_user_id: string; access_token: string }[] = [];

    if (isAggregate) {
      const accounts = await listInstagramAccountsForUser(user.id);
      const { data: withTokens } = await supabase
        .from('instagram_accounts')
        .select('instagram_user_id, access_token')
        .eq('user_id', user.id)
        .in('instagram_user_id', accounts.map((a) => a.instagram_user_id));
      targets = withTokens || [];
    } else {
      const account = await getInstagramAccountByInstagramUserId(accountParam);
      if (account && account.user_id === user.id) {
        targets = [{ instagram_user_id: account.instagram_user_id, access_token: account.access_token }];
      }
    }

    if (targets.length === 0) return NextResponse.json([]);

    const results = await Promise.allSettled(targets.map((t) => fetchAccountMetrics(t.instagram_user_id, t.access_token, period)));

    const metrics = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { instagram_user_id: targets[i].instagram_user_id, error: 'Falha ao buscar métricas.' }
    );

    return NextResponse.json(metrics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
