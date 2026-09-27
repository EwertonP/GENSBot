import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;
  let { data, error } = await supabase
    .from('conteudo_items')
    .select(SELECT_CONTEUDO)
    .eq('id', id)
    .single();

  if ((error || !data) && membro?.agencia_id) {
    const { data: fallbackData } = await serviceSupabase
      .from('conteudo_items')
      .select(SELECT_CONTEUDO)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .single();

    if (fallbackData) {
      data = fallbackData;
      error = null;
    }
  }

  if (error || !data) {
    return respostaErro('Item de conteúdo não encontrado', 404);
  }

  if (data?.cliente?.instagram_account_id) {
    const { data: conta } = await serviceSupabase
      .from('instagram_accounts')
      .select('id, instagram_user_id, instagram_username, profile_picture_url')
      .eq('id', data.cliente.instagram_account_id)
      .maybeSingle();

    if (conta) {
      data = {
        ...data,
        cliente: {
          ...data.cliente,
          foto_url: data.cliente.foto_url || conta.profile_picture_url,
          instagram_user_id: conta.instagram_user_id,
          instagram_username: conta.instagram_username,
        },
      };
    }
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;

  try {
    const body = await req.json();

    // Whitelist de campos permitidos para atualização
    const permitidos = [
      'tipo',
      'cliente_id',
      'status',
      'prioridade',
      'titulo',
      'legenda',
      'briefing',
      'mes_referencia',
      'ordem',
      'data_programada',
      'prazo',
      'publicado_em',
      'responsavel_id',
      'editor_id',
      'arquivos',
      'comentarios_revisao',
      'historico_atividades',
      'automacao_config',
    ];

    const updates: Record<string, any> = {};
    for (const key of permitidos) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    // Normalização defensiva de campos UUID e datas para evitar erros de sintaxe no Postgres (22P02)
    if ('responsavel_id' in updates && !updates.responsavel_id) {
      updates.responsavel_id = null;
    }
    if ('editor_id' in updates && !updates.editor_id) {
      updates.editor_id = null;
    }
    if ('cliente_id' in updates && !updates.cliente_id) {
      updates.cliente_id = null;
    }
    if ('data_programada' in updates && !updates.data_programada) {
      updates.data_programada = null;
    }
    if ('prazo' in updates && !updates.prazo) {
      updates.prazo = null;
    }
    if ('publicado_em' in updates && !updates.publicado_em) {
      updates.publicado_em = null;
    }

    // Se o status for alterado para publicado e não tiver publicado_em, define a data atual
    if (updates.status === 'publicado' && !updates.publicado_em) {
      updates.publicado_em = new Date().toISOString();
    }

    // Se houve alteração de status ou envio de novo comentário, registra no histórico (audit trail)
    if ('status' in updates || body.novo_comentario_equipe) {
      let { data: itemAtual } = await supabase
        .from('conteudo_items')
        .select('status, historico_atividades, notion_page_id, arquivos, scheduled_post_id')
        .eq('id', id)
        .single();

      if (!itemAtual && membro?.agencia_id) {
        const { data: fbItem } = await serviceSupabase
          .from('conteudo_items')
          .select('status, historico_atividades, notion_page_id, arquivos, scheduled_post_id')
          .eq('id', id)
          .eq('agencia_id', membro.agencia_id)
          .single();
        if (fbItem) itemAtual = fbItem;
      }

      if (itemAtual) {
        const historico = Array.isArray(itemAtual.historico_atividades) ? [...itemAtual.historico_atividades] : [];
        const autorNome = body.autor_nome || auth.ctx.user.email?.split('@')[0] || 'Equipe';

        if ('status' in updates && updates.status !== itemAtual.status) {
          historico.push({
            id: crypto.randomUUID(),
            tipo: 'status',
            autor_nome: autorNome,
            autor_id: auth.ctx.user.id,
            de_status: itemAtual.status,
            para_status: updates.status,
            texto: `Status alterado para ${String(updates.status).toUpperCase()}`,
            criado_em: new Date().toISOString(),
          });

          // Sincroniza com Notion se a demanda for vinculada
          if (itemAtual.notion_page_id) {
            import('@/lib/notion').then(({ updateNotionPageStatus, archiveNotionPage }) => {
              if (updates.status === 'publicado') {
                updateNotionPageStatus(itemAtual.notion_page_id, ['Publicado', 'Postado', 'Concluído'])
                  .then(() => archiveNotionPage(itemAtual.notion_page_id))
                  .catch(() => {});
              } else if (updates.status === 'agendamento' || updates.status === 'pronto_publicar') {
                updateNotionPageStatus(itemAtual.notion_page_id, ['Aprovado', 'Agendado', 'Pronto para Publicar', 'Pronto']).catch(() => {});
              } else if (updates.status === 'revisao_interna' || updates.status === 'travado') {
                updateNotionPageStatus(itemAtual.notion_page_id, ['Revisão', 'Ajuste', 'Revisão Interna', 'Em Revisão']).catch(() => {});
              } else if (updates.status === 'revisao_cliente') {
                updateNotionPageStatus(itemAtual.notion_page_id, ['Revisão do Cliente', 'Aprovação', 'Aprovação Cliente']).catch(() => {});
              }
            });
          }

          // Se marcou como publicado manualmente: sincroniza scheduled_posts pendente, libera storage de mídias e esvazia arquivos
          if (updates.status === 'publicado') {
            updates.publicado_em = updates.publicado_em || new Date().toISOString();
            if (itemAtual.scheduled_post_id) {
              await serviceSupabase
                .from('scheduled_posts')
                .update({ status: 'published', published_at: updates.publicado_em })
                .eq('id', itemAtual.scheduled_post_id)
                .eq('status', 'scheduled');
            }
            if (itemAtual.arquivos && itemAtual.arquivos.length > 0) {
              import('@/lib/storage-upload').then(({ cleanupStorageMedia }) => {
                cleanupStorageMedia(supabase, itemAtual.arquivos).catch(() => {});
              });
              updates.arquivos = [];
            }
          }
        }

        if (body.novo_comentario_equipe && String(body.novo_comentario_equipe).trim()) {
          historico.push({
            id: crypto.randomUUID(),
            tipo: 'comentario',
            autor_nome: autorNome,
            autor_id: auth.ctx.user.id,
            texto: String(body.novo_comentario_equipe).trim(),
            criado_em: new Date().toISOString(),
          });
        }

        updates.historico_atividades = historico;
      }
    }

    let { data, error } = await supabase
      .from('conteudo_items')
      .update(updates)
      .eq('id', id)
      .select(SELECT_CONTEUDO)
      .single();

    if (error && membro?.agencia_id) {
      console.warn('Tentando fallback serviceSupabase em PATCH /api/conteudo/[id]:', error.message);
      const { data: fallbackData, error: fallbackError } = await serviceSupabase
        .from('conteudo_items')
        .update(updates)
        .eq('id', id)
        .eq('agencia_id', membro.agencia_id)
        .select(SELECT_CONTEUDO)
        .single();

      if (!fallbackError && fallbackData) {
        data = fallbackData;
        error = null;
      }
    }

    if (error) {
      return traduzirErroBanco(error, 'PATCH /api/conteudo/[id]');
    }

    return NextResponse.json({ item: data });
  } catch (err: any) {
    console.error('Erro inesperado em PATCH /api/conteudo/[id]:', err);
    return respostaErro('Erro ao processar atualização: ' + (err?.message || 'dados inválidos'), 400);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;
  let { error } = await supabase.from('conteudo_items').delete().eq('id', id);

  if (error && membro?.agencia_id) {
    const { error: fallbackError } = await serviceSupabase
      .from('conteudo_items')
      .delete()
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);
    if (!fallbackError) {
      error = null;
    }
  }

  if (error) {
    return traduzirErroBanco(error, 'DELETE /api/conteudo/[id]');
  }

  return NextResponse.json({ ok: true });
}
