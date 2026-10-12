import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { criarEventoTesteGoogleCalendar } from '@/lib/google-calendar';

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const { cliente_id } = body;

    let nomeCliente = 'Cliente GENS';
    if (cliente_id) {
      const { data: c } = await serviceSupabase
        .from('clientes')
        .select('nome')
        .eq('id', cliente_id)
        .maybeSingle();
      if (c?.nome) nomeCliente = c.nome;
    }

    const resultado = await criarEventoTesteGoogleCalendar({
      agenciaId: membro.agencia_id,
      clienteId: cliente_id || null,
      nomeCliente,
    });

    if (!resultado.ok) {
      return respostaErro(resultado.erro || 'Falha ao criar evento de teste no Google Calendar.', 400);
    }

    return NextResponse.json({
      ok: true,
      mensagem: 'Evento de teste criado com sucesso na Google Agenda!',
      htmlLink: resultado.htmlLink,
    });
  } catch (err: unknown) {
    return respostaErro('Erro interno ao criar evento de teste.', 500);
  }
}
