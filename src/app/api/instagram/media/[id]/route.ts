import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

/**
 * Busca um único nó de mídia (post ou story) por ID — usado pela miniatura
 * da listagem de automações. Funciona igual pros dois casos na Graph API;
 * stories somem depois de 24h (mesma limitação de src/app/api/instagram/stories/route.ts),
 * então um 404 aqui pode simplesmente significar "story expirada".
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    if (!config || !config.access_token) {
      return NextResponse.json({ error: 'Instagram não conectado.' }, { status: 400 });
    }

    const response = await fetch(
      `https://graph.instagram.com/v25.0/${id}?fields=id,media_type,media_url,thumbnail_url,permalink&access_token=${config.access_token}`
    );
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Mídia indisponível.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
