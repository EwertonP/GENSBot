import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id');
  const status = searchParams.get('status');
  const mes = searchParams.get('mes');

  let query = supabase
    .from('conteudo_items')
    .select(`
      *,
      cliente:clientes(
        id,
        nome,
        cor,
        nicho,
        foto_url,
        instagram_account_id
      )
    `)
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: false });

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (mes) {
    query = query.eq('mes_referencia', mes);
  }

  const { data, error } = await query;
  if (error) {
    return traduzirErroBanco(error, 'GET /api/conteudo');
  }

  return NextResponse.json({ items: data || [] });
}

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user, membro } = auth.ctx;

  try {
    const body = await req.json();
    const { cliente_id, tipo, titulo, legenda, mes_referencia, data_programada, arquivos } = body;

    if (!cliente_id) {
      return respostaErro('Cliente é obrigatório', 400);
    }

    const hoje = new Date();
    const mesPadrao = mes_referencia || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('conteudo_items')
      .insert({
        agencia_id: membro.agencia_id,
        cliente_id,
        tipo: tipo || 'post',
        status: 'planejamento',
        titulo: titulo || null,
        legenda: legenda || null,
        mes_referencia: mesPadrao,
        data_programada: data_programada || null,
        arquivos: arquivos || [],
        responsavel_id: user.id,
      })
      .select(`
        *,
        cliente:clientes(
          id,
          nome,
          cor,
          nicho,
          foto_url,
          instagram_account_id
        )
      `)
      .single();

    if (error) {
      return traduzirErroBanco(error, 'POST /api/conteudo');
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch {
    return respostaErro('Corpo da requisição inválido', 400);
  }
}
