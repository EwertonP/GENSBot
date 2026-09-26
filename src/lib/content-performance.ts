import { supabase } from '@/lib/supabase';

/**
 * Desempenho de conteúdo (posts/reels via Graph API + stories do GENSBot) —
 * fonte única da tela de Métricas, do Dashboard e do relatório público.
 * Só números que a Meta devolve: nada de valor inventado ou "de exemplo".
 */

export const ALLOWED_PERIODS = [7, 30, 90] as const;
export type Period = (typeof ALLOWED_PERIODS)[number];

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

/** Item de mídia orgânica direto da Graph API — inclui posts/reels publicados pelo
 * celular do cliente, que `scheduled_posts` nunca vê (Onda 2, item 2.1 do plano). */
interface OrganicMediaItem {
  id: string;
  instagram_user_id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: string;
  media_url: string;
  thumbnail_url?: string;
  caption: string | null;
  timestamp: string;
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

/** Toda a mídia (post/reels) da conta, direto da Meta — não só o que foi publicado
 * pelo GENSBot. Stories não vêm por aqui: a Graph API só expõe Stories ativas
 * (até 24h), sem histórico retroativo, então essas continuam vindo de `scheduled_posts`. */
async function fetchAccountOrganicMedia(instagramUserId: string, accessToken: string, sinceIso: string): Promise<OrganicMediaItem[]> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${instagramUserId}/media?fields=id,media_type,media_product_type,media_url,thumbnail_url,caption,timestamp&limit=50&access_token=${accessToken}`
    );
    const data = await res.json();
    if (!res.ok) return [];
    return (data.data || [])
      .filter((m: any) => m.timestamp >= sinceIso)
      .map((m: any) => ({ ...m, instagram_user_id: instagramUserId }));
  } catch {
    return [];
  }
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function buildEmptySparkline(period: Period): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    points.push({ date: dayKey(d.toISOString()), value: 0 });
  }
  return points;
}

export interface ContentTarget {
  instagram_user_id: string;
  access_token: string;
}

export async function computeContentPerformance(targets: ContentTarget[], period: Period) {
    const accountIds = targets.map((t) => t.instagram_user_id);
    const tokenByAccount = new Map(targets.map((t) => [t.instagram_user_id, t.access_token]));
    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

    // Stories continuam vindo só de `scheduled_posts` (limitação da própria Graph
    // API — sem histórico retroativo de Stories orgânicas, ver fetchAccountOrganicMedia).
    const { data: storyPublications, error: storyError } = await supabase
      .from('scheduled_posts')
      .select('id, instagram_user_id, media_type, media_url, media_urls, caption, published_at, ig_media_id')
      .in('instagram_user_id', accountIds)
      .eq('media_type', 'STORIES')
      .eq('status', 'published')
      .not('ig_media_id', 'is', null)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(50);

    if (storyError) throw storyError;

    // Posts/Reels: direto da Graph API (toda a mídia da conta, publicada pelo GENSBot ou
    // não) em vez de só `scheduled_posts` — corrige o ranking ignorando posts feitos
    // direto do celular do cliente (Onda 2, item 2.1 do plano).
    const organicMediaByAccount = await Promise.all(
      targets.map((t) => fetchAccountOrganicMedia(t.instagram_user_id, t.access_token, since))
    );
    const organicMedia = organicMediaByAccount.flat();

    const rows: PublicationRow[] = [
      ...(storyPublications || []) as PublicationRow[],
      ...organicMedia.map((m): PublicationRow => ({
        id: m.id,
        instagram_user_id: m.instagram_user_id,
        media_type: m.media_product_type === 'REELS' ? 'REELS' : m.media_type,
        media_url: m.thumbnail_url || m.media_url,
        media_urls: null,
        caption: m.caption,
        published_at: m.timestamp,
        ig_media_id: m.id,
      })),
    ];

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

    const byFormat = {
      posts: { count: 0, reach: 0, interactions: 0 },
      reels: { count: 0, reach: 0, interactions: 0 },
      stories: { count: 0, reach: 0, interactions: 0 },
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

      const fmt = row.media_type === 'REELS' ? byFormat.reels : row.media_type === 'STORIES' ? byFormat.stories : byFormat.posts;
      fmt.count += 1;
      fmt.reach += row.reach;
      fmt.interactions += row.interactions;
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

    return {
      summary: {
        posts,
        reels,
        stories,
        reachTotal,
        engagementRate,
        byFormat,
        postsSparkline,
        reelsSparkline,
        storiesSparkline,
        reachSparkline,
      },
      topPublications,
      topStories,
    };
}
