/**
 * Publicação de conteúdo no Instagram (posts, reels, stories) via Graph API.
 * Fluxo em 2 passos exigido pela Meta: cria um container de mídia, aguarda
 * ele ficar pronto (vídeo precisa de processamento) e então publica.
 * Reaproveitado tanto pela publicação imediata (api/instagram/publish)
 * quanto pelo worker de agendamento (api/cron/publish-scheduled).
 */

const GRAPH_BASE = 'https://graph.instagram.com/v25.0';

export type PublishMediaType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';

export interface UserTag {
  username: string;
}

interface CreateContainerParams {
  instagramUserId: string;
  accessToken: string;
  mediaType: PublishMediaType;
  mediaUrl: string;
  caption?: string | null;
  collaborators?: string[] | null;
  userTags?: UserTag[] | null;
}

interface PublishParams extends CreateContainerParams {
  /** Só usado quando mediaType === 'CAROUSEL' — 2 a 10 URLs, na ordem de exibição. */
  mediaUrls?: string[] | null;
}

async function graphFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Erro na Graph API (${res.status}).`);
  }
  return data;
}

export async function createMediaContainer({
  instagramUserId,
  accessToken,
  mediaType,
  mediaUrl,
  caption,
  collaborators,
  userTags,
}: CreateContainerParams): Promise<string> {
  const params = new URLSearchParams({ access_token: accessToken });
  if (caption) params.set('caption', caption);
  // Colaboradores só fazem sentido em Post/Reels/Carrossel — em Story a
  // marcação é só user_tags (a Graph API não aceita collaborators em Story).
  if (collaborators && collaborators.length > 0 && mediaType !== 'STORIES') {
    params.set('collaborators', JSON.stringify(collaborators.slice(0, 3)));
  }
  if (userTags && userTags.length > 0) {
    params.set('user_tags', JSON.stringify(userTags));
  }

  if (mediaType === 'STORIES') {
    params.set('media_type', 'STORIES');
    if (mediaUrl.match(/\.(mp4|mov)(\?|$)/i)) {
      params.set('video_url', mediaUrl);
    } else {
      params.set('image_url', mediaUrl);
    }
  } else if (mediaType === 'REELS') {
    params.set('media_type', 'REELS');
    params.set('video_url', mediaUrl);
  } else if (mediaType === 'VIDEO') {
    params.set('media_type', 'REELS'); // feed de vídeo é publicado como REELS na API atual
    params.set('video_url', mediaUrl);
  } else {
    params.set('image_url', mediaUrl);
  }

  const data = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  return data.id as string;
}

/**
 * Carrossel: cada item vira um container filho (`is_carousel_item:true`,
 * sem caption próprio — a legenda é só do container pai), depois um
 * container pai `media_type:CAROUSEL` referenciando os filhos. Reels não
 * pode entrar em carrossel (limitação da própria Graph API), por isso
 * cada item aqui é sempre IMAGE ou VIDEO de feed.
 */
export async function createCarouselContainer({
  instagramUserId,
  accessToken,
  mediaUrls,
  caption,
  collaborators,
  userTags,
}: {
  instagramUserId: string;
  accessToken: string;
  mediaUrls: string[];
  caption?: string | null;
  collaborators?: string[] | null;
  userTags?: UserTag[] | null;
}): Promise<string> {
  if (mediaUrls.length < 2 || mediaUrls.length > 10) {
    throw new Error('Carrossel precisa de 2 a 10 itens de mídia.');
  }

  const childIds = await Promise.all(
    mediaUrls.map(async (url) => {
      const params = new URLSearchParams({ access_token: accessToken, is_carousel_item: 'true' });
      if (url.match(/\.(mp4|mov)(\?|$)/i)) {
        params.set('media_type', 'VIDEO');
        params.set('video_url', url);
      } else {
        params.set('image_url', url);
      }
      const data = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      return data.id as string;
    })
  );

  const parentParams = new URLSearchParams({
    access_token: accessToken,
    media_type: 'CAROUSEL',
    children: childIds.join(','),
  });
  if (caption) parentParams.set('caption', caption);
  if (collaborators && collaborators.length > 0) {
    parentParams.set('collaborators', JSON.stringify(collaborators.slice(0, 3)));
  }
  if (userTags && userTags.length > 0) {
    parentParams.set('user_tags', JSON.stringify(userTags));
  }

  const parentData = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: parentParams.toString(),
  });

  return parentData.id as string;
}

/**
 * Vídeo/reels/story precisam de processamento assíncrono pela Meta antes
 * de poderem ser publicados — faz polling do status_code até FINISHED
 * (ou ERROR/EXPIRED), com timeout pra não travar o worker indefinidamente.
 */
export async function waitForContainerReady(
  creationId: string,
  accessToken: string,
  { timeoutMs = 120_000, intervalMs = 3_000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const data = await graphFetch(
      `${GRAPH_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`
    );

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Processamento da mídia falhou (status: ${data.status_code}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Tempo esgotado aguardando o processamento da mídia pela Meta.');
}

export async function publishContainer(
  instagramUserId: string,
  accessToken: string,
  creationId: string
): Promise<string> {
  const params = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const data = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return data.id as string;
}

export async function publishPost(params: PublishParams): Promise<{ igMediaId: string }> {
  if (params.mediaType === 'CAROUSEL') {
    if (!params.mediaUrls || params.mediaUrls.length < 2) {
      throw new Error('Carrossel precisa de ao menos 2 itens de mídia.');
    }
    const creationId = await createCarouselContainer({
      instagramUserId: params.instagramUserId,
      accessToken: params.accessToken,
      mediaUrls: params.mediaUrls,
      caption: params.caption,
      collaborators: params.collaborators,
      userTags: params.userTags,
    });
    // O container pai do carrossel também passa por processamento antes
    // de poder ser publicado, mesmo quando todos os itens são imagem.
    await waitForContainerReady(creationId, params.accessToken);
    const igMediaId = await publishContainer(params.instagramUserId, params.accessToken, creationId);
    return { igMediaId };
  }

  const creationId = await createMediaContainer(params);

  // Imagem de feed publica quase instantaneamente; vídeo/reels/story
  // precisam de processamento — só faz polling quando não é imagem de feed.
  if (params.mediaType !== 'IMAGE') {
    await waitForContainerReady(creationId, params.accessToken);
  }

  const igMediaId = await publishContainer(params.instagramUserId, params.accessToken, creationId);
  return { igMediaId };
}
