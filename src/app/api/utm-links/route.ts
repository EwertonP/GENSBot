import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';
import { buildUtmUrl } from '@/lib/utm';

function withShortUrl<T extends { short_code?: string | null }>(req: Request, link: T) {
  const origin = new URL(req.url).origin;
  return { ...link, short_url: link.short_code ? `${origin}/r/${link.short_code}` : null };
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { data, error } = await supabase
      .from('utm_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data || []).map(link => withShortUrl(req, link)));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    if (!body.base_url) {
      return NextResponse.json({ error: 'URL de destino é obrigatória.' }, { status: 400 });
    }

    let generatedUrl: string;
    try {
      generatedUrl = buildUtmUrl(body.base_url, {
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
        utm_term: body.utm_term,
        utm_content: body.utm_content,
      });
    } catch {
      return NextResponse.json({ error: 'URL de destino inválida.' }, { status: 400 });
    }

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    // Código curto pro redirect de rastreamento (src/app/r/[code]) — 6 chars em base36
    // (~2 bilhões de combinações) é suficiente pro volume deste produto; um retry
    // simples cobre a rara colisão em vez de precisar checar disponibilidade antes.
    let insertResult: { data: any; error: any } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = crypto.randomBytes(4).toString('hex').slice(0, 6);
      insertResult = await supabase
        .from('utm_links')
        .insert({
          user_id: user.id,
          instagram_user_id: config?.instagram_user_id || null,
          name: body.name || null,
          base_url: body.base_url,
          utm_source: body.utm_source || null,
          utm_medium: body.utm_medium || null,
          utm_campaign: body.utm_campaign || null,
          utm_term: body.utm_term || null,
          utm_content: body.utm_content || null,
          generated_url: generatedUrl,
          short_code: shortCode,
          automation_id: body.automation_id || null,
        })
        .select()
        .single();

      if (!insertResult.error || insertResult.error.code !== '23505') break;
    }

    if (!insertResult || insertResult.error) {
      return NextResponse.json({ error: insertResult?.error?.message || 'Erro ao gerar o link.' }, { status: 500 });
    }
    return NextResponse.json(withShortUrl(req, insertResult.data));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
