import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId, listInstagramAccountsForUser } from '@/lib/instagram-account';
import { publishPost, PublishMediaType } from '@/lib/instagram-publish';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    const { instagram_user_id, media_type, media_url, media_urls, caption, scheduled_at, collaborators, user_tags } = body as {
      instagram_user_id: string;
      media_type: PublishMediaType;
      media_url: string;
      media_urls?: string[];
      caption?: string;
      scheduled_at?: string;
      collaborators?: string[];
      user_tags?: { username: string }[];
    };

    if (!instagram_user_id || !media_type || !media_url) {
      return NextResponse.json({ error: 'Conta, tipo de mídia e arquivo são obrigatórios.' }, { status: 400 });
    }
    if (media_type === 'CAROUSEL' && (!media_urls || media_urls.length < 2)) {
      return NextResponse.json({ error: 'Carrossel precisa de ao menos 2 itens de mídia.' }, { status: 400 });
    }

    const account = await getInstagramAccountByInstagramUserId(instagram_user_id);
    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    const isFuture = scheduled_at && new Date(scheduled_at).getTime() > Date.now() + 60_000;

    const commonFields = {
      user_id: user.id,
      instagram_user_id,
      media_type,
      media_url,
      media_urls: media_urls || null,
      caption: caption || null,
      collaborators: collaborators || null,
      user_tags: user_tags || null,
    };

    if (isFuture) {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({ ...commonFields, scheduled_at, status: 'scheduled' })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // Publicação imediata: chama a Graph API na hora e já grava como 'published'.
    try {
      const { igMediaId } = await publishPost({
        instagramUserId: instagram_user_id,
        accessToken: account.access_token,
        mediaType: media_type,
        mediaUrl: media_url,
        mediaUrls: media_urls,
        caption,
        collaborators,
        userTags: user_tags,
      });

      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          ...commonFields,
          scheduled_at: new Date().toISOString(),
          status: 'published',
          ig_media_id: igMediaId,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } catch (publishErr: any) {
      const { data } = await supabase
        .from('scheduled_posts')
        .insert({
          ...commonFields,
          scheduled_at: new Date().toISOString(),
          status: 'failed',
          error_message: publishErr.message,
        })
        .select()
        .single();

      return NextResponse.json({ error: publishErr.message, post: data }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');

    let query = supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (accountParam && accountParam !== 'all') {
      query = query.eq('instagram_user_id', accountParam);
    } else {
      const accounts = await listInstagramAccountsForUser(user.id);
      query = query.in('instagram_user_id', accounts.map((a) => a.instagram_user_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
