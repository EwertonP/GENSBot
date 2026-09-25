import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  clientePodeAgir,
  clientePodeVer,
  motivoBloqueioCliente,
  type ComentarioRevisao,
  type StatusConteudo,
} from '@/lib/conteudo';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from('conteudo_items')
    .select(`
      id,
      tipo,
      status,
      titulo,
      legenda,
      briefing,
      mes_referencia,
      data_programada,
      arquivos,
      token_aprovacao,
      comentarios_revisao,
      cliente:clientes(
        id,
        nome,
        cor,
        nicho,
        foto_url,
        instagram_account_id
      )
    `)
    .eq('token_aprovacao', token)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: 'Publicação não encontrada ou link expirado.' }, { status: 404 });
  }

  const clienteItem = (item as any)?.cliente;
  if (clienteItem && !clienteItem.foto_url && clienteItem.instagram_account_id) {
    const { data: conta } = await supabase
      .from('instagram_accounts')
      .select('profile_picture_url, instagram_username')
      .eq('id', clienteItem.instagram_account_id)
      .maybeSingle();
    if (conta?.profile_picture_url) {
      clienteItem.foto_url = conta.profile_picture_url;
      clienteItem.instagram_username = conta.instagram_username;
    }
  }

  // O token nasce com o item e nunca muda, então o link existe muito antes de a
  // peça estar pronta. Sem esta checagem, quem tem o link acompanha a produção
  // inteira: arte pela metade, copy em rascunho, cada revisão interna.
  if (!clientePodeVer(item.status as StatusConteudo)) {
    return NextResponse.json(
      { error: motivoBloqueioCliente(item.status as StatusConteudo) },
      { status: 404 }
    );
  }

  return NextResponse.json({ item });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { acao, texto, slide_index, timestamp_seconds, autor } = body;

    // 1. Busca o item atual
    const { data: item, error: fetchErr } = await supabase
      .from('conteudo_items')
      .select('id, status, comentarios_revisao, historico_atividades')
      .eq('token_aprovacao', token)
      .single();

    if (fetchErr || !item) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    // Só aceita ação de quem está de fato na vez do cliente. Protege dois casos:
    // um item ainda em produção saltar direto para agendamento, e o duplo clique
    // em "aprovar" reprocessar uma aprovação que já aconteceu.
    if (!clientePodeAgir(item.status as StatusConteudo)) {
      return NextResponse.json(
        { error: motivoBloqueioCliente(item.status as StatusConteudo) },
        { status: 409 }
      );
    }

    const comentarios: ComentarioRevisao[] = Array.isArray(item.comentarios_revisao)
      ? item.comentarios_revisao
      : [];
    const historico = Array.isArray(item.historico_atividades)
      ? [...item.historico_atividades]
      : [];

    let novoStatus = item.status;
    const nomeAutor = autor || 'Cliente';

    if (acao === 'aprovar') {
      novoStatus = 'agendamento';
      comentarios.push({
        id: crypto.randomUUID(),
        autor: nomeAutor,
        tipo: 'cliente',
        texto: '✅ Conteúdo aprovado pelo cliente!',
        criado_em: new Date().toISOString(),
        resolvido: true,
      });
      historico.push({
        id: crypto.randomUUID(),
        tipo: 'status',
        autor_nome: nomeAutor,
        de_status: item.status,
        para_status: novoStatus,
        texto: 'Publicação aprovada pelo cliente. Movida para Agendamento.',
        criado_em: new Date().toISOString(),
      });
    } else if (acao === 'ajuste') {
      novoStatus = 'revisao_interna';
      if (!texto?.trim()) {
        return NextResponse.json({ error: 'Por favor, descreva o ajuste solicitado.' }, { status: 400 });
      }

      comentarios.push({
        id: crypto.randomUUID(),
        autor: nomeAutor,
        tipo: 'cliente',
        slide_index: typeof slide_index === 'number' ? slide_index : null,
        timestamp_seconds: typeof timestamp_seconds === 'number' ? timestamp_seconds : null,
        texto: texto.trim(),
        criado_em: new Date().toISOString(),
        resolvido: false,
      });
      historico.push({
        id: crypto.randomUUID(),
        tipo: 'status',
        autor_nome: nomeAutor,
        de_status: item.status,
        para_status: novoStatus,
        texto: `Ajustes solicitados pelo cliente: "${texto.trim()}"`,
        criado_em: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('conteudo_items')
      .update({
        status: novoStatus,
        comentarios_revisao: comentarios,
        historico_atividades: historico,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select('*, notion_page_id')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Se o item estiver vinculado ao Notion, escreve de volta no Notion com nomes candidatos
    if (updated.notion_page_id) {
      import('@/lib/notion').then(({ updateNotionPageStatus }) => {
        if (acao === 'aprovar') {
          updateNotionPageStatus(updated.notion_page_id, ['Aprovado', 'Agendado', 'Pronto para Publicar', 'Pronto']).catch(() => {});
        } else if (acao === 'ajuste') {
          updateNotionPageStatus(updated.notion_page_id, ['Ajuste', 'Ajustes', 'Revisão', 'Revisão Interna', 'Em Revisão']).catch(() => {});
        }
      });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch {
    return NextResponse.json({ error: 'Erro ao processar ação de aprovação' }, { status: 400 });
  }
}
