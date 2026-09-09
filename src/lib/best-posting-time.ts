/**
 * Sugestão de melhor horário pra postar (PLANO_REDESIGN_2.0.md Parte 5).
 * Honesto com o dado que o GENSBot realmente tem: agrega só os próprios
 * posts já publicados da conta (sem base externa tipo Metricool) por dia
 * da semana × faixa de horário de 3h, e destaca os blocos com melhor
 * alcance médio. Não inventa uma sugestão pra conta sem histórico.
 */

import { supabase } from '@/lib/supabase';

const GRAPH_BASE = 'https://graph.instagram.com/v25.0';
const MIN_POSTS_FOR_SUGGESTION = 10;
const MAX_POSTS_ANALYZED = 30;
const BLOCK_HOURS = 3; // 8 blocos de 3h por dia

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export interface PostingTimeSuggestion {
  weekday: number; // 0 = domingo
  weekdayLabel: string;
  hourStart: number;
  hourEnd: number;
  avgReach: number;
  sampleSize: number;
}

export type BestPostingTimeResult =
  | { insufficientData: true; postsAnalyzed: number; minRequired: number }
  | { insufficientData: false; suggestions: PostingTimeSuggestion[] };

async function fetchReach(mediaId: string, accessToken: string): Promise<number> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${mediaId}/insights?metric=reach&access_token=${accessToken}`);
    const data = await res.json();
    if (!res.ok) return 0;
    return data.data?.[0]?.values?.[0]?.value ?? 0;
  } catch {
    return 0;
  }
}

export async function getBestPostingTimes(
  instagramUserId: string,
  accessToken: string
): Promise<BestPostingTimeResult> {
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('ig_media_id, published_at')
    .eq('instagram_user_id', instagramUserId)
    .eq('status', 'published')
    .not('ig_media_id', 'is', null)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(MAX_POSTS_ANALYZED);

  if (error) throw error;

  if (!posts || posts.length < MIN_POSTS_FOR_SUGGESTION) {
    return { insufficientData: true, postsAnalyzed: posts?.length || 0, minRequired: MIN_POSTS_FOR_SUGGESTION };
  }

  // Buckets[weekday][block] = { total, count }
  const buckets = new Map<string, { total: number; count: number }>();

  await Promise.all(
    posts.map(async (post) => {
      const reach = await fetchReach(post.ig_media_id as string, accessToken);
      const publishedAt = new Date(post.published_at as string);
      const weekday = publishedAt.getDay();
      const block = Math.floor(publishedAt.getHours() / BLOCK_HOURS);
      const key = `${weekday}-${block}`;
      const bucket = buckets.get(key) || { total: 0, count: 0 };
      bucket.total += reach;
      bucket.count += 1;
      buckets.set(key, bucket);
    })
  );

  const suggestions: PostingTimeSuggestion[] = Array.from(buckets.entries())
    .map(([key, { total, count }]) => {
      const [weekdayStr, blockStr] = key.split('-');
      const weekday = Number(weekdayStr);
      const block = Number(blockStr);
      return {
        weekday,
        weekdayLabel: WEEKDAY_LABELS[weekday],
        hourStart: block * BLOCK_HOURS,
        hourEnd: block * BLOCK_HOURS + BLOCK_HOURS,
        avgReach: Math.round(total / count),
        sampleSize: count,
      };
    })
    .sort((a, b) => b.avgReach - a.avgReach)
    .slice(0, 3);

  return { insufficientData: false, suggestions };
}
