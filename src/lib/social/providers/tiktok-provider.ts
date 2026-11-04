import {
  ISocialProvider,
  PlatformPublishResult,
  SocialAccountCredentials,
  UnifiedPublishPayload,
} from '../types';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export interface TikTokCreatorInfo {
  creator_avatar_url?: string;
  creator_nickname?: string;
  creator_username?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
}

/**
 * Provedor de publicação na TikTok Content Posting API v2.
 * Suporta Vídeos (Reels / TikTok) e Modo Foto (Carrossel de 1 até 35 fotos).
 * Permite tanto publicação direta no feed (DIRECT_POST) quanto envio para rascunho no app do criador.
 */
export class TikTokProvider implements ISocialProvider {
  readonly platform = 'tiktok' as const;

  async publish(
    credentials: SocialAccountCredentials,
    payload: UnifiedPublishPayload
  ): Promise<PlatformPublishResult> {
    const { accessToken } = credentials;
    const warnings: string[] = [];

    const opts = payload.tiktokOptions || {};
    const directPost = opts.directPost !== false; // Padrão: true (DIRECT_POST)
    const postMode = directPost ? 'DIRECT_POST' : 'MEDIA_UPLOAD';

    const title = payload.title || payload.caption?.slice(0, 50) || 'Post GENSBot';
    const description = payload.caption || '';

    const postInfo: Record<string, any> = {
      title,
      description,
      privacy_level: opts.privacyLevel || 'PUBLIC_TO_EVERYONE',
      disable_comment: Boolean(opts.disableComment),
    };

    if (opts.disableDuet) postInfo.disable_duet = true;
    if (opts.disableStitch) postInfo.disable_stitch = true;

    try {
      let initPayload: Record<string, any>;

      if (payload.mediaType === 'CAROUSEL' && payload.mediaUrls && payload.mediaUrls.length > 0) {
        if (payload.mediaUrls.length > 35) {
          warnings.push('O TikTok aceita até 35 fotos no carrossel; itens excedentes foram desconsiderados.');
        }
        const photos = payload.mediaUrls.slice(0, 35);

        initPayload = {
          post_info: {
            ...postInfo,
            auto_add_music: opts.autoAddMusic !== false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            photo_cover_index: 0,
            photo_images: photos,
          },
          post_mode: postMode,
          media_type: 'PHOTO',
        };
      } else if ((payload.mediaType === 'VIDEO' || payload.mediaType === 'CAROUSEL') && payload.mediaUrl) {
        initPayload = {
          post_info: postInfo,
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: payload.mediaUrl,
          },
          post_mode: postMode,
          media_type: 'VIDEO',
        };
      } else {
        throw new Error('O TikTok exige mídia (vídeo ou carrossel de fotos) para publicação.');
      }

      // 1. Inicializa o envio do conteúdo
      const publishId = await this.initContentPublish(accessToken, initPayload);

      // 2. Se for modo direto, monitora o status inicial
      let status: 'published' | 'processing' = 'processing';
      if (directPost) {
        const isSuccess = await this.waitForPublishSuccess(accessToken, publishId, 25_000);
        if (isSuccess) status = 'published';
      }

      const permalink = credentials.username
        ? `https://www.tiktok.com/@${credentials.username.replace(/^@/, '')}`
        : null;

      return {
        platform: 'tiktok',
        status,
        externalId: publishId,
        permalink,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err: any) {
      return {
        platform: 'tiktok',
        status: 'failed',
        error: err?.message || 'Falha desconhecida ao publicar no TikTok.',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Consulta as opções e configurações permitidas do criador no TikTok.
   */
  async queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const res = await fetch(`${TIKTOK_API_BASE}/post/creator_info/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    if (!res.ok || data?.error?.code !== 'ok') {
      throw new Error(`Erro ao consultar dados do criador no TikTok: ${data?.error?.message || res.statusText}`);
    }

    return (data.data as TikTokCreatorInfo) || {};
  }

  private async initContentPublish(
    accessToken: string,
    body: Record<string, any>
  ): Promise<string> {
    const res = await fetch(`${TIKTOK_API_BASE}/post/publish/content/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });

    const data = await res.json();
    if (!res.ok || data?.error?.code !== 'ok' || !data?.data?.publish_id) {
      const msg = data?.error?.message || data?.error?.code || res.statusText;
      throw new Error(`Erro ao inicializar post no TikTok: ${msg}`);
    }

    return data.data.publish_id;
  }

  private async waitForPublishSuccess(
    accessToken: string,
    publishId: string,
    maxWaitMs = 25_000
  ): Promise<boolean> {
    const start = Date.now();
    const intervalMs = 3_000;

    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
        signal: AbortSignal.timeout(10_000),
      });

      const data = await res.json();
      const status = data?.data?.status;

      if (status === 'SUCCESS') {
        return true;
      }
      if (status === 'FAILED') {
        throw new Error(`Falha no processamento do TikTok: ${data?.data?.fail_reason || 'Erro no upload'}`);
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return false; // Continua em processamento assíncrono pelo TikTok
  }
}
