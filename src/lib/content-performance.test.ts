import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ALLOWED_PERIODS,
  buildEmptySparkline,
  computeContentPerformance,
  type ContentTarget,
} from './content-performance';

// Mock do Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })),
  },
}));

describe('content-performance (Meta v22+/v25 & Collabs)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exporta os períodos suportados pela Meta (7, 30 e 90 dias)', () => {
    expect(ALLOWED_PERIODS).toEqual([7, 30, 90]);
  });

  it('buildEmptySparkline gera pontos sequenciais de data com valor zero', () => {
    const points7 = buildEmptySparkline(7);
    expect(points7).toHaveLength(7);
    expect(points7.every((p) => p.value === 0)).toBe(true);

    const points30 = buildEmptySparkline(30);
    expect(points30).toHaveLength(30);
  });

  it('computeContentPerformance processa mídias e expõe resumo com métricas v25 e collabs', async () => {
    const targets: ContentTarget[] = [
      { instagram_user_id: 'test_user_123', access_token: 'fake_token' },
    ];

    // Mock global fetch para simular retorno da Graph API v25
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/media?fields=')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'media_post_1',
                media_type: 'IMAGE',
                media_url: 'https://cdn.example.com/p1.jpg',
                caption: 'Post colaborativo com parceiro',
                timestamp: new Date().toISOString(),
                like_count: 50,
                comments_count: 5,
              },
              {
                id: 'media_reels_2',
                media_type: 'VIDEO',
                media_product_type: 'REELS',
                media_url: 'https://cdn.example.com/r2.mp4',
                thumbnail_url: 'https://cdn.example.com/r2_thumb.jpg',
                caption: 'Reels sobre dicas de didática',
                timestamp: new Date().toISOString(),
                like_count: 120,
                comments_count: 15,
              },
            ],
          }),
        } as Response;
      }

      if (urlStr.includes('/collaborators')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'collab_user_99',
                username: 'ph__cursos',
                invite_status: 'Accepted',
              },
            ],
          }),
        } as Response;
      }

      if (urlStr.includes('/insights')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { name: 'reach', values: [{ value: 340 }] },
              { name: 'total_interactions', values: [{ value: 45 }] },
              { name: 'views', values: [{ value: 520 }] },
              { name: 'shares', values: [{ value: 12 }] },
              { name: 'saved', values: [{ value: 8 }] },
              { name: 'ig_reels_avg_watch_time', values: [{ value: 14000 }] }, // 14s em ms
            ],
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ error: 'Not found' }),
      } as Response;
    });

    try {
      const result = await computeContentPerformance(targets, 30);
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.posts).toBe(1);
      expect(result.summary.reels).toBe(1);
      expect(result.summary.viewsTotal).toBeGreaterThan(0);
      expect(result.summary.sharesTotal).toBe(24);
      expect(result.summary.savedTotal).toBe(16);
      expect(result.summary.collabsCount).toBe(2);
      expect(result.summary.byFormat.collabs).toBeDefined();
      expect(result.summary.byFormat.collabs.count).toBe(2);

      expect(result.topPublications).toHaveLength(2);
      const firstPub = result.topPublications[0];
      expect(firstPub.views).toBe(520);
      expect(firstPub.shares).toBe(12);
      expect(firstPub.saved).toBe(8);
      expect(firstPub.is_collab).toBe(true);
      expect(firstPub.collaborators).toHaveLength(1);
      expect(firstPub.collaborators[0].username).toBe('ph__cursos');
      expect(firstPub.collaborators[0].invite_status).toBe('Accepted');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
