import { publishPost, PublishMediaType } from '@/lib/instagram-publish';
import {
  ISocialProvider,
  PlatformPublishResult,
  SocialAccountCredentials,
  UnifiedPublishPayload,
} from '../types';

/**
 * Provedor de publicação para o Instagram (Meta Graph API).
 * Reutiliza a engine existente do GENSBot (`publishPost`), padronizando seu retorno.
 */
export class InstagramProvider implements ISocialProvider {
  readonly platform = 'instagram' as const;

  async publish(
    credentials: SocialAccountCredentials,
    payload: UnifiedPublishPayload
  ): Promise<PlatformPublishResult> {
    const { accountId, accessToken } = credentials;

    // Converte SocialMediaType para PublishMediaType do Instagram
    let igMediaType: PublishMediaType;
    if (payload.mediaType === 'CAROUSEL') {
      igMediaType = 'CAROUSEL';
    } else if (payload.mediaType === 'VIDEO') {
      igMediaType = 'REELS';
    } else {
      igMediaType = 'IMAGE';
    }

    try {
      const { igMediaId, avisos } = await publishPost({
        instagramUserId: accountId,
        accessToken,
        mediaType: igMediaType,
        mediaUrl: payload.mediaUrl || '',
        mediaUrls: payload.mediaUrls || undefined,
        caption: payload.caption || undefined,
        coverUrl: payload.coverUrl || undefined,
        waitTimeoutMs: 35_000,
      });

      const permalink = await this.fetchPermalink(igMediaId, accessToken);

      return {
        platform: 'instagram',
        status: 'published',
        externalId: igMediaId,
        permalink,
        warnings: avisos && avisos.length > 0 ? avisos : undefined,
      };
    } catch (err: any) {
      return {
        platform: 'instagram',
        status: 'failed',
        error: err?.message || 'Erro ao publicar no Instagram.',
      };
    }
  }

  private async fetchPermalink(igMediaId: string, accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://graph.instagram.com/v25.0/${igMediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      const data = await res.json();
      return typeof data?.permalink === 'string' ? data.permalink : null;
    } catch {
      return null;
    }
  }
}
