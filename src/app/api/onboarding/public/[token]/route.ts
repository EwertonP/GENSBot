import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { criarStateOnboarding } from '@/lib/onboarding-state';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório.' }, { status: 400 });
  }

  try {
    const { data: link, error: linkErr } = await db
      .from('cliente_onboarding_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (linkErr) {
      if (linkErr.code === '42P01') {
        return NextResponse.json(
          { error: 'Tabela de onboarding não migrada.' },
          { status: 503 }
        );
      }
      throw linkErr;
    }

    if (!link) {
      return NextResponse.json(
        { error: 'Link de onboarding não encontrado ou expirado.' },
        { status: 404 }
      );
    }

    const expirado = new Date() > new Date(link.expira_em);

    // Buscar dados do cliente
    const { data: cliente } = await db
      .from('clientes')
      .select('id, nome, foto_url, instagram_account_id, token_portal')
      .eq('id', link.cliente_id)
      .maybeSingle();

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente associado não encontrado.' },
        { status: 404 }
      );
    }

    // Buscar dados da agência
    const { data: agencia } = await db
      .from('agencias')
      .select('id, nome, logo_url')
      .eq('id', link.agencia_id)
      .maybeSingle();

    // Checar conexões ativas
    const instagramConectado = !!link.instagram_conectado_em || !!cliente.instagram_account_id;

    const { data: threadsAccount } = await db
      .from('social_accounts')
      .select('id, username')
      .eq('cliente_id', link.cliente_id)
      .eq('platform', 'threads')
      .maybeSingle();

    const threadsConectado = !!link.threads_conectado_em || !!threadsAccount;

    const { data: tiktokAccount } = await db
      .from('social_accounts')
      .select('id, username')
      .eq('cliente_id', link.cliente_id)
      .eq('platform', 'tiktok')
      .maybeSingle();

    const tiktokConectado = !!link.tiktok_conectado_em || !!tiktokAccount;

    // Origem dinâmica para redirecionamentos OAuth
    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;

    // Construção segura dos URLs de autorização com State HMAC
    const stateIg = criarStateOnboarding(token, link.cliente_id, 'instagram');
    const stateTh = criarStateOnboarding(token, link.cliente_id, 'threads');
    const stateTt = criarStateOnboarding(token, link.cliente_id, 'tiktok');

    const igClientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    const igRedirectUri = `${origin}/api/oauth/callback`;
    const igScopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'instagram_business_manage_insights',
      'instagram_business_content_publish',
      'ads_read',
      'ads_management',
      'business_management',
    ].join(',');

    const authUrlInstagram = igClientId
      ? `https://www.instagram.com/oauth/authorize?client_id=${igClientId}&redirect_uri=${encodeURIComponent(
          igRedirectUri
        )}&scope=${encodeURIComponent(igScopes)}&response_type=code&state=${encodeURIComponent(stateIg)}`
      : null;

    const thClientId = process.env.NEXT_PUBLIC_THREADS_CLIENT_ID || '2437920840075028';
    const thRedirectUri = `${origin}/api/integrations/threads/callback`;
    const thScopes = [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_insights',
    ].join(',');

    const authUrlThreads = `https://threads.net/oauth/authorize?client_id=${thClientId}&redirect_uri=${encodeURIComponent(
      thRedirectUri
    )}&scope=${encodeURIComponent(thScopes)}&response_type=code&state=${encodeURIComponent(stateTh)}`;

    const ttClientKey = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY;
    const ttRedirectUri = `${origin}/api/integrations/tiktok/callback`;
    const ttScopes = ['user.info.basic', 'video.publish', 'video.upload'].join(',');

    const authUrlTikTok = ttClientKey
      ? `https://www.tiktok.com/v2/auth/authorize/?client_key=${ttClientKey}&scope=${encodeURIComponent(
          ttScopes
        )}&response_type=code&redirect_uri=${encodeURIComponent(ttRedirectUri)}&state=${encodeURIComponent(stateTt)}`
      : null;

    return NextResponse.json({
      token: link.token,
      expirado,
      concluido_em: link.concluido_em,
      agencia: {
        id: agencia?.id || link.agencia_id,
        nome: agencia?.nome || 'Agência',
        logo_url: agencia?.logo_url || null,
      },
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        foto_url: cliente.foto_url || null,
        token_portal: cliente.token_portal || null,
      },
      handles: {
        instagram: link.instagram_username_informado || null,
        threads: link.threads_username_informado || null,
        tiktok: link.tiktok_username_informado || null,
      },
      convites: {
        instagram_enviado: !!link.convite_instagram_enviado,
        threads_enviado: !!link.convite_threads_enviado,
      },
      conexoes: {
        instagram: instagramConectado,
        instagram_conectado_em: link.instagram_conectado_em,
        threads: threadsConectado,
        threads_conectado_em: link.threads_conectado_em,
        tiktok: tiktokConectado,
        tiktok_conectado_em: link.tiktok_conectado_em,
      },
      urlsAuth: {
        instagram: authUrlInstagram,
        threads: authUrlThreads,
        tiktok: authUrlTikTok,
      },
    });
  } catch (err) {
    console.error('Erro na rota GET /api/onboarding/public/[token]:', err);
    return NextResponse.json({ error: 'Erro ao carregar onboarding.' }, { status: 500 });
  }
}
