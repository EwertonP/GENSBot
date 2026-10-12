import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { trocarCodigoPorGoogleTokens } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  const host = req.headers.get('host') || 'allingens.vercel.app';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const redirectUri = `${protocol}://${host}/api/integrations/google-calendar/callback`;

  if (error || !code) {
    console.warn('[Google Calendar OAuth] Erro ou cancelamento:', error);
    return NextResponse.redirect(`${protocol}://${host}?google_calendar=erro&motivo=${encodeURIComponent(error || 'codigo_ausente')}`);
  }

  try {
    // Decodifica o state
    let clienteId: string | null = null;
    let agenciaId: string | null = null;

    if (state) {
      try {
        const decoded = Buffer.from(state, 'base64url').toString('utf-8');
        const parsed = JSON.parse(decoded);
        clienteId = parsed.clienteId || null;
        agenciaId = parsed.agenciaId || null;
      } catch (err) {
        console.warn('Erro ao decodificar state:', err);
      }
    }

    if (!agenciaId) {
      agenciaId = 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
    }

    // Troca o code por access_token e refresh_token
    const { accessToken, refreshToken, expiresIn, email } = await trocarCodigoPorGoogleTokens({
      code,
      redirectUri,
    });

    if (!refreshToken) {
      // Se não veio refreshToken, verifica se já tínhamos um no banco
      const { data: existente } = await serviceSupabase
        .from('google_calendar_integrations')
        .select('refresh_token')
        .eq('agencia_id', agenciaId)
        .eq(clienteId ? 'cliente_id' : 'agencia_id', clienteId || agenciaId)
        .maybeSingle();

      if (!existente?.refresh_token) {
        return NextResponse.redirect(`${protocol}://${host}?google_calendar=erro&motivo=sem_refresh_token`);
      }
    }

    const expiraEm = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Salva ou atualiza no Supabase
    await serviceSupabase
      .from('google_calendar_integrations')
      .upsert(
        {
          agencia_id: agenciaId,
          cliente_id: clienteId,
          email: email || null,
          calendar_id: 'primary',
          access_token: accessToken,
          ...(refreshToken ? { refresh_token: refreshToken } : {}),
          token_expira_em: expiraEm,
          sincronizacao_ativa: true,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'agencia_id,cliente_id' }
      );

    return NextResponse.redirect(`${protocol}://${host}?google_calendar=conectado${clienteId ? `&cliente_id=${clienteId}` : ''}`);
  } catch (err: unknown) {
    console.error('[Google Calendar OAuth Callback] Falha:', err);
    return NextResponse.redirect(`${protocol}://${host}?google_calendar=erro&motivo=${encodeURIComponent(err instanceof Error ? err.message : 'falha_interna')}`);
  }
}
