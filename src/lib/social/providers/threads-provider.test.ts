import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreadsProvider } from './threads-provider';

describe('ThreadsProvider', () => {
  let provider: ThreadsProvider;

  beforeEach(() => {
    provider = new ThreadsProvider();
    vi.restoreAllMocks();
  });

  it('publica post de texto com sucesso e trunca aviso se exceder 500 chars', async () => {
    const fetchMock = vi.fn()
      // 1. Criação do container de texto
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'container_txt_123' }),
      })
      // 2. Status do container
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'FINISHED' }),
      })
      // 3. threads_publish
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'thread_post_999' }),
      })
      // 4. Permalink
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permalink: 'https://www.threads.net/@usuario/post/abc' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const longText = 'A'.repeat(520);
    const res = await provider.publish(
      { platform: 'threads', accountId: 'threads_user_1', accessToken: 'token_valido' },
      { mediaType: 'TEXT', caption: longText }
    );

    expect(res.status).toBe('published');
    expect(res.externalId).toBe('thread_post_999');
    expect(res.permalink).toBe('https://www.threads.net/@usuario/post/abc');
    expect(res.warnings).toBeDefined();
    expect(res.warnings?.[0]).toContain('excedeu 500 caracteres');
  });

  it('cria carrossel de 2 itens e publica container pai com sucesso', async () => {
    const fetchMock = vi.fn()
      // 1. Container filho 1 (imagem)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'child_1' }),
      })
      // 2. Container filho 2 (vídeo)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'child_2' }),
      })
      // 3. Container pai (CAROUSEL)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'parent_carousel' }),
      })
      // 4. Status do container pai
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'FINISHED' }),
      })
      // 5. threads_publish
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'thread_carousel_final' }),
      })
      // 6. Permalink
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permalink: 'https://www.threads.net/@usuario/post/carrossel' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const res = await provider.publish(
      { platform: 'threads', accountId: 'threads_user_1', accessToken: 'token_valido' },
      {
        mediaType: 'CAROUSEL',
        mediaUrls: ['https://r2.dev/foto1.jpg', 'https://r2.dev/video.mp4'],
        caption: 'Legenda do carrossel',
      }
    );

    expect(res.status).toBe('published');
    expect(res.externalId).toBe('thread_carousel_final');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('retorna status failed se container falhar no processamento de vídeo', async () => {
    const fetchMock = vi.fn()
      // 1. Cria container de vídeo
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'video_container' }),
      })
      // 2. Status do container com ERROR
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ERROR', error_message: 'Codec não suportado' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const res = await provider.publish(
      { platform: 'threads', accountId: 'threads_user_1', accessToken: 'token_valido' },
      { mediaType: 'VIDEO', mediaUrl: 'https://r2.dev/video.mp4' }
    );

    expect(res.status).toBe('failed');
    expect(res.error).toContain('Codec não suportado');
  });
});
