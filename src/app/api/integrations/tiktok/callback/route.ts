import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { verificarStateOnboarding } from '@/lib/onboarding-state';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const stateRaw = searchParams.get('state');
  const onboardingState = verificarStateOnboarding(stateRaw);

  const redirectError = (msg: string) => {
    if (onboardingState.valido && onboardingState.onboardingToken) {
      return NextResponse.redirect(
        new URL(
          `/conectar/${encodeURIComponent(onboardingState.onboardingToken)}?error=${encodeURIComponent(msg)}`,
          req.url
        )
      );
    }
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(msg), req.url)
    );
  };

  if (error || !code) {
    console.error('Erro no TikTok OAuth:', error, errorDescription);
    return redirectError(errorDescription || 'Erro ao conectar conta do TikTok');
  }

  // Se não for onboarding público assinado, exige usuário logado via Supabase SSR
  if (!onboardingState.valido) {
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
            } catch {
              /* Server component */
            }
          },
        },
      }
    );

    const {
      data: { user: authUser },
    } = await supabaseAuth.auth.getUser();

    if (!authUser) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  const clientKey = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    return redirectError('Variáveis NEXT_PUBLIC_TIKTOK_CLIENT_KEY ou TIKTOK_CLIENT_SECRET não configuradas na Vercel.');
  }

  const host = req.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/integrations/tiktok/callback`;

  try {
    // 1. Troca o code pelos tokens (access_token de 24h e refresh_token de 365 dias)
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData?.error?.code !== 'ok' || !tokenData?.data?.access_token) {
      console.error('Erro ao trocar token no TikTok:', tokenData);
      const msg = tokenData?.error?.message || tokenData?.error?.code || 'Falha ao autenticar no TikTok.';
      throw new Error(msg);
    }

    const {
      access_token,
      expires_in = 86400,
      refresh_token,
      open_id,
    } = tokenData.data;

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // 2. Busca informações do perfil do usuário no TikTok
    let username: string | null = null;
    let displayName: string | null = null;
    let avatarUrl: string | null = null;

    try {
      const userRes = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
          signal: AbortSignal.timeout(10_000),
        }
      );
      const userData = await userRes.json();
      if (userData?.data?.user) {
        username = userData.data.user.username || null;
        displayName = userData.data.user.display_name || null;
        avatarUrl = userData.data.user.avatar_url || null;
      }
    } catch {
      // Falha não impeditiva na busca de avatar
    }

    // 3. Se for Onboarding Público
    if (onboardingState.valido && onboardingState.onboardingToken && onboardingState.clienteId) {
      const { error: saveError } = await supabase.from('social_accounts').upsert(
        {
          cliente_id: onboardingState.clienteId,
          platform: 'tiktok',
          account_id: open_id,
          username: username || open_id,
          display_name: displayName,
          profile_picture_url: avatarUrl,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'cliente_id,platform,account_id',
        }
      );

      if (saveError) {
        console.error('Erro ao salvar social_accounts (TikTok):', saveError);
      }

      await supabase
        .from('cliente_onboarding_links')
        .update({
          tiktok_conectado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('token', onboardingState.onboardingToken);

      return NextResponse.redirect(
        new URL(
          `/conectar/${encodeURIComponent(onboardingState.onboardingToken)}?sucesso=tiktok&username=${encodeURIComponent(username || open_id)}`,
          req.url
        )
      );
    }

    // 3.1 Se state tiver clienteId (dashboard interno)
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

    if (!clienteId) {
      const { data: primeiroCliente } = await supabase
        .from('clientes')
        .select('id')
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (primeiroCliente?.id) {
        clienteId = primeiroCliente.id;
      }
    }

    if (clienteId) {
      const { error: saveError } = await supabase.from('social_accounts').upsert(
        {
          cliente_id: clienteId,
          platform: 'tiktok',
          account_id: open_id,
          username: username || open_id,
          display_name: displayName,
          profile_picture_url: avatarUrl,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'cliente_id,platform,account_id',
        }
      );

      if (saveError) {
        console.error('Erro ao salvar social_accounts (TikTok):', saveError);
      }

      return NextResponse.redirect(
        new URL(`/?tab=clientes&cliente_id=${encodeURIComponent(clienteId)}&sucesso=tiktok_conectado&username=${encodeURIComponent(username || '')}`, req.url)
      );
    }

    return NextResponse.redirect(
      new URL(`/?sucesso=tiktok_conectado&username=${encodeURIComponent(username || '')}`, req.url)
    );
  } catch (err: any) {
    console.error('Erro no callback do TikTok:', err);
    return redirectError(err.message || 'Erro de autenticação no TikTok');
  }
}
