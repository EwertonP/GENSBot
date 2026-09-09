import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { publishPost, PublishMediaType } from '@/lib/instagram-publish';

const DAILY_LIMIT_PER_ACCOUNT = 100;

async function handlePublishScheduled(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const { data: due, error: dueError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20);

    if (dueError) throw dueError;
    if (!due || due.length === 0) {
      return NextResponse.json({ message: 'Nenhuma publicação agendada pendente.' });
    }

    const results: { id: string; status: string }[] = [];
    const rateLimitedAccounts = new Set<string>();

    for (const post of due) {
      if (rateLimitedAccounts.has(post.instagram_user_id)) continue;

      // Limite de 100 publicações/24h por conta, aplicado pela própria Meta —
      // checa antes de tentar pra não gastar chamada à API à toa.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true })
        .eq('instagram_user_id', post.instagram_user_id)
        .eq('status', 'published')
        .gt('published_at', since);

      if ((count || 0) >= DAILY_LIMIT_PER_ACCOUNT) {
        rateLimitedAccounts.add(post.instagram_user_id);
        results.push({ id: post.id, status: 'rate_limited' });
        continue;
      }

      await supabase.from('scheduled_posts').update({ status: 'publishing' }).eq('id', post.id);

      const { data: account } = await supabase
        .from('instagram_accounts')
        .select('access_token')
        .eq('instagram_user_id', post.instagram_user_id)
        .maybeSingle();

      if (!account?.access_token) {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'failed', error_message: 'Conta do Instagram sem token válido.' })
          .eq('id', post.id);
        results.push({ id: post.id, status: 'failed' });
        continue;
      }

      try {
        const { igMediaId } = await publishPost({
          instagramUserId: post.instagram_user_id,
          accessToken: account.access_token,
          mediaType: post.media_type as PublishMediaType,
          mediaUrl: post.media_url,
          mediaUrls: post.media_urls,
          caption: post.caption,
          collaborators: post.collaborators,
          userTags: post.user_tags,
        });

        await supabase
          .from('scheduled_posts')
          .update({ status: 'published', ig_media_id: igMediaId, published_at: new Date().toISOString() })
          .eq('id', post.id);

        results.push({ id: post.id, status: 'published' });
      } catch (publishErr: any) {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'failed', error_message: publishErr.message })
          .eq('id', post.id);
        results.push({ id: post.id, status: 'failed' });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err: any) {
    console.error('Erro geral no worker de publicação agendada:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handlePublishScheduled(req);
}

export async function POST(req: Request) {
  return handlePublishScheduled(req);
}
