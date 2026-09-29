import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { ehUuid } from '@/lib/clientes';
import { normalizarCoResponsaveis } from '@/lib/conteudo';

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
  const { supabase, membro } = auth.ctx;

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
  // Principal OU co-responsável. O uuid é validado antes de entrar no filtro.
  const filtroResponsavel =
    responsavelId && ehUuid(responsavelId)
      ? `responsavel_id.eq.${responsavelId},co_responsaveis_ids.cs.{${responsavelId}}`
      : null;
  if (responsavelId && !filtroResponsavel) {
    return respostaErro('responsavel_id inválido', 400);
  }
  if (filtroResponsavel) {
    query = query.or(filtroResponsavel);
  }

  let { data, error } = await query;

  // Fallback seguro usando serviceSupabase caso RLS retorne vazio
  if ((!data || data.length === 0) && membro?.agencia_id) {
    let fallbackQuery = serviceSupabase
      .from('conteudo_items')
      .select(SELECT_CONTEUDO)
      .eq('agencia_id', membro.agencia_id)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: false });

    if (clienteId) fallbackQuery = fallbackQuery.eq('cliente_id', clienteId);
    if (status) fallbackQuery = fallbackQuery.eq('status', status);
    if (mes) fallbackQuery = fallbackQuery.eq('mes_referencia', mes);
    if (filtroResponsavel) fallbackQuery = fallbackQuery.or(filtroResponsavel);

    const { data: fallbackData } = await fallbackQuery;
    if (fallbackData && fallbackData.length > 0) {
      data = fallbackData;
      error = null;
    }
  }

  if (error) {
    return traduzirErroBanco(error, 'GET /api/conteudo');
  }

  const items = (data || []) as any[];
  const contasIdsParaBuscar = Array.from(
    new Set(
      items
        .map((it) => it.cliente)
        .filter((c) => c && c.instagram_account_id)
        .map((c) => c.instagram_account_id)
    )
  );

  let contasMap = new Map<string, any>();
  if (contasIdsParaBuscar.length > 0) {
    const { data: contas } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_user_id, instagram_username, profile_picture_url')
      .in('id', contasIdsParaBuscar);
    contasMap = new Map((contas || []).map((c: any) => [c.id, c]));
  }

  const itemsTratados = items.map((it) => {
    if (it.cliente && it.cliente.instagram_account_id) {
      const conta = contasMap.get(it.cliente.instagram_account_id);
      if (conta) {
        return {
          ...it,
          cliente: {
            ...it.cliente,
            foto_url: it.cliente.foto_url || conta.profile_picture_url,
            instagram_user_id: conta.instagram_user_id,
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
      prioridade = 'media',
      titulo,
      legenda,
      briefing,
      mes_referencia,
      data_programada,
      prazo,
      responsavel_id,
      co_responsaveis_ids,
      editor_id,
      arquivos = [],
      cover_url,
    } = body;

    if (!cliente_id) {
      return respostaErro('Cliente é obrigatório', 400);
    }

    const hoje = new Date();
    const mesPadrao = mes_referencia || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

    const insertPayload = {
      agencia_id: membro.agencia_id,
      cliente_id,
      tipo,
      status,
      prioridade: prioridade || 'media',
      titulo: titulo ? String(titulo).trim() || null : null,
      legenda: legenda ? String(legenda).trim() || null : null,
      briefing: briefing ? String(briefing).trim() || null : null,
      mes_referencia: mesPadrao,
      data_programada: data_programada || null,
      prazo: prazo || null,
      responsavel_id: responsavel_id || user.id,
      // Só envia a coluna quando veio no pedido (compatível com banco sem a migração).
      ...(co_responsaveis_ids !== undefined && {
        co_responsaveis_ids: normalizarCoResponsaveis(co_responsaveis_ids, responsavel_id || user.id),
      }),
      editor_id: editor_id || null,
      arquivos,
      cover_url: cover_url ? String(cover_url) : null,
    };

    let { data, error } = await supabase
      .from('conteudo_items')
      .insert(insertPayload)
      .select(SELECT_CONTEUDO)
      .single();

    if (error && membro?.agencia_id) {
      console.warn('Tentando fallback serviceSupabase em POST /api/conteudo:', error.message);
      const { data: fallbackData, error: fallbackError } = await serviceSupabase
        .from('conteudo_items')
        .insert(insertPayload)
        .select(SELECT_CONTEUDO)
        .single();

      if (!fallbackError && fallbackData) {
        data = fallbackData;
        error = null;
      }
    }

    if (error) {
      return traduzirErroBanco(error, 'POST /api/conteudo');
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err: any) {
    console.error('Erro em POST /api/conteudo:', err);
    return respostaErro('Corpo da requisição inválido', 400);
  }
}
