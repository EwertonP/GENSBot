import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TikTokProvider } from './tiktok-provider';

describe('TikTokProvider', () => {
  let provider: TikTokProvider;

  beforeEach(() => {
    provider = new TikTokProvider();
    vi.restoreAllMocks();
  });

  it('inicializa e publica vídeo no TikTok (DIRECT_POST) com sucesso', async () => {
    const fetchMock = vi.fn()
      // 1. Init do post
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { code: 'ok', message: '' },
          data: { publish_id: 'p_pub_video_123' },
        }),
      })
      // 2. Fetch de status do post
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { status: 'SUCCESS' },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const res = await provider.publish(
      { platform: 'tiktok', accountId: 'open_id_123', accessToken: 'tt_access_token', username: 'agenciagens' },
      {
        mediaType: 'VIDEO',
        mediaUrl: 'https://r2.dev/reels.mp4',
        caption: 'Vídeo da agência #marketing',
        tiktokOptions: { directPost: true },
      }
    );

    expect(res.status).toBe('published');
    expect(res.externalId).toBe('p_pub_video_123');
    expect(res.permalink).toBe('https://www.tiktok.com/@agenciagens');
  });

  it('publica carrossel de fotos (Photo Mode) com auto_add_music ativado', async () => {
    let capturedBody: any = null;

    const fetchMock = vi.fn()
      // 1. Init do carrossel de fotos
      .mockImplementationOnce(async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            error: { code: 'ok', message: '' },
            data: { publish_id: 'p_pub_photo_mode' },
          }),
        };
      })
      // 2. Status
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { status: 'SUCCESS' },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const photos = ['https://r2.dev/foto1.jpg', 'https://r2.dev/foto2.jpg', 'https://r2.dev/foto3.jpg'];
    const res = await provider.publish(
      { platform: 'tiktok', accountId: 'open_id_123', accessToken: 'tt_access_token' },
      {
        mediaType: 'CAROUSEL',
        mediaUrls: photos,
        caption: 'Carrossel fotográfico',
        tiktokOptions: { autoAddMusic: true, directPost: true },
      }
    );

    expect(res.status).toBe('published');
    expect(capturedBody.media_type).toBe('PHOTO');
    expect(capturedBody.post_info.auto_add_music).toBe(true);
    expect(capturedBody.source_info.photo_images).toHaveLength(3);
  });

  it('rejeita publicação se a plataforma não receber mídia', async () => {
    const res = await provider.publish(
      { platform: 'tiktok', accountId: 'open_id_123', accessToken: 'tt_access_token' },
      { mediaType: 'TEXT', caption: 'Apenas texto' }
    );

    expect(res.status).toBe('failed');
    expect(res.error).toContain('exige mídia');
  });
});
