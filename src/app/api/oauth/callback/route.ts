import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cacheProfilePicture } from '@/lib/profile-picture';
import { verificarStateOnboarding } from '@/lib/onboarding-state';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Obter o usuário autenticado via Supabase SSR ou validar onboarding público
  const stateRaw = searchParams.get('state');
  const onboardingState = verificarStateOnboarding(stateRaw);

  const redirectError = (msg: string) => {
    if (onboardingState.valido && onboardingState.onboardingToken) {
      return NextResponse.redirect(
        new URL(`/conectar/${encodeURIComponent(onboardingState.onboardingToken)}?error=${encodeURIComponent(msg)}`, req.url)
      );
    }
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(msg), req.url)
    );
  };

  if (error || !code) {
    console.error('Erro no Instagram OAuth:', error, errorDescription);
    return redirectError(errorDescription || 'Erro ao fazer login no Instagram');
  }

  let userId: string;

  if (onboardingState.valido && onboardingState.onboardingToken) {
    const { data: linkOnb } = await supabase
      .from('cliente_onboarding_links')
      .select('id, agencia_id, cliente_id')
      .eq('token', onboardingState.onboardingToken)
      .maybeSingle();

    if (!linkOnb) {
      return NextResponse.redirect(
        new URL('/?error=' + encodeURIComponent('Link de onboarding inválido ou expirado.'), req.url)
      );
    }

    const { data: membroMaster } = await supabase
      .from('membros')
      .select('id')
      .eq('agencia_id', linkOnb.agencia_id)
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle();

    userId = membroMaster?.id || '00000000-0000-0000-0000-000000000000';
  } else {
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
    userId = authUser.id;
  }

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
    // O log de debug (removido) confirmou que o token curto chega perfeito
    // (formato, tamanho e permissões corretos) — descartando de vez um
    // problema no dado. Essa era a ÚNICA chamada do arquivo sem versão da
    // API (as outras já usam /v25.0/); "Unsupported request - method type:
    // get" é um erro genérico que a Meta às vezes devolve quando o endpoint
    // é resolvido sem uma versão explícita.
    const longTokenResponse = await fetch(
      `https://graph.instagram.com/v25.0/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortToken)}`
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
      `https://graph.instagram.com/v25.0/me?fields=user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(longToken)}`
    );
    const profileData = await profileResponse.json();

    if (!profileResponse.ok || !profileData.user_id) {
      console.error('Erro ao buscar perfil:', profileData);
      throw new Error('Erro ao buscar dados do perfil do Instagram.');
    }

    const igUserId = profileData.user_id;
    const igUsername = profileData.username;
    // Link da Meta expira em poucos dias — cacheia uma cópia permanente no
    // Blob antes de gravar, senão a foto some sozinha sem nenhuma ação do
    // usuário (ver cacheProfilePicture). Se o cache falhar, cai pro link cru
    // da Meta em vez de travar a conexão da conta.
    const profilePictureUrl = (await cacheProfilePicture(igUserId, profileData.profile_picture_url)) || profileData.profile_picture_url || null;

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
      return redirectError(
        `A conta @${igUsername} do Instagram já está conectada a outro usuário do GENSBot. Desconecte-a lá antes de vincular por aqui.`
      );
    }

    // 4. Salvar na tabela `instagram_accounts` (multi-tenant)
    const { data: savedAccount, error: accountError } = await supabase.from('instagram_accounts').upsert({
      user_id: userId,
      instagram_user_id: igUserId,
      instagram_username: igUsername,
      access_token: longToken,
      token_expires_at: tokenExpiresAt.toISOString(),
      profile_picture_url: profilePictureUrl,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,instagram_user_id',
    })
    .select('id')
    .single();

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

    // 6. Se o OAuth foi disparado pelo Onboarding Público do Cliente
    if (onboardingState.valido && onboardingState.onboardingToken && onboardingState.clienteId && savedAccount?.id) {
      await supabase
        .from('clientes')
        .update({ instagram_account_id: savedAccount.id })
        .eq('id', onboardingState.clienteId);

      await supabase
        .from('cliente_onboarding_links')
        .update({
          instagram_conectado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('token', onboardingState.onboardingToken);

      return NextResponse.redirect(
        new URL(
          `/conectar/${encodeURIComponent(onboardingState.onboardingToken)}?sucesso=instagram&account=${encodeURIComponent(igUsername || '')}`,
          req.url
        )
      );
    }

    // 6.1 Se o OAuth foi disparado a partir da ficha de um cliente interno
    let clienteId: string | null = null;
    if (stateRaw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(stateRaw));
        if (parsed?.clienteId) clienteId = String(parsed.clienteId);
      } catch {
        if (stateRaw.startsWith('cliente_')) {
          clienteId = stateRaw.replace('cliente_', '');
        }
      }
    }

    if (clienteId && savedAccount?.id) {
      await supabase
        .from('clientes')
        .update({ instagram_account_id: savedAccount.id })
        .eq('id', clienteId);

      return NextResponse.redirect(
        new URL(`/?tab=clientes&cliente_id=${encodeURIComponent(clienteId)}&success=connected&account=${encodeURIComponent(igUserId)}`, req.url)
      );
    }

    // Redirecionar de volta para o dashboard com sucesso, indicando qual conta
    // foi conectada para que o seletor de contas já a selecione automaticamente.
    return NextResponse.redirect(
      new URL(`/?success=connected&account=${encodeURIComponent(igUserId)}`, req.url)
    );
  } catch (err: any) {
    console.error('Erro geral no callback OAuth:', err);
    return redirectError(err.message || 'Erro de autenticação');
  }
}
