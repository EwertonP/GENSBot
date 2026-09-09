/**
 * Publicação de conteúdo no Instagram (posts, reels, stories) via Graph API.
 * Fluxo em 2 passos exigido pela Meta: cria um container de mídia, aguarda
 * ele ficar pronto (vídeo precisa de processamento) e então publica.
 * Reaproveitado tanto pela publicação imediata (api/instagram/publish)
 * quanto pelo worker de agendamento (api/cron/publish-scheduled).
 */

const GRAPH_BASE = 'https://graph.instagram.com/v25.0';

export type PublishMediaType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES';

interface CreateContainerParams {
  instagramUserId: string;
  accessToken: string;
  mediaType: PublishMediaType;
  mediaUrl: string;
  caption?: string | null;
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
}: CreateContainerParams): Promise<string> {
  const params = new URLSearchParams({ access_token: accessToken });
  if (caption) params.set('caption', caption);

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

export async function publishPost(params: CreateContainerParams): Promise<{ igMediaId: string }> {
  const creationId = await createMediaContainer(params);

  // Imagem de feed publica quase instantaneamente; vídeo/reels/story
  // precisam de processamento — só faz polling quando não é imagem de feed.
  if (params.mediaType !== 'IMAGE') {
    await waitForContainerReady(creationId, params.accessToken);
  }

  const igMediaId = await publishContainer(params.instagramUserId, params.accessToken, creationId);
  return { igMediaId };
}
