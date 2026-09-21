import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

const SELECT_CONTEUDO = `
  *,
  responsavel:membros!responsavel_id(
    id,
    nome,
    email,
    papel,
    cargo
  ),
  editor:membros!editor_id(
    id,
    nome,
    email,
    papel,
    cargo
  ),
  cliente:clientes(
    id,
    nome,
    cor,
    nicho,
    foto_url,
    instagram_account_id,
    contatos:cliente_contatos(
      id,
      nome,
      cargo,
      telefone,
      email,
      e_grupo_whatsapp
    )
  )
`;

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id');
  const status = searchParams.get('status');
  const mes = searchParams.get('mes');
  const responsavelId = searchParams.get('responsavel_id');

  let query = supabase
    .from('conteudo_items')
    .select(SELECT_CONTEUDO)
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
  if (responsavelId) {
    query = query.eq('responsavel_id', responsavelId);
  }

  const { data, error } = await query;
  if (error) {
    return traduzirErroBanco(error, 'GET /api/conteudo');
  }

  const items = (data || []) as any[];
  const contasIdsParaBuscar = Array.from(
    new Set(
      items
        .map((it) => it.cliente)
        .filter((c) => c && !c.foto_url && c.instagram_account_id)
        .map((c) => c.instagram_account_id)
    )
  );

  let contasMap = new Map<string, any>();
  if (contasIdsParaBuscar.length > 0) {
    const { data: contas } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_username, profile_picture_url')
      .in('id', contasIdsParaBuscar);
    contasMap = new Map((contas || []).map((c: any) => [c.id, c]));
  }

  const itemsTratados = items.map((it) => {
    if (it.cliente && !it.cliente.foto_url && it.cliente.instagram_account_id) {
      const conta = contasMap.get(it.cliente.instagram_account_id);
      if (conta?.profile_picture_url) {
        return {
          ...it,
          cliente: {
            ...it.cliente,
            foto_url: conta.profile_picture_url,
            instagram_username: conta.instagram_username,
          },
        };
      }
    }
    return it;
  });

  return NextResponse.json({ items: itemsTratados });
}

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user, membro } = auth.ctx;

  try {
    const body = await req.json();
    const {
      cliente_id,
      tipo = 'post',
      status = 'planejamento',
      titulo,
      legenda,
      briefing,
      mes_referencia,
      data_programada,
      prazo,
      responsavel_id,
      editor_id,
      arquivos = [],
    } = body;

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
        tipo,
        status,
        titulo: titulo || null,
        legenda: legenda || null,
        briefing: briefing || null,
        mes_referencia: mesPadrao,
        data_programada: data_programada || null,
        prazo: prazo || null,
        responsavel_id: responsavel_id || user.id,
        editor_id: editor_id || null,
        arquivos,
      })
      .select(SELECT_CONTEUDO)
      .single();

    if (error) {
      return traduzirErroBanco(error, 'POST /api/conteudo');
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch {
    return respostaErro('Corpo da requisição inválido', 400);
  }
}
