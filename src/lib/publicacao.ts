/**
 * Agendar ou publicar um post e amarrar na demanda da esteira.
 *
 * Mesma sequência de POST /api/instagram/publish, extraída pra o MCP usar sem
 * passar por sessão de navegador. (A rota atual continua com a cópia dela; migrar
 * a rota pra cá é um refactor à parte, pra não mexer no fluxo da tela junto.)
 */
import { supabase } from './supabase';
import { publishPost, ContainerPendingError, type PublishMediaType } from './instagram-publish';
import { createAutomationForPublishedPost, type PublishAutomationConfig } from './publish-automation';

export interface DadosPublicacao {
  /** Dono da conta (instagram_accounts.user_id). */
  userId: string;
  instagramUserId: string;
  accessToken: string;
  mediaType: PublishMediaType;
  mediaUrl: string;
  mediaUrls?: string[] | null;
  caption?: string | null;
  /** Se for no futuro (> 1 min), agenda; senão publica na hora. */
  scheduledAt?: string | null;
  collaborators?: string[] | null;
  coverUrl?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  audioName?: string | null;
  conteudoItemId?: string | null;
  automation?: PublishAutomationConfig | null;
}

export type ResultadoPublicacao =
  | { situacao: 'agendado'; post: Record<string, any> }
  | { situacao: 'publicado'; post: Record<string, any>; link: string | null }
  | { situacao: 'processando'; post: Record<string, any> }
  | { situacao: 'falhou'; post: Record<string, any> | null; erro: string };

async function permalink(igMediaId: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`https://graph.instagram.com/v25.0/${igMediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8_000),
    });
    const j = await r.json();
    return typeof j?.permalink === 'string' ? j.permalink : null;
  } catch {
    return null;
  }
}

export async function criarPublicacao(d: DadosPublicacao): Promise<ResultadoPublicacao> {
  const automation = d.automation?.enabled ? d.automation : null;
  const comum = {
    user_id: d.userId,
    instagram_user_id: d.instagramUserId,
    media_type: d.mediaType,
    media_url: d.mediaUrl,
    media_urls: d.mediaUrls || null,
    caption: d.caption || null,
    collaborators: d.collaborators || null,
    cover_url: d.coverUrl || null,
    location_id: d.locationId || null,
    location_name: d.locationName || null,
    audio_name: d.audioName || null,
    automation_config: automation,
  };
  const camposItem = {
    cover_url: d.coverUrl || null,
    location_id: d.locationId || null,
    location_name: d.locationName || null,
    audio_name: d.audioName || null,
    automacao_config: automation,
  };

  const futuro = d.scheduledAt && new Date(d.scheduledAt).getTime() > Date.now() + 60_000;

  if (futuro) {
    const { data, error } = await supabase.from('scheduled_posts').insert({ ...comum, scheduled_at: d.scheduledAt, status: 'scheduled' }).select().single();
    if (error) throw error;
    if (d.conteudoItemId) {
      await supabase
        .from('conteudo_items')
        .update({ scheduled_post_id: data.id, status: 'agendamento', data_programada: d.scheduledAt, ...camposItem, atualizado_em: new Date().toISOString() })
        .eq('id', d.conteudoItemId);
    }
    return { situacao: 'agendado', post: data };
  }

  try {
    const { igMediaId, avisos, localizacaoDescartada } = await publishPost({
      instagramUserId: d.instagramUserId,
      accessToken: d.accessToken,
      mediaType: d.mediaType,
      mediaUrl: d.mediaUrl,
      mediaUrls: d.mediaUrls,
      caption: d.caption || undefined,
      collaborators: d.collaborators || undefined,
      locationId: d.locationId || undefined,
      coverUrl: d.coverUrl || undefined,
      audioName: d.audioName || undefined,
      waitTimeoutMs: 35_000,
    });

    let automacaoId: string | null = null;
    if (automation && igMediaId) {
      const r = await createAutomationForPublishedPost(supabase, {
        userId: d.userId,
        instagramUserId: d.instagramUserId,
        igMediaId,
        postTitleOrCaption: d.caption,
        config: automation,
      });
      automacaoId = r?.id || null;
    }

    const agora = new Date().toISOString();
    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        ...comum,
        ...(localizacaoDescartada ? { location_id: null, location_name: null } : {}),
        ...(avisos.length > 0 ? { aviso: avisos.join(' ') } : {}),
        scheduled_at: agora,
        status: 'published',
        approval_status: 'publicado',
        ig_media_id: igMediaId,
        created_automation_id: automacaoId,
        published_at: agora,
      })
      .select()
      .single();
    if (error) throw error;

    if (d.conteudoItemId) {
      const { data: item } = await supabase.from('conteudo_items').select('id, notion_page_id, arquivos').eq('id', d.conteudoItemId).maybeSingle();
      await supabase
        .from('conteudo_items')
        .update({
          scheduled_post_id: data.id,
          status: 'publicado',
          data_programada: agora,
          publicado_em: agora,
          ...camposItem,
          ...(localizacaoDescartada ? { location_id: null, location_name: null } : {}),
          arquivos: [],
          atualizado_em: agora,
        })
        .eq('id', d.conteudoItemId);
      if (item?.arquivos) {
        import('./storage-upload').then(({ cleanupStorageMedia }) => cleanupStorageMedia(supabase, item.arquivos).catch(() => {}));
      }
      if (item?.notion_page_id) {
        import('./notion').then(({ updateNotionPageStatus, archiveNotionPage }) =>
          updateNotionPageStatus(item.notion_page_id, ['Publicado', 'Postado', 'Concluído']).then(() => archiveNotionPage(item.notion_page_id)).catch(() => {}),
        );
      }
    }

    return { situacao: 'publicado', post: data, link: igMediaId ? await permalink(igMediaId, d.accessToken) : null };
  } catch (err: any) {
    if (err instanceof ContainerPendingError || err?.name === 'ContainerPendingError') {
      // A Meta ainda processa o vídeo: entra na fila e o cron publish-scheduled termina.
      const agora = new Date().toISOString();
      const { data } = await supabase
        .from('scheduled_posts')
        .insert({ ...comum, scheduled_at: agora, status: 'scheduled', aviso: 'Vídeo em processamento na Meta; o sistema finaliza a publicação em instantes.' })
        .select()
        .single();
      if (data && d.conteudoItemId) {
        await supabase
          .from('conteudo_items')
          .update({ scheduled_post_id: data.id, status: 'agendamento', data_programada: agora, ...camposItem, atualizado_em: agora })
          .eq('id', d.conteudoItemId);
      }
      return { situacao: 'processando', post: data };
    }
    const { data } = await supabase
      .from('scheduled_posts')
      .insert({ ...comum, scheduled_at: new Date().toISOString(), status: 'failed', approval_status: 'rejeitado', error_message: err?.message })
      .select()
      .single();
    return { situacao: 'falhou', post: data, erro: err?.message || 'Falha ao publicar.' };
  }
}
