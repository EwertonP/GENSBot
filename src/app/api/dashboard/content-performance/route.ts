import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId, listInstagramAccountsForUser } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';

const ALLOWED_PERIODS = [7, 30, 90] as const;
type Period = (typeof ALLOWED_PERIODS)[number];

interface PublicationRow {
  id: string;
  instagram_user_id: string;
  media_type: string;
  media_url: string;
  media_urls: string[] | null;
  caption: string | null;
  published_at: string;
  ig_media_id: string;
}

interface PublicationWithMetrics extends PublicationRow {
  reach: number;
  interactions: number;
}

async function fetchMediaMetrics(mediaId: string, accessToken: string): Promise<{ reach: number; interactions: number }> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}/insights?metric=reach,total_interactions&access_token=${accessToken}`
    );
    const data = await res.json();
    if (!res.ok) return { reach: 0, interactions: 0 };
    const values: Record<string, number> = {};
    for (const series of data.data || []) {
      values[series.name] = series.values?.[0]?.value ?? series.total_value?.value ?? 0;
    }
    return { reach: values.reach || 0, interactions: values.total_interactions || 0 };
  } catch {
    return { reach: 0, interactions: 0 };
  }
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function buildEmptySparkline(period: Period): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    points.push({ date: dayKey(d.toISOString()), value: 0 });
  }
  return points;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const url = new URL(req.url);
    const accountParam = url.searchParams.get('account');
    const periodParam = Number(url.searchParams.get('period'));
    const period = (ALLOWED_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period;
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

    if (targets.length === 0) {
      return NextResponse.json({
        summary: {
          posts: 0,
          reels: 0,
          stories: 0,
          reachTotal: 0,
          engagementRate: 0,
          postsSparkline: buildEmptySparkline(period),
          reelsSparkline: buildEmptySparkline(period),
          storiesSparkline: buildEmptySparkline(period),
          reachSparkline: buildEmptySparkline(period),
        },
        topPublications: [],
        topStories: [],
        linkClicks: { bio: 0, dm: 0 },
      });
    }

    const tokenByAccount = new Map(targets.map((t) => [t.instagram_user_id, t.access_token]));
    const accountIds = targets.map((t) => t.instagram_user_id);
    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

    const { data: publications, error: pubError } = await supabase
      .from('scheduled_posts')
      .select('id, instagram_user_id, media_type, media_url, media_urls, caption, published_at, ig_media_id')
      .in('instagram_user_id', accountIds)
      .eq('status', 'published')
      .not('ig_media_id', 'is', null)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(50);

    if (pubError) throw pubError;

    const rows = (publications || []) as PublicationRow[];

    const withMetrics: PublicationWithMetrics[] = await Promise.all(
      rows.map(async (row) => {
        const token = tokenByAccount.get(row.instagram_user_id);
        const metrics = token ? await fetchMediaMetrics(row.ig_media_id, token) : { reach: 0, interactions: 0 };
        return { ...row, ...metrics };
      })
    );

    const postsSparkline = buildEmptySparkline(period);
    const reelsSparkline = buildEmptySparkline(period);
    const storiesSparkline = buildEmptySparkline(period);
    const reachSparkline = buildEmptySparkline(period);
    const bumpSparkline = (points: { date: string; value: number }[], date: string, amount = 1) => {
      const point = points.find((p) => p.date === date);
      if (point) point.value += amount;
    };

    let posts = 0;
    let reels = 0;
    let stories = 0;
    let reachTotal = 0;
    let interactionsTotal = 0;

    for (const row of withMetrics) {
      const date = dayKey(row.published_at);
      reachTotal += row.reach;
      bumpSparkline(reachSparkline, date, row.reach);

      if (row.media_type === 'REELS') {
        reels += 1;
        bumpSparkline(reelsSparkline, date);
        interactionsTotal += row.interactions;
      } else if (row.media_type === 'STORIES') {
        stories += 1;
        bumpSparkline(storiesSparkline, date);
      } else {
        posts += 1;
        bumpSparkline(postsSparkline, date);
        interactionsTotal += row.interactions;
      }
    }

    const engagementRate = reachTotal > 0 ? Math.round((interactionsTotal / reachTotal) * 1000) / 10 : 0;

    const nonStoryPublications = withMetrics.filter((r) => r.media_type !== 'STORIES');
    const topPublications = [...nonStoryPublications]
      .sort((a, b) => b.reach + b.interactions - (a.reach + a.interactions))
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        media_type: r.media_type,
        media_url: r.media_url,
        media_count: r.media_urls?.length || 1,
        caption: r.caption,
        published_at: r.published_at,
        reach: r.reach,
        interactions: r.interactions,
      }));

    const topStories = withMetrics
      .filter((r) => r.media_type === 'STORIES')
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        media_url: r.media_url,
        published_at: r.published_at,
        reach: r.reach,
      }));

    const { data: utmLinks } = await supabase
      .from('utm_links')
      .select('automation_id, click_count, instagram_user_id')
      .eq('user_id', user.id)
      .in('instagram_user_id', accountIds);

    let bioClicks = 0;
    let dmClicks = 0;
    for (const link of utmLinks || []) {
      if (link.automation_id === null) bioClicks += link.click_count || 0;
      else dmClicks += link.click_count || 0;
    }

    return NextResponse.json({
      summary: {
        posts,
        reels,
        stories,
        reachTotal,
        engagementRate,
        postsSparkline,
        reelsSparkline,
        storiesSparkline,
        reachSparkline,
      },
      topPublications,
      topStories,
      linkClicks: { bio: bioClicks, dm: dmClicks },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
