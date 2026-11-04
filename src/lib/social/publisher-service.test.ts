import { describe, it, expect, vi } from 'vitest';
import { PublisherService } from './publisher-service';
import { ISocialProvider } from './types';

describe('PublisherService', () => {
  it('valida restrições de cada plataforma corretamente', () => {
    const service = new PublisherService();

    // 1. Text post no Instagram deve gerar erro
    const valIg = service.validatePayload(['instagram'], {
      mediaType: 'TEXT',
      caption: 'Só texto',
    });
    expect(valIg.valid).toBe(false);
    expect(valIg.errors[0]).toContain('não aceita post somente de texto');

    // 2. Carrossel com 15 itens é válido no Threads, mas inválido no Instagram
    const mediaUrls15 = Array.from({ length: 15 }, (_, i) => `https://r2.dev/${i}.jpg`);
    const valMulti = service.validatePayload(['instagram', 'threads'], {
      mediaType: 'CAROUSEL',
      mediaUrls: mediaUrls15,
    });
    expect(valMulti.valid).toBe(false);
    expect(valMulti.errors.some((e) => e.includes('Instagram'))).toBe(true);

    // 3. Threads aceita texto puro de até 500 chars
    const valThreadsOk = service.validatePayload(['threads'], {
      mediaType: 'TEXT',
      caption: 'Nota curta para o Threads',
    });
    expect(valThreadsOk.valid).toBe(true);
    expect(valThreadsOk.errors).toHaveLength(0);
  });

  it('orquestra publicação para múltiplas redes simultaneamente com isolamento de falha', async () => {
    const service = new PublisherService();

    const mockIgProvider: ISocialProvider = {
      platform: 'instagram',
      publish: vi.fn().mockResolvedValue({
        platform: 'instagram',
        status: 'published',
        externalId: 'ig_123',
        permalink: 'https://instagram.com/p/123',
      }),
    };

    const mockThreadsProvider: ISocialProvider = {
      platform: 'threads',
      publish: vi.fn().mockResolvedValue({
        platform: 'threads',
        status: 'published',
        externalId: 'th_456',
        permalink: 'https://threads.net/@user/post/456',
      }),
    };

    const mockTikTokProvider: ISocialProvider = {
      platform: 'tiktok',
      publish: vi.fn().mockResolvedValue({
        platform: 'tiktok',
        status: 'failed',
        error: 'Erro de token expirado no TikTok',
      }),
    };

    service.registerProvider(mockIgProvider);
    service.registerProvider(mockThreadsProvider);
    service.registerProvider(mockTikTokProvider);

    const targets = [
      { account: { platform: 'instagram' as const, accountId: 'ig_user', accessToken: 'ig_tok' } },
      { account: { platform: 'threads' as const, accountId: 'th_user', accessToken: 'th_tok' } },
      { account: { platform: 'tiktok' as const, accountId: 'tt_user', accessToken: 'tt_tok' } },
    ];

    const result = await service.publishToAll(targets, {
      mediaType: 'VIDEO',
      mediaUrl: 'https://r2.dev/reels.mp4',
      caption: 'Reels compartilhado',
    });

    // Instagram e Threads publicaram mesmo com erro no TikTok
    expect(result.resultados.instagram?.status).toBe('published');
    expect(result.resultados.threads?.status).toBe('published');
    expect(result.resultados.tiktok?.status).toBe('failed');
    expect(result.erros).toContain('[tiktok] Erro de token expirado no TikTok');
  });
});
