import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMediaContainer,
  createCarouselContainer,
  publishPost,
  validarColaboradores,
  extrairColaboradoresInvalidos,
  erroLimiteColaboradores,
  MetaApiError,
  AVISO_LOCALIZACAO_DESCARTADA,
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
    // A Meta só aceita 3 colaboradores: o excedente é cortado.
    expect(sentCollabs).toEqual(['user1', 'user2', 'user3']);
  });

  it('passa location_id e até 3 colaboradores no container pai do Carrossel', async () => {
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
    expect(collabs).toHaveLength(3);
    expect(collabs).toEqual(['c1', 'c2', 'c3']);
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

  const erroMeta = (extra: Record<string, unknown>) => ({
    ok: false,
    status: 400,
    json: async () => ({ error: extra }),
  });

  it('traduz o erro de colaborador recusado e diz qual @ é o problema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        erroMeta({
          message: 'Invalid user id',
          code: 110,
          error_subcode: 2207018,
          error_user_msg: 'The following user(s) cannot be accessed: egnaldopinheiro',
        })
      )
    );

    const promessa = createMediaContainer({
      instagramUserId: 'ig_123',
      accessToken: 't',
      mediaType: 'IMAGE',
      mediaUrl: 'https://example.com/a.jpg',
      collaborators: ['egnaldopinheiro', 'ok1'],
    });
    await expect(promessa).rejects.toThrow(/@egnaldopinheiro/);
    await expect(promessa).rejects.toBeInstanceOf(MetaApiError);
  });

  it('não confunde colaborador recusado com localização inválida (sem retry às cegas)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      erroMeta({ message: 'Invalid user id', code: 110, error_subcode: 2207018, error_user_msg: 'cannot be accessed: x' })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createMediaContainer({
        instagramUserId: 'ig_123',
        accessToken: 't',
        mediaType: 'IMAGE',
        mediaUrl: 'https://example.com/a.jpg',
        locationId: '123',
        collaborators: ['x'],
      })
    ).rejects.toThrow(/colaborador/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('registra o aviso quando a localização é descartada no carrossel', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, options: any) => {
      const body = new URLSearchParams(options.body);
      if (body.get('is_carousel_item') === 'true') return { ok: true, json: async () => ({ id: `child_${Math.random()}` }) };
      if (body.get('location_id')) {
        return erroMeta({ message: 'Param location_id is not a valid location page ID', code: 100 });
      }
      return { ok: true, json: async () => ({ id: 'pai_ok', status_code: 'FINISHED' }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const avisos: string[] = [];
    const id = await createCarouselContainer({
      instagramUserId: 'ig_123',
      accessToken: 't',
      mediaUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      locationId: '14725438',
      avisos,
    });
    expect(id).toBe('pai_ok');
    expect(avisos).toEqual([AVISO_LOCALIZACAO_DESCARTADA]);
  });

  it('validarColaboradores devolve quais @ a Meta recusou e não bloqueia se a checagem falhar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        erroMeta({ message: 'Invalid user id', code: 110, error_subcode: 2207018, error_user_msg: 'The following user(s) cannot be accessed: a, b' })
      )
    );
    const recusado = await validarColaboradores({ instagramUserId: 'ig', accessToken: 't', collaborators: ['a', 'b', 'c'], sampleImageUrl: 'https://x/y.png' });
    expect(recusado).toMatchObject({ ok: false, invalidos: ['a', 'b'] });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(erroMeta({ message: 'Only photo or video can be accepted as media type.', code: 9004 })));
    const inconclusivo = await validarColaboradores({ instagramUserId: 'ig', accessToken: 't', collaborators: ['a'], sampleImageUrl: 'https://x/y.png' });
    expect(inconclusivo).toEqual({ ok: true, verificado: false });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'c1' }) }));
    const aceito = await validarColaboradores({ instagramUserId: 'ig', accessToken: 't', collaborators: ['a'], sampleImageUrl: 'https://x/y.png' });
    expect(aceito).toEqual({ ok: true, verificado: true });
  });

  it('helpers: extrai os @ recusados e valida o limite de 3', () => {
    expect(extrairColaboradoresInvalidos('The following user(s) cannot be accessed: egnaldopinheiro')).toEqual(['egnaldopinheiro']);
    expect(extrairColaboradoresInvalidos('cannot be accessed: a, b.')).toEqual(['a', 'b']);
    expect(extrairColaboradoresInvalidos(undefined)).toEqual([]);
    expect(erroLimiteColaboradores(['a', 'b', 'c'])).toBeNull();
    expect(erroLimiteColaboradores(['a', 'b', 'c', 'd'])).toMatch(/no máximo 3/);
    expect(erroLimiteColaboradores(undefined)).toBeNull();
  });
});
