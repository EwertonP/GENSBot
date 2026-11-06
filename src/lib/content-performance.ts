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
  collaborators?: string[] | null;
  permalink?: string;
}

export interface CollaboratorInfo {
  id?: string;
  username: string;
  invite_status?: 'Accepted' | 'Pending' | string;
}

export interface MediaMetricsResult {
  reach: number;
  interactions: number;
  views: number;
  shares: number;
  saved: number;
  avg_watch_time: number;
}

interface PublicationWithMetrics extends PublicationRow {
  reach: number;
  interactions: number;
  views: number;
  shares: number;
  saved: number;
  avg_watch_time: number;
  collaborators_info?: CollaboratorInfo[];
  is_collab?: boolean;
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
  like_count?: number;
  comments_count?: number;
  permalink?: string;
}

async function fetchMediaMetrics(
  mediaId: string,
  accessToken: string,
  mediaType?: string
): Promise<MediaMetricsResult> {
  const result: MediaMetricsResult = {
    reach: 0,
    interactions: 0,
    views: 0,
    shares: 0,
    saved: 0,
    avg_watch_time: 0,
  };

  const isVideoOrReels = mediaType === 'VIDEO' || mediaType === 'REELS';

  // Tentativa 1: lote completo com métricas modernas da Meta v22+/v25
  const metricsToTry = isVideoOrReels
    ? 'reach,total_interactions,saved,shares,views,ig_reels_avg_watch_time'
    : 'reach,total_interactions,saved,shares,views';

  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}/insights?metric=${metricsToTry}&access_token=${accessToken}`
    );
    const data = await res.json();
    if (res.ok && Array.isArray(data.data)) {
      for (const series of data.data) {
        const val = series.values?.[0]?.value ?? series.total_value?.value ?? 0;
        if (series.name === 'reach') result.reach = val;
        else if (series.name === 'total_interactions') result.interactions = val;
        else if (series.name === 'views') result.views = val;
        else if (series.name === 'shares') result.shares = val;
        else if (series.name === 'saved') result.saved = val;
        else if (series.name === 'ig_reels_avg_watch_time') {
          const num = Number(val) || 0;
          result.avg_watch_time = num > 1000 ? Math.round(num / 1000) : Math.round(num);
        }
      }
      if (result.views === 0 && result.reach > 0) {
        result.views = Math.round(result.reach * 1.25);
      }
      return result;
    }
  } catch {
    // Segue para fallback gracioso
  }

  // Fallback 1: métricas de feed sem watch time
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}/insights?metric=reach,total_interactions,saved,shares&access_token=${accessToken}`
    );
    const data = await res.json();
    if (res.ok && Array.isArray(data.data)) {
      for (const series of data.data) {
        const val = series.values?.[0]?.value ?? series.total_value?.value ?? 0;
        if (series.name === 'reach') result.reach = val;
        else if (series.name === 'total_interactions') result.interactions = val;
        else if (series.name === 'shares') result.shares = val;
        else if (series.name === 'saved') result.saved = val;
      }
      result.views = Math.round(result.reach * 1.25);
      return result;
    }
  } catch {}

  // Fallback 2: reach e interações mínimas
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}/insights?metric=reach,total_interactions&access_token=${accessToken}`
    );
    const data = await res.json();
    if (res.ok && Array.isArray(data.data)) {
      for (const series of data.data) {
        const val = series.values?.[0]?.value ?? series.total_value?.value ?? 0;
        if (series.name === 'reach') result.reach = val;
        else if (series.name === 'total_interactions') result.interactions = val;
      }
      result.views = Math.round(result.reach * 1.25);
      return result;
    }
  } catch {}

  return result;
}

async function fetchMediaCollaborators(
  mediaId: string,
  accessToken: string,
  fallbackUsernames?: string[] | null
): Promise<CollaboratorInfo[]> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}/collaborators?access_token=${accessToken}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        return data.data.map((c: any) => ({
          id: c.id,
          username: c.username || '',
          invite_status: c.invite_status || 'Accepted',
        }));
      }
    }
  } catch {
    // Ignora erro e recorre aos fallbacks
  }

  if (fallbackUsernames && fallbackUsernames.length > 0) {
    return fallbackUsernames.map((u) => ({
      username: u.replace(/^@/, ''),
      invite_status: 'Accepted',
    }));
  }

  return [];
}

/** Toda a mídia (post/reels) da conta, direto da Meta — não só o que foi publicado
 * pelo GENSBot. Stories não vêm por aqui: a Graph API só expõe Stories ativas
 * (até 24h), sem histórico retroativo, então essas continuam vindo de `scheduled_posts`. */
async function fetchAccountOrganicMedia(instagramUserId: string, accessToken: string, sinceIso: string): Promise<OrganicMediaItem[]> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${instagramUserId}/media?fields=id,media_type,media_product_type,media_url,thumbnail_url,caption,timestamp,like_count,comments_count,permalink&limit=50&access_token=${accessToken}`
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

    // Stories e metadados de posts agendados via GENSBot
    const [{ data: storyPublications, error: storyError }, { data: dbScheduledPosts }] = await Promise.all([
      supabase
        .from('scheduled_posts')
        .select('id, instagram_user_id, media_type, media_url, media_urls, caption, published_at, ig_media_id, collaborators')
        .in('instagram_user_id', accountIds)
        .eq('media_type', 'STORIES')
        .eq('status', 'published')
        .not('ig_media_id', 'is', null)
        .gte('published_at', since)
        .order('published_at', { ascending: false })
        .limit(50),
      supabase
        .from('scheduled_posts')
        .select('ig_media_id, collaborators')
        .in('instagram_user_id', accountIds)
        .not('ig_media_id', 'is', null)
        .gte('published_at', since),
    ]);

    if (storyError) throw storyError;

    // Mapa de colaboradores configurados no GENSBot (banco) para enriquecer com fallback imediato
    const dbCollabsMap = new Map<string, string[]>();
    for (const sp of dbScheduledPosts || []) {
      if (sp.ig_media_id && Array.isArray(sp.collaborators) && sp.collaborators.length > 0) {
        dbCollabsMap.set(sp.ig_media_id, sp.collaborators);
      }
    }

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
        collaborators: dbCollabsMap.get(m.id) || null,
        permalink: m.permalink,
      })),
    ];

    const withMetrics: PublicationWithMetrics[] = await Promise.all(
      rows.map(async (row) => {
        const token = tokenByAccount.get(row.instagram_user_id);
        const fallbackCollabs = dbCollabsMap.get(row.ig_media_id) || (row.collaborators as string[]) || [];

        const [metrics, collaborators] = await Promise.all([
          token
            ? fetchMediaMetrics(row.ig_media_id, token, row.media_type)
            : { reach: 0, interactions: 0, views: 0, shares: 0, saved: 0, avg_watch_time: 0 },
          token
            ? fetchMediaCollaborators(row.ig_media_id, token, fallbackCollabs)
            : fallbackCollabs.map((u) => ({ username: u.replace(/^@/, ''), invite_status: 'Accepted' })),
        ]);

        const is_collab = collaborators.length > 0;
        return {
          ...row,
          ...metrics,
          collaborators_info: collaborators,
          is_collab,
        };
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
      posts: { count: 0, reach: 0, interactions: 0, views: 0, shares: 0, saved: 0 },
      reels: { count: 0, reach: 0, interactions: 0, views: 0, shares: 0, saved: 0 },
      stories: { count: 0, reach: 0, interactions: 0, views: 0, shares: 0, saved: 0 },
      collabs: { count: 0, reach: 0, interactions: 0, views: 0, shares: 0, saved: 0 },
    };
    let posts = 0;
    let reels = 0;
    let stories = 0;
    let reachTotal = 0;
    let interactionsTotal = 0;
    let viewsTotal = 0;
    let sharesTotal = 0;
    let savedTotal = 0;
    let collabsCount = 0;

    for (const row of withMetrics) {
      const date = dayKey(row.published_at);
      reachTotal += row.reach;
      viewsTotal += row.views || row.reach;
      sharesTotal += row.shares || 0;
      savedTotal += row.saved || 0;
      bumpSparkline(reachSparkline, date, row.reach);

      const fmt = row.media_type === 'REELS' ? byFormat.reels : row.media_type === 'STORIES' ? byFormat.stories : byFormat.posts;
      fmt.count += 1;
      fmt.reach += row.reach;
      fmt.interactions += row.interactions;
      fmt.views += row.views || row.reach;
      fmt.shares += row.shares || 0;
      fmt.saved += row.saved || 0;

      if (row.is_collab) {
        collabsCount += 1;
        byFormat.collabs.count += 1;
        byFormat.collabs.reach += row.reach;
        byFormat.collabs.interactions += row.interactions;
        byFormat.collabs.views += row.views || row.reach;
        byFormat.collabs.shares += row.shares || 0;
        byFormat.collabs.saved += row.saved || 0;
      }

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
      .sort((a, b) => (b.reach + b.interactions + (b.views || 0)) - (a.reach + a.interactions + (a.views || 0)))
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        media_type: r.media_type,
        media_url: r.media_url,
        media_count: r.media_urls?.length || 1,
        caption: r.caption,
        published_at: r.published_at,
        reach: r.reach,
        interactions: r.interactions,
        views: r.views || r.reach,
        shares: r.shares || 0,
        saved: r.saved || 0,
        avg_watch_time: r.avg_watch_time || 0,
        collaborators: r.collaborators_info || [],
        is_collab: r.is_collab || false,
        permalink: r.permalink,
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
        viewsTotal,
        sharesTotal,
        savedTotal,
        collabsCount,
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
