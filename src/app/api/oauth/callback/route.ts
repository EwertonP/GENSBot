import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error || !code) {
    console.error('Erro no Instagram OAuth:', error, errorDescription);
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(errorDescription || 'Erro ao fazer login'), req.url)
    );
  }

  // Obter o usuário autenticado via Supabase SSR
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server component */ }
        },
      },
    }
  );

  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const userId = authUser.id;

  const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent('Configuração do app do Instagram incompleta.'), req.url)
    );
  }

  // Obter o redirect_uri dinâmico
  const host = req.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/oauth/callback`;

  try {
    // 1. Trocar o code pelo Token de Acesso Curto
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Erro ao trocar token curto:', tokenData);
      throw new Error(tokenData.error_message || 'Erro ao obter token de curto prazo.');
    }

    const shortToken = tokenData.access_token;

    // 2. Trocar pelo Token de Acesso Longo (60 dias)
    const longTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortToken}`
    );
    const longTokenData = await longTokenResponse.json();

    if (!longTokenResponse.ok || !longTokenData.access_token) {
      console.error('Erro ao trocar token longo:', longTokenData);
      throw new Error('Erro ao obter token de longo prazo.');
    }

    const longToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in || 5184000; // 60 dias em segundos
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + expiresIn);

    // 3. Buscar perfil do usuário
    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username,name,profile_picture_url&access_token=${longToken}`
    );
    const profileData = await profileResponse.json();

    if (!profileResponse.ok || !profileData.user_id) {
      console.error('Erro ao buscar perfil:', profileData);
      throw new Error('Erro ao buscar dados do perfil do Instagram.');
    }

    const igUserId = profileData.user_id;
    const igUsername = profileData.username;
    const profilePictureUrl = profileData.profile_picture_url || null;

    // 4. Salvar na tabela `instagram_accounts` (multi-tenant)
    const { error: accountError } = await supabase.from('instagram_accounts').upsert({
      user_id: userId,
      instagram_user_id: igUserId,
      instagram_username: igUsername,
      access_token: longToken,
      token_expires_at: tokenExpiresAt.toISOString(),
      profile_picture_url: profilePictureUrl,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,instagram_user_id',
    });

    if (accountError) {
      console.error('Erro ao salvar instagram_accounts:', accountError);
    }

    // 5. Salvar configurações principais no Supabase (mantém compatibilidade)
    const { error: dbError } = await supabase.from('config').upsert({
      id: true,
      instagram_token: longToken,
      instagram_user_id: igUserId,
      instagram_username: igUsername,
      profile_picture_url: profilePictureUrl,
      token_expires_at: tokenExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
      user_id: userId,
    });

    if (dbError) {
      console.error('Erro ao salvar config no Supabase:', dbError);
      throw new Error('Erro ao gravar dados no banco de dados.');
    }

    // 6. Assinar os webhooks para o aplicativo (comments, messages)
    const subscribeResponse = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/subscribed_apps?subscribed_fields=comments,messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${longToken}`,
        },
      }
    );

    const subscribeData = await subscribeResponse.json();
    if (!subscribeResponse.ok) {
      console.error('Erro ao assinar webhooks:', subscribeData);
    }

    // Redirecionar de volta para o dashboard com sucesso
    return NextResponse.redirect(new URL('/?success=connected', req.url));
  } catch (err: any) {
    console.error('Erro geral no callback OAuth:', err);
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(err.message || 'Erro de autenticação'), req.url)
    );
  }
}
