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

    // DEBUG TEMPORÁRIO: já descartamos encoding, método HTTP e endpoint
    // errados (batem com 3 fontes independentes da doc da Meta) — o erro
    // "Unsupported request - method type: get" no passo 2 persiste mesmo
    // assim. Preciso ver a forma real do token/resposta do passo 1 pra
    // não continuar chutando. Remover depois de diagnosticar.
    console.log('DEBUG token curto:', {
      keys: Object.keys(tokenData),
      tokenType: typeof shortToken,
      tokenLength: shortToken?.length,
      tokenPreview: shortToken ? `${shortToken.slice(0, 10)}...${shortToken.slice(-6)}` : null,
      userId: tokenData.user_id,
      permissions: tokenData.permissions,
    });

    // 2. Trocar pelo Token de Acesso Longo (60 dias)
    // client_secret/shortToken vão via encodeURIComponent — tokens do
    // Instagram podem conter caracteres reservados de URL (+, /, =), e sem
    // encoding a query string quebra silenciosamente: a Meta devolve um erro
    // genérico ("Unsupported request - method type: get") em vez de apontar
    // o parsing malformado, o que mascarava a causa real.
    const longTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortToken)}`
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
      `https://graph.instagram.com/me?fields=user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(longToken)}`
    );
    const profileData = await profileResponse.json();

    if (!profileResponse.ok || !profileData.user_id) {
      console.error('Erro ao buscar perfil:', profileData);
      throw new Error('Erro ao buscar dados do perfil do Instagram.');
    }

    const igUserId = profileData.user_id;
    const igUsername = profileData.username;
    const profilePictureUrl = profileData.profile_picture_url || null;

    // 3.5. Impedir que a mesma conta do Instagram seja vinculada a dois
    // usuários do SaaS diferentes ao mesmo tempo. O webhook da Meta só manda
    // o instagram_user_id (não sabe de qual usuário do GENSBot é), então uma
    // segunda vinculação torna a resolução do dono ambígua e derruba o
    // processamento de TODOS os eventos dessa conta, silenciosamente.
    const { data: existingOwner } = await supabase
      .from('instagram_accounts')
      .select('user_id')
      .eq('instagram_user_id', igUserId)
      .neq('user_id', userId)
      .maybeSingle();

    if (existingOwner) {
      return NextResponse.redirect(
        new URL(
          '/?error=' + encodeURIComponent(
            `A conta @${igUsername} do Instagram já está conectada a outro usuário do GENSBot. Desconecte-a lá antes de vincular por aqui.`
          ),
          req.url
        )
      );
    }

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
      throw new Error('Erro ao gravar dados no banco de dados.');
    }

    // 5. Assinar os webhooks para o aplicativo (comments, messages)
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

    // Redirecionar de volta para o dashboard com sucesso, indicando qual conta
    // foi conectada para que o seletor de contas já a selecione automaticamente.
    return NextResponse.redirect(
      new URL(`/?success=connected&account=${encodeURIComponent(igUserId)}`, req.url)
    );
  } catch (err: any) {
    console.error('Erro geral no callback OAuth:', err);
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(err.message || 'Erro de autenticação'), req.url)
    );
  }
}
