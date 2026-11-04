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
    console.error('Erro no Threads OAuth:', error, errorDescription);
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(errorDescription || 'Erro ao conectar conta do Threads'), req.url)
    );
  }

  // Verifica usuário autenticado via Supabase SSR
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

  const clientId = process.env.NEXT_PUBLIC_THREADS_CLIENT_ID || '2437920840075028';
  const clientSecret = process.env.THREADS_CLIENT_SECRET;

  if (!clientSecret) {
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent('Variável THREADS_CLIENT_SECRET não configurada na Vercel/servidor.'), req.url)
    );
  }

  const host = req.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/integrations/threads/callback`;

  try {
    // 1. Troca o code pelo token de curto prazo
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Erro ao trocar token no Threads:', tokenData);
      throw new Error(tokenData?.error_message || tokenData?.error?.message || 'Falha ao obter token do Threads.');
    }

    const shortToken = tokenData.access_token;

    // 2. Troca pelo token de longo prazo (60 dias)
    const longTokenRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortToken)}`
    );
    const longTokenData = await longTokenRes.json();

    const longToken = longTokenData?.access_token || shortToken;
    const expiresIn = longTokenData?.expires_in || 5184000; // 60 dias
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // 3. Busca o perfil do usuário no Threads
    const profileRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${encodeURIComponent(longToken)}`
    );
    const profileData = await profileRes.json();

    const threadsUserId = profileData?.id || tokenData.user_id;
    const threadsUsername = profileData?.username || null;
    const threadsName = profileData?.name || null;
    const profilePictureUrl = profileData?.threads_profile_picture_url || null;

    // 4. Se state tiver clienteId, vincula a esse cliente específico
    const stateRaw = searchParams.get('state');
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

    // Se não veio clienteId no state, busca o primeiro cliente ou cria registro sem quebrar
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
      // Salva na tabela social_accounts
      const { error: saveError } = await supabase.from('social_accounts').upsert(
        {
          cliente_id: clienteId,
          platform: 'threads',
          account_id: String(threadsUserId),
          username: threadsUsername,
          display_name: threadsName,
          profile_picture_url: profilePictureUrl,
          access_token: longToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'cliente_id,platform,account_id',
        }
      );

      if (saveError) {
        console.error('Erro ao salvar social_accounts (Threads):', saveError);
      }

      return NextResponse.redirect(
        new URL(`/?tab=clientes&cliente_id=${encodeURIComponent(clienteId)}&sucesso=threads_conectado&username=${encodeURIComponent(threadsUsername || '')}`, req.url)
      );
    }

    return NextResponse.redirect(
      new URL(`/?sucesso=threads_conectado&username=${encodeURIComponent(threadsUsername || '')}`, req.url)
    );
  } catch (err: any) {
    console.error('Erro no callback do Threads:', err);
    return NextResponse.redirect(
      new URL('/?error=' + encodeURIComponent(err.message || 'Erro de autenticação no Threads'), req.url)
    );
  }
}
