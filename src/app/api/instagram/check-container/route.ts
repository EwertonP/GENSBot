import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';
import { checkAndPublishContainer } from '@/lib/instagram-publish';
import { createAutomationForPublishedPost } from '@/lib/publish-automation';
import { garantirResponsavelDaDemanda } from '@/lib/responsavel-entrega-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const postId = body.postId || new URL(req.url).searchParams.get('post_id');

    if (!postId) {
      return NextResponse.json({ error: 'post_id é obrigatório.' }, { status: 400 });
    }

    const { data: post, error: errPost } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();

    if (errPost || !post) {
      return NextResponse.json({ error: 'Publicação não encontrada.' }, { status: 404 });
    }

    if (post.status === 'published') {
      return NextResponse.json({
        status: 'FINISHED',
        igMediaId: post.ig_media_id,
        message: 'Publicação já concluída.',
      });
    }

    if (!post.ig_container_id) {
      return NextResponse.json({
        status: 'NO_CONTAINER',
        message: 'Container ainda não inicializado para este agendamento.',
      });
    }

    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('access_token')
      .eq('instagram_user_id', post.instagram_user_id)
      .maybeSingle();

    if (!account?.access_token) {
      return NextResponse.json({ error: 'Conta sem token de acesso válido.' }, { status: 400 });
    }

    const resultado = await checkAndPublishContainer({
      instagramUserId: post.instagram_user_id,
      accessToken: account.access_token,
      creationId: post.ig_container_id,
    });

    if (resultado.status === 'FINISHED' && resultado.igMediaId) {
      let createdAutomationId: string | null = null;
      if (post.automation_config?.enabled) {
        const autoResult = await createAutomationForPublishedPost(supabase, {
          userId: post.user_id,
          instagramUserId: post.instagram_user_id,
          igMediaId: resultado.igMediaId,
          postTitleOrCaption: post.caption,
          config: post.automation_config,
        });
        createdAutomationId = autoResult?.id || null;
      }

      const publishedAt = new Date().toISOString();

      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          ig_media_id: resultado.igMediaId,
          created_automation_id: createdAutomationId,
          published_at: publishedAt,
          aviso: null,
        })
        .eq('id', post.id);

      // Atualiza demanda vinculada na esteira de conteúdo
      const { data: updatedConteudo } = await supabase
        .from('conteudo_items')
        .update({
          status: 'publicado',
          publicado_em: publishedAt,
          atualizado_em: publishedAt,
        })
        .eq('scheduled_post_id', post.id)
        .select('id, notion_page_id, arquivos');

      if (updatedConteudo && updatedConteudo.length > 0) {
        const { updateNotionPageStatus, archiveNotionPage } = await import('@/lib/notion');
        const { cleanupStorageMedia } = await import('@/lib/storage-upload');

        for (const item of updatedConteudo) {
          await garantirResponsavelDaDemanda(item.id, post.responsavel_id || post.user_id);
          if (item.arquivos) {
            await cleanupStorageMedia(supabase, item.arquivos).catch(() => {});
          }
          if (item.notion_page_id) {
            await updateNotionPageStatus(item.notion_page_id, ['Publicado', 'Postado', 'Concluído']).catch(() => {});
            await archiveNotionPage(item.notion_page_id).catch(() => {});
          }
          try {
            await supabase.from('conteudo_items').update({ arquivos: [] }).eq('id', item.id);
          } catch {
            // Ignora erro
          }
        }
      }

      return NextResponse.json({
        status: 'FINISHED',
        igMediaId: resultado.igMediaId,
        message: 'Vídeo publicado com sucesso!',
      });
    }

    if (resultado.status === 'ERROR') {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: resultado.errorMessage || 'Falha no processamento pela Meta.',
          aviso: null,
        })
        .eq('id', post.id);

      return NextResponse.json({
        status: 'ERROR',
        error: resultado.errorMessage,
      });
    }

    return NextResponse.json({
      status: 'IN_PROGRESS',
      message: 'Vídeo ainda em transcodificação nos servidores da Meta.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno.' }, { status: 500 });
  }
}
