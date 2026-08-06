import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

// GET: Lista as stories atualmente ativas da conta (a API da Meta só devolve
// stories publicadas nas últimas 24h — depois disso elas somem daqui, mesmo
// que ainda existam no destaque do perfil).
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    if (!config || !config.access_token || !config.instagram_user_id) {
      return NextResponse.json({ error: 'Instagram não conectado.' }, { status: 400 });
    }

    const response = await fetch(
      `https://graph.instagram.com/v25.0/${config.instagram_user_id}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp,permalink&access_token=${config.access_token}`
    );
    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao buscar stories do Instagram:', data);
      return NextResponse.json({ error: data.error?.message || 'Erro ao buscar stories.' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Erro na API de stories:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
