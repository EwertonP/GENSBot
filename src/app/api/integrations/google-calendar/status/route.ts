import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { getGoogleOAuthConfig } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id') || null;

  try {
    let query = serviceSupabase
      .from('google_calendar_integrations')
      .select('id, email, calendar_id, sincronizacao_ativa, criado_em, atualizado_em')
      .eq('agencia_id', membro.agencia_id);

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.is('cliente_id', null);
    }

    const { data, error } = await query.maybeSingle();

    const { clientId, clientSecret } = getGoogleOAuthConfig();

    return NextResponse.json({
      conectado: Boolean(data?.id),
      integracao: data || null,
      configuradoNoServidor: Boolean(clientId && clientSecret),
    });
  } catch (err: unknown) {
    return respostaErro('Falha ao verificar status do Google Calendar.', 500);
  }
}

export async function DELETE(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id') || null;

  try {
    let query = serviceSupabase
      .from('google_calendar_integrations')
      .delete()
      .eq('agencia_id', membro.agencia_id);

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.is('cliente_id', null);
    }

    await query;

    return NextResponse.json({ ok: true, desconectado: true });
  } catch (err: unknown) {
    return respostaErro('Erro ao desconectar Google Calendar.', 500);
  }
}
