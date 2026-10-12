import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { listarCalendariosUsuario, type GoogleCalendarIntegration } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id') || null;

  try {
    let query = serviceSupabase
      .from('google_calendar_integrations')
      .select('*')
      .eq('agencia_id', membro.agencia_id);

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.is('cliente_id', null);
    }

    const { data: integracao, error } = await query.maybeSingle();

    if (error) return traduzirErroBanco(error, 'GET /calendars');
    if (!integracao) {
      return NextResponse.json({ calendarios: [], selecionado: 'primary' });
    }

    const calendarios = await listarCalendariosUsuario(integracao as GoogleCalendarIntegration);

    return NextResponse.json({
      calendarios,
      selecionado: integracao.calendar_id || 'primary',
    });
  } catch (err: unknown) {
    return respostaErro('Erro ao listar calendários.', 500);
  }
}

export async function PATCH(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const { cliente_id, calendar_id } = body;

    if (!calendar_id) {
      return respostaErro('calendar_id é obrigatório.', 400);
    }

    let query = serviceSupabase
      .from('google_calendar_integrations')
      .update({
        calendar_id,
        atualizado_em: new Date().toISOString(),
      })
      .eq('agencia_id', membro.agencia_id);

    if (cliente_id) {
      query = query.eq('cliente_id', cliente_id);
    } else {
      query = query.is('cliente_id', null);
    }

    const { error } = await query;
    if (error) return traduzirErroBanco(error, 'PATCH /calendars');

    return NextResponse.json({ ok: true, calendar_id });
  } catch (err: unknown) {
    return respostaErro('Erro ao atualizar calendário.', 500);
  }
}
