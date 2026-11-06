import { notificar } from '@/lib/notificar';
import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import {
  escopoClientes,
  getContextoAgencia,
  podeAcessarCliente,
  respostaErro,
  traduzirErroBanco,
  validarAcessoItemConteudo,
} from '@/lib/clientes-server';
import { ehUuid } from '@/lib/clientes';
import { normalizarCoResponsaveis } from '@/lib/conteudo';

function extrairColunaInexistente(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error?.message) return null;
  const m1 = error.message.match(/Could not find the '([^']+)' column/i);
  if (m1) return m1[1];
  const m2 = error.message.match(/column "?([^"'\s]+)"? of relation/i);
  if (m2) return m2[1];
  const m3 = error.message.match(/column "?([^"'\s]+)"? does not exist/i);
  if (m3) return m3[1];
  return null;
}

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
  const negado = await validarAcessoItemConteudo(auth.ctx, id);
  if (negado) return negado;
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
  const negado = await validarAcessoItemConteudo(auth.ctx, id);
  if (negado) return negado;

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
      'briefing_html',
      'mes_referencia',
      'ordem',
      'data_programada',
      'prazo',
      'publicado_em',
      'responsavel_id',
      'co_responsaveis_ids',
      'etiquetas_ids',
      'editor_id',
      'arquivos',
      'cover_url',
      'comentarios_revisao',
      'historico_atividades',
      'automacao_config',
      'checklist',
      'arquivada_em',
      'tempo_estimado_minutos',
      'visivel_cliente',
      'pedido_informacao',
      'resposta_informacao',
      'concluida',
    ];

    const updates: Record<string, any> = {};
    for (const key of permitidos) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    // Normalização defensiva de campos UUID e datas para evitar erros de sintaxe no Postgres (22P02)
    if ('responsavel_id' in updates) {
      if (!updates.responsavel_id || !ehUuid(updates.responsavel_id)) {
        updates.responsavel_id = null;
      }
    }
    if ('co_responsaveis_ids' in updates) {
      updates.co_responsaveis_ids = normalizarCoResponsaveis(updates.co_responsaveis_ids, updates.responsavel_id);
    }
    if ('editor_id' in updates) {
      if (!updates.editor_id || !ehUuid(updates.editor_id)) {
        updates.editor_id = null;
      }
    }
    if ('cliente_id' in updates) {
      if (!updates.cliente_id || !ehUuid(updates.cliente_id)) {
        // Nunca envia cliente_id vazio ou nulo em update para não violar constraint NOT NULL
        delete updates.cliente_id;
      } else if (!podeAcessarCliente(await escopoClientes(auth.ctx), updates.cliente_id)) {
        return respostaErro('Você não tem acesso a esse cliente.', 403);
      }
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

    // Marcação automática de conclusão no agendamento / publicação
    if ('status' in updates && !('concluida' in body)) {
      if (
        updates.status === 'agendamento' ||
        updates.status === 'pronto_publicar' ||
        updates.status === 'publicado'
      ) {
        updates.concluida = true;
      } else if (
        updates.status === 'ideia' ||
        updates.status === 'roteiro' ||
        updates.status === 'design' ||
        updates.status === 'revisao_interna' ||
        updates.status === 'revisao_cliente'
      ) {
        updates.concluida = false;
      }
    }

    // Quem era o responsável antes, para avisar só quem acabou de receber a demanda.
    let responsavelAnterior: string | null = null;
    if ('responsavel_id' in updates) {
      const { data: ant } = await supabase.from('conteudo_items').select('responsavel_id').eq('id', id).maybeSingle();
      responsavelAnterior = ant?.responsavel_id ?? null;
    }

    let itemAtual: any = null;

    // Se houve alteração de status ou envio de novo comentário, registra no histórico (audit trail)
    if ('status' in updates || body.novo_comentario_equipe) {
      const { data: itemAtualDb } = await supabase
        .from('conteudo_items')
        .select('status, historico_atividades, notion_page_id, arquivos, scheduled_post_id, cliente_id, titulo, token_aprovacao, responsavel_id')
        .eq('id', id)
        .maybeSingle();
      itemAtual = itemAtualDb;

      if (!itemAtual) {
        const { data: fbItem } = await serviceSupabase
          .from('conteudo_items')
          .select('status, historico_atividades, notion_page_id, arquivos, scheduled_post_id, cliente_id, titulo, token_aprovacao, responsavel_id')
          .eq('id', id)
          .maybeSingle();
        if (fbItem) itemAtual = fbItem;
      }

      if (itemAtual) {
        const historico = Array.isArray(itemAtual.historico_atividades) ? [...itemAtual.historico_atividades] : [];
        // O autor do histórico é quem está logado, nunca um nome vindo do cliente
        // (antes a tela mandava o nome do responsável da demanda).
        let autorNome = auth.ctx.user.email?.split('@')[0] || 'Equipe';
        if (membro?.id) {
          const { data: eu } = await serviceSupabase.from('membros').select('nome').eq('id', membro.id).maybeSingle();
          if (eu?.nome) autorNome = eu.nome;
        }

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

    let data: any = null;
    let error: any = null;

    // Executa a atualização com proteção contra drift de schema (colunas não migradas) e foreign keys
    let tentativas = 0;
    while (tentativas < 8) {
      tentativas++;

      // 1. Tenta atualizar via client da sessão
      const resUser = await supabase
        .from('conteudo_items')
        .update(updates)
        .eq('id', id)
        .select(SELECT_CONTEUDO)
        .maybeSingle();

      data = resUser.data;
      error = resUser.error;

      // 2. Fallback via serviceSupabase caso RLS não retorne registro ou apresente erro
      if (error || !data) {
        const resService = await serviceSupabase
          .from('conteudo_items')
          .update(updates)
          .eq('id', id)
          .select(SELECT_CONTEUDO)
          .maybeSingle();

        if (resService.data) {
          data = resService.data;
          error = null;
        } else if (resService.error) {
          error = resService.error;
        }
      }

      if (!error && data) {
        break;
      }

      // 3. Trata coluna inexistente no schema cache do Postgres (migração pendente)
      const colunaInexistente = extrairColunaInexistente(error);
      if (colunaInexistente && colunaInexistente in updates) {
        console.warn(`[PATCH /api/conteudo/[id]] Coluna '${colunaInexistente}' inexistente na tabela. Removendo e tentando novamente.`);
        delete updates[colunaInexistente];
        continue;
      }

      // 4. Trata chave estrangeira em responsavel_id ou editor_id (membro removido ou id inexistente)
      if (error?.code === '23503' && updates.responsavel_id) {
        console.warn(`[PATCH /api/conteudo/[id]] FK em responsavel_id inválida (${updates.responsavel_id}). Zerando e tentando novamente.`);
        updates.responsavel_id = null;
        continue;
      }
      if (error?.code === '23503' && updates.editor_id) {
        console.warn(`[PATCH /api/conteudo/[id]] FK em editor_id inválida (${updates.editor_id}). Zerando e tentando novamente.`);
        updates.editor_id = null;
        continue;
      }

      // 5. Se o erro for na junção do SELECT_CONTEUDO, tenta update simples com select('*')
      const resSimples = await serviceSupabase
        .from('conteudo_items')
        .update(updates)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (resSimples.data) {
        data = resSimples.data;
        error = null;
        break;
      }

      break;
    }

    if (error || !data) {
      return traduzirErroBanco(error || { code: 'PGRST116', message: 'Demanda não encontrada' }, 'PATCH /api/conteudo/[id]');
    }

    // Se veio do select('*') simples, enriquece cliente e responsável se necessário
    if (data && !data.cliente && data.cliente_id) {
      const { data: cli } = await serviceSupabase
        .from('clientes')
        .select('id, nome, cor, nicho, foto_url, instagram_account_id')
        .eq('id', data.cliente_id)
        .maybeSingle();
      if (cli) data.cliente = cli;
    }
    if (data && !data.responsavel && data.responsavel_id) {
      const { data: resp } = await serviceSupabase
        .from('membros')
        .select('id, nome, email, papel, cargo')
        .eq('id', data.responsavel_id)
        .maybeSingle();
      if (resp) data.responsavel = resp;
    }

    if (updates.responsavel_id && updates.responsavel_id !== responsavelAnterior) {
      await notificar(updates.responsavel_id as string, {
        tipo: 'demanda_atribuida',
        titulo: 'Demanda atribuída a você',
        corpo: (data?.titulo as string) || 'Nova demanda',
        url: `/?tab=esteira&item=${id}`,
        exceto: membro?.id ?? null,
      });
    }

    // Disparo automático ou reenvio para Aprovação (revisao_cliente)
    let whatsappResultado: any = null;
    const entrouEmRevisaoCliente = updates.status === 'revisao_cliente' && itemAtual?.status !== 'revisao_cliente';
    const forcarReenvio = Boolean(body.reenviar_whatsapp);
    const deveNotificarWhatsApp =
      !body.pular_notificacao_whatsapp &&
      (entrouEmRevisaoCliente || (forcarReenvio && (data?.status === 'revisao_cliente' || updates.status === 'revisao_cliente')));

    if (deveNotificarWhatsApp && (data?.cliente_id || itemAtual?.cliente_id || updates.cliente_id)) {
      const agId = membro?.agencia_id || 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
      const cid = data?.cliente_id || itemAtual?.cliente_id || updates.cliente_id;
      const tit = data?.titulo || updates.titulo || itemAtual?.titulo || 'Nova Publicação';
      const tok = data?.token_aprovacao || itemAtual?.token_aprovacao;
      const respId = data?.responsavel_id || updates.responsavel_id || itemAtual?.responsavel_id || null;
      const remetenteId = membro?.id || null;

      try {
        const { notificarGrupoAprovacaoConteudo } = await import('@/lib/conteudo-whatsapp');
        whatsappResultado = await notificarGrupoAprovacaoConteudo({
          agenciaId: agId,
          clienteId: cid,
          conteudoId: id,
          tituloPost: tit,
          tokenAprovacao: tok,
          responsavelId: respId,
          remetenteId: remetenteId,
          forcarReenvio,
        });
      } catch (err: any) {
        console.warn('[Aprovação WhatsApp] Falha ao notificar grupo:', err);
        whatsappResultado = {
          ok: false,
          enviado: false,
          erro: err?.message || String(err),
        };
      }
    }

    return NextResponse.json({ item: data, whatsapp: whatsappResultado });
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
  const negado = await validarAcessoItemConteudo(auth.ctx, id);
  if (negado) return negado;
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
