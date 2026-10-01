import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getAccountForUserOrAgency, listInstagramAccountsForUser, getUserIdsInSameAgency } from '@/lib/instagram-account';
import { publishPost, PublishMediaType, erroLimiteColaboradores } from '@/lib/instagram-publish';
import { supabase } from '@/lib/supabase';
import { createAutomationForPublishedPost, PublishAutomationConfig } from '@/lib/publish-automation';

// Publicação imediata espera o processamento do vídeo pela Meta (polling em
// waitForContainerReady) dentro da própria requisição — em vídeo grande isso
// pode passar dos 10s padrão da Vercel. 60s é o teto permitido no plano Hobby;
// vídeo que precise de mais que isso ainda vai estourar (limitação de plano,
// não de código — só resolve com Pro ou movendo a espera pra um worker
// assíncrono, como o /api/cron/publish-scheduled já faz pra agendados).
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    const {
      instagram_user_id,
      media_type,
      media_url,
      media_urls,
      caption,
      scheduled_at,
      collaborators,
      user_tags,
      cover_url,
      location_id,
      location_name,
      audio_name,
      conteudo_item_id,
      automation_config,
    } = body as {
      instagram_user_id: string;
      media_type: PublishMediaType;
      media_url: string;
      media_urls?: string[];
      caption?: string;
      scheduled_at?: string;
      collaborators?: string[];
      user_tags?: { username: string }[];
      cover_url?: string;
      location_id?: string;
      location_name?: string;
      audio_name?: string;
      conteudo_item_id?: string;
      automation_config?: PublishAutomationConfig;
    };

    if (!instagram_user_id || !media_type || !media_url) {
      return NextResponse.json({ error: 'Conta, tipo de mídia e arquivo são obrigatórios.' }, { status: 400 });
    }
    if (media_type === 'CAROUSEL' && (!media_urls || media_urls.length < 2)) {
      return NextResponse.json({ error: 'Carrossel precisa de ao menos 2 itens de mídia.' }, { status: 400 });
    }
    const limiteColab = erroLimiteColaboradores(collaborators);
    if (limiteColab) return NextResponse.json({ error: limiteColab }, { status: 400 });

    const account = await getAccountForUserOrAgency(user.id, instagram_user_id);
    if (!account) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    const isFuture = scheduled_at && new Date(scheduled_at).getTime() > Date.now() + 60_000;

    const commonFields = {
      user_id: user.id,
      instagram_user_id,
      media_type,
      media_url,
      media_urls: media_urls || null,
      caption: caption || null,
      collaborators: collaborators || null,
      user_tags: user_tags || null,
      cover_url: cover_url || null,
      location_id: location_id || null,
      location_name: location_name || null,
      audio_name: audio_name || null,
      automation_config: automation_config?.enabled ? automation_config : null,
    };

    if (isFuture) {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({ ...commonFields, scheduled_at, status: 'scheduled' })
        .select()
        .single();

      if (error) throw error;

      if (conteudo_item_id) {
        const { data: itemConteudo } = await supabase
          .from('conteudo_items')
          .update({
            scheduled_post_id: data.id,
            status: 'agendamento',
            data_programada: scheduled_at,
            cover_url: cover_url || null,
            location_id: location_id || null,
            location_name: location_name || null,
            audio_name: audio_name || null,
            automacao_config: automation_config?.enabled ? automation_config : null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', conteudo_item_id)
          .select('notion_page_id')
          .maybeSingle();

        if (itemConteudo?.notion_page_id) {
          import('@/lib/notion').then(({ updateNotionPageStatus }) => {
            updateNotionPageStatus(itemConteudo.notion_page_id, ['Agendado', 'Aprovado', 'Pronto para Publicar']).catch(() => {});
          });
        }
      }

      return NextResponse.json(data);
    }

    // Publicação imediata: chama a Graph API na hora e já grava como 'published'.
    try {
      const { igMediaId, avisos, localizacaoDescartada } = await publishPost({
        instagramUserId: instagram_user_id,
        accessToken: account.access_token,
        mediaType: media_type,
        mediaUrl: media_url,
        mediaUrls: media_urls,
        caption,
        collaborators,
        userTags: user_tags,
        locationId: location_id,
        coverUrl: cover_url,
        audioName: audio_name,
      });

      let createdAutomationId: string | null = null;
      if (automation_config?.enabled && igMediaId) {
        const autoResult = await createAutomationForPublishedPost(supabase, {
          userId: user.id,
          instagramUserId: instagram_user_id,
          igMediaId,
          postTitleOrCaption: caption,
          config: automation_config,
        });
        createdAutomationId = autoResult?.id || null;
      }

      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          ...commonFields,
          // Se a Meta recusou a localização, o registro não pode dizer que ela foi usada.
          ...(localizacaoDescartada ? { location_id: null, location_name: null } : {}),
          ...(avisos.length > 0 ? { aviso: avisos.join(' ') } : {}),
          scheduled_at: new Date().toISOString(),
          status: 'published',
          approval_status: 'publicado',
          ig_media_id: igMediaId,
          created_automation_id: createdAutomationId,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      if (conteudo_item_id) {
        const publishedDate = data.published_at || new Date().toISOString();

        // 1. Busca os arquivos e notion_page_id antes de atualizar
        const { data: itemConteudo } = await supabase
          .from('conteudo_items')
          .select('id, notion_page_id, arquivos')
          .eq('id', conteudo_item_id)
          .maybeSingle();

        // 2. Atualiza a demanda para publicado e esvazia arquivos para manter o banco leve
        await supabase
          .from('conteudo_items')
          .update({
            scheduled_post_id: data.id,
            status: 'publicado',
            data_programada: scheduled_at || publishedDate,
            publicado_em: publishedDate,
            cover_url: cover_url || null,
            location_id: localizacaoDescartada ? null : location_id || null,
            location_name: localizacaoDescartada ? null : location_name || null,
            audio_name: audio_name || null,
            automacao_config: automation_config?.enabled ? automation_config : null,
            arquivos: [],
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', conteudo_item_id);

        // 3. Libera o espaço das mídias no Supabase Storage (bucket post-media)
        if (itemConteudo?.arquivos) {
          import('@/lib/storage-upload').then(({ cleanupStorageMedia }) => {
            cleanupStorageMedia(supabase, itemConteudo.arquivos).catch((err) => {
              console.error('Erro na limpeza de storage pós-publicação:', err);
            });
          });
        }

        // 4. Atualiza status no Notion e arquiva a página
        if (itemConteudo?.notion_page_id) {
          import('@/lib/notion').then(({ updateNotionPageStatus, archiveNotionPage }) => {
            updateNotionPageStatus(itemConteudo.notion_page_id, ['Publicado', 'Postado', 'Concluído'])
              .then(() => archiveNotionPage(itemConteudo.notion_page_id))
              .catch(() => {});
          });
        }
      }

      return NextResponse.json(data);
    } catch (publishErr: any) {
      const { data } = await supabase
        .from('scheduled_posts')
        .insert({
          ...commonFields,
          scheduled_at: new Date().toISOString(),
          status: 'failed',
          approval_status: 'rejeitado',
          error_message: publishErr.message,
        })
        .select()
        .single();

      return NextResponse.json({ error: publishErr.message, post: data }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');
    const accounts = await listInstagramAccountsForUser(user.id);
    const agencyAccountIds = accounts.map((a) => a.instagram_user_id);

    const agencyUserIds = await getUserIdsInSameAgency(user.id);
    const userIds = agencyUserIds.length > 0 ? agencyUserIds : [user.id];

    let query = supabase
      .from('scheduled_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (accountParam && accountParam !== 'all') {
      query = query.eq('instagram_user_id', accountParam);
    } else if (agencyAccountIds.length > 0) {
      query = query.in('instagram_user_id', agencyAccountIds);
    } else {
      query = query.in('user_id', userIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
