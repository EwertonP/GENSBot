import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { STATUS_VISIVEIS_AO_CLIENTE } from '@/lib/conteudo';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Params) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 });
  }

  // 1. Busca o cliente pelo token_aprovacao_mes
  const { data: cliente, error: erroCliente } = await serviceSupabase
    .from('clientes')
    .select(`
      id,
      nome,
      cor,
      nicho,
      foto_url,
      briefing,
      instagram_account_id,
      instagram_accounts(
        instagram_username,
        profile_picture_url
      )
    `)
    .eq('token_aprovacao_mes', token)
    .maybeSingle();

  if (erroCliente || !cliente) {
    return NextResponse.json(
      { error: 'Link de aprovação de feed não encontrado ou expirado.' },
      { status: 404 }
    );
  }

  // 2. Busca os posts do cliente que estão aptos para visualização pelo cliente
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get('mes');

  let query = serviceSupabase
    .from('conteudo_items')
    .select('*')
    .eq('cliente_id', cliente.id)
    .in('status', STATUS_VISIVEIS_AO_CLIENTE)
    .order('ordem', { ascending: true })
    .order('data_programada', { ascending: true })
    .order('criado_em', { ascending: true });

  if (mes) {
    query = query.eq('mes_referencia', mes);
  }

  const { data: posts, error: erroPosts } = await query;

  if (erroPosts) {
    return NextResponse.json({ error: 'Erro ao carregar posts do feed.' }, { status: 500 });
  }

  const clienteTratado = {
    ...cliente,
    foto_url: cliente.foto_url || (cliente as any).instagram_accounts?.profile_picture_url || null,
  };

  return NextResponse.json({
    cliente: clienteTratado,
    posts: posts || [],
    total: posts?.length || 0,
  });
}

// POST: Aprovação em massa da grade do mês
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;

  // Localiza cliente
  const { data: cliente } = await serviceSupabase
    .from('clientes')
    .select('id')
    .eq('token_aprovacao_mes', token)
    .maybeSingle();

  if (!cliente) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mes = body.mes;

    let query = serviceSupabase
      .from('conteudo_items')
      .update({ status: 'agendamento' })
      .eq('cliente_id', cliente.id)
      .eq('status', 'revisao_cliente');

    if (mes) {
      query = query.eq('mes_referencia', mes);
    }

    const { data, error } = await query.select('id');
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      aprovados: data?.length || 0,
      mensagem: 'Grade do mês aprovada com sucesso!',
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao aprovar grade.' }, { status: 500 });
  }
}
