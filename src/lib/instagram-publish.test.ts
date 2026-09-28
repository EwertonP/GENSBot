import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMediaContainer,
  createCarouselContainer,
  publishPost,
} from './instagram-publish';

describe('Instagram Publish with Location, Cover, Audio and Collaborators', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passa location_id, cover_url e audio_name ao criar container de REELS', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'reels_container_123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const containerId = await createMediaContainer({
      instagramUserId: 'ig_123',
      accessToken: 'token_abc',
      mediaType: 'REELS',
      mediaUrl: 'https://example.com/video.mp4',
      caption: 'Legenda do Reels',
      locationId: 'loc_recife_123',
      coverUrl: 'https://example.com/cover.jpg',
      audioName: 'Coldplay - Paradise',
      collaborators: ['user1', 'user2', 'user3', 'user4', 'user5'],
    });

    expect(containerId).toBe('reels_container_123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, options] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://graph.instagram.com/v25.0/ig_123/media');

    const bodyParams = new URLSearchParams(options.body);
    expect(bodyParams.get('media_type')).toBe('REELS');
    expect(bodyParams.get('video_url')).toBe('https://example.com/video.mp4');
    expect(bodyParams.get('location_id')).toBe('loc_recife_123');
    expect(bodyParams.get('cover_url')).toBe('https://example.com/cover.jpg');
    expect(bodyParams.get('audio_name')).toBe('Coldplay - Paradise');

    const sentCollabs = JSON.parse(bodyParams.get('collaborators') || '[]');
    expect(sentCollabs).toEqual(['user1', 'user2', 'user3', 'user4', 'user5']);
  });

  it('passa location_id e até 5 colaboradores no container pai do Carrossel', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, options: any) => {
      const body = new URLSearchParams(options.body);
      if (body.get('is_carousel_item') === 'true') {
        return {
          ok: true,
          json: async () => ({ id: `child_${Math.random()}` }),
        };
      }
      return {
        ok: true,
        json: async () => ({ id: 'carousel_parent_999' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const carouselId = await createCarouselContainer({
      instagramUserId: 'ig_123',
      accessToken: 'token_abc',
      mediaUrls: ['https://example.com/slide1.jpg', 'https://example.com/slide2.jpg'],
      caption: 'Carrossel com local',
      locationId: 'loc_paulista_456',
      collaborators: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
    });

    expect(carouselId).toBe('carousel_parent_999');

    // 2 itens filhos + 1 container pai = 3 chamadas
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const parentCall = fetchMock.mock.calls[2];
    const parentBody = new URLSearchParams(parentCall[1].body);
    expect(parentBody.get('media_type')).toBe('CAROUSEL');
    expect(parentBody.get('location_id')).toBe('loc_paulista_456');

    const collabs = JSON.parse(parentBody.get('collaborators') || '[]');
    expect(collabs).toHaveLength(5);
    expect(collabs).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('faz retry gracioso caso a Meta rejeite location_id', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Invalid location id parameter' } }),
        };
      }
      return {
        ok: true,
        json: async () => ({ id: 'fallback_container_ok' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const id = await createMediaContainer({
      instagramUserId: 'ig_123',
      accessToken: 'token_abc',
      mediaType: 'IMAGE',
      mediaUrl: 'https://example.com/foto.jpg',
      locationId: 'bad_location_id',
    });

    expect(id).toBe('fallback_container_ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Na 2ª chamada, location_id foi removido para não travar a postagem
    const secondCallParams = new URLSearchParams(fetchMock.mock.calls[1][1].body);
    expect(secondCallParams.get('location_id')).toBeNull();
  });
});
