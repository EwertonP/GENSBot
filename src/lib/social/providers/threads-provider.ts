import {
  ISocialProvider,
  PlatformPublishResult,
  SocialAccountCredentials,
  UnifiedPublishPayload,
} from '../types';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

/**
 * Detecta se uma URL aponta para vídeo com base na extensão ou MIME type.
 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?.*)?$/i.test(url);
}

/**
 * Provedor de publicação na Threads API (Meta).
 * Suporta TEXT, IMAGE, VIDEO e CAROUSEL (de 2 a 20 mídias mistas).
 */
export class ThreadsProvider implements ISocialProvider {
  readonly platform = 'threads' as const;

  async publish(
    credentials: SocialAccountCredentials,
    payload: UnifiedPublishPayload
  ): Promise<PlatformPublishResult> {
    const { accountId, accessToken } = credentials;
    const warnings: string[] = [];

    // Limite de 500 caracteres da Threads API
    let caption = payload.caption || '';
    if (caption.length > 500) {
      warnings.push('O texto excedeu 500 caracteres e foi truncado para caber no limite do Threads.');
      caption = caption.slice(0, 497) + '...';
    }

    try {
      let containerId: string;

      if (payload.mediaType === 'CAROUSEL' && payload.mediaUrls && payload.mediaUrls.length > 1) {
        containerId = await this.createCarouselContainer(
          accountId,
          accessToken,
          payload.mediaUrls,
          caption
        );
      } else if (payload.mediaType === 'VIDEO' && payload.mediaUrl) {
        containerId = await this.createSingleMediaContainer(
          accountId,
          accessToken,
          'VIDEO',
          payload.mediaUrl,
          caption
        );
      } else if (payload.mediaType === 'IMAGE' && payload.mediaUrl) {
        containerId = await this.createSingleMediaContainer(
          accountId,
          accessToken,
          'IMAGE',
          payload.mediaUrl,
          caption
        );
      } else {
        // Post somente de texto (TEXT)
        containerId = await this.createTextContainer(accountId, accessToken, caption);
      }

      // Aguarda processamento do container (especialmente para vídeos)
      await this.waitForContainerReady(containerId, accessToken);

      // Publica o container
      const externalId = await this.publishContainer(accountId, accessToken, containerId);

      // Busca permalink para exibição na esteira
      const permalink = await this.fetchPermalink(externalId, accessToken);

      return {
        platform: 'threads',
        status: 'published',
        externalId,
        permalink,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err: any) {
      return {
        platform: 'threads',
        status: 'failed',
        error: err?.message || 'Falha desconhecida ao publicar no Threads.',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  private async createTextContainer(
    userId: string,
    accessToken: string,
    text: string
  ): Promise<string> {
    const params = new URLSearchParams({
      media_type: 'TEXT',
      text,
      access_token: accessToken,
    });

    const res = await fetch(`${THREADS_API_BASE}/${userId}/threads`, {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(`Erro ao criar container de texto no Threads: ${data?.error?.message || res.statusText}`);
    }
    return data.id;
  }

  private async createSingleMediaContainer(
    userId: string,
    accessToken: string,
    mediaType: 'IMAGE' | 'VIDEO',
    mediaUrl: string,
    text?: string,
    isCarouselItem = false
  ): Promise<string> {
    const params = new URLSearchParams({
      media_type: mediaType,
      access_token: accessToken,
    });

    if (mediaType === 'IMAGE') {
      params.append('image_url', mediaUrl);
    } else {
      params.append('video_url', mediaUrl);
    }

    if (text) params.append('text', text);
    if (isCarouselItem) params.append('is_carousel_item', 'true');

    const res = await fetch(`${THREADS_API_BASE}/${userId}/threads`, {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(20_000),
    });

    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(`Erro ao criar container de mídia (${mediaType}) no Threads: ${data?.error?.message || res.statusText}`);
    }
    return data.id;
  }

  private async createCarouselContainer(
    userId: string,
    accessToken: string,
    mediaUrls: string[],
    text?: string
  ): Promise<string> {
    if (mediaUrls.length < 2 || mediaUrls.length > 20) {
      throw new Error(`Carrossel no Threads deve ter entre 2 e 20 itens. Recebido: ${mediaUrls.length}`);
    }

    // 1. Cria cada item filho
    const childIds: string[] = [];
    for (const url of mediaUrls) {
      const type = isVideoUrl(url) ? 'VIDEO' : 'IMAGE';
      const childId = await this.createSingleMediaContainer(
        userId,
        accessToken,
        type,
        url,
        undefined,
        true
      );
      childIds.push(childId);
    }

    // 2. Cria container pai
    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      access_token: accessToken,
    });

    if (text) params.append('text', text);

    const res = await fetch(`${THREADS_API_BASE}/${userId}/threads`, {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(20_000),
    });

    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(`Erro ao criar container pai de carrossel no Threads: ${data?.error?.message || res.statusText}`);
    }
    return data.id;
  }

  private async waitForContainerReady(
    containerId: string,
    accessToken: string,
    maxWaitMs = 35_000
  ): Promise<void> {
    const start = Date.now();
    const intervalMs = 2_000;

    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(
        `${THREADS_API_BASE}/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      const data = await res.json();

      if (data?.status === 'FINISHED') {
        return;
      }
      if (data?.status === 'ERROR') {
        throw new Error(`Erro no processamento da mídia no Threads: ${data.error_message || 'Container retornou status ERROR'}`);
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  private async publishContainer(
    userId: string,
    accessToken: string,
    containerId: string
  ): Promise<string> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });

    const res = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish`, {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(20_000),
    });

    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(`Erro ao publicar container no Threads: ${data?.error?.message || res.statusText}`);
    }
    return data.id;
  }

  private async fetchPermalink(mediaId: string, accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${THREADS_API_BASE}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      const data = await res.json();
      return typeof data?.permalink === 'string' ? data.permalink : null;
    } catch {
      return null;
    }
  }
}
