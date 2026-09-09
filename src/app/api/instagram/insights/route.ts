import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { listInstagramAccountsForUser, getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';

interface DailyPoint {
  date: string;
  reach: number;
  profile_views: number;
}

interface AccountMetrics {
  instagram_user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  reach_total: number;
  profile_views_total: number;
  daily: DailyPoint[];
  error?: string;
}

async function fetchAccountMetrics(instagramUserId: string, accessToken: string): Promise<AccountMetrics> {
  const base: AccountMetrics = {
    instagram_user_id: instagramUserId,
    username: null,
    profile_picture_url: null,
    followers_count: null,
    media_count: null,
    reach_total: 0,
    profile_views_total: 0,
    daily: [],
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

  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const insightsRes = await fetch(
    `https://graph.instagram.com/v25.0/${instagramUserId}/insights?metric=reach,profile_views&period=day&since=${since}&until=${until}&access_token=${accessToken}`
  );
  const insightsData = await insightsRes.json();
  if (!insightsRes.ok) {
    // Perfil já veio ok — devolve só sem os números de insights, em vez de derrubar a conta inteira.
    return { ...base, error: insightsData.error?.message || 'Insights indisponível para esta conta.' };
  }

  const byDate = new Map<string, { reach: number; profile_views: number }>();
  for (const series of insightsData.data || []) {
    const metricName: 'reach' | 'profile_views' = series.name;
    for (const point of series.values || []) {
      const date = String(point.end_time).slice(0, 10);
      const entry = byDate.get(date) || { reach: 0, profile_views: 0 };
      entry[metricName] = point.value || 0;
      byDate.set(date, entry);
    }
  }

  base.daily = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, reach: v.reach, profile_views: v.profile_views }));
  base.reach_total = base.daily.reduce((sum, d) => sum + d.reach, 0);
  base.profile_views_total = base.daily.reduce((sum, d) => sum + d.profile_views, 0);

  return base;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');
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

    const results = await Promise.allSettled(targets.map((t) => fetchAccountMetrics(t.instagram_user_id, t.access_token)));

    const metrics = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { instagram_user_id: targets[i].instagram_user_id, error: 'Falha ao buscar métricas.' }
    );

    return NextResponse.json(metrics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
