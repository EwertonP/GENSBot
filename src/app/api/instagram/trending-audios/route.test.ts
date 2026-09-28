import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/auth-api', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

import { getAuthUser } from '@/lib/auth-api';

describe('API: Trending Audios (/api/instagram/trending-audios)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna 401 se usuário não estiver autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/instagram/trending-audios');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Não autorizado');
  });

  it('retorna faixas pesquisadas quando query "q" for informada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user_123' } as any);

    const itunesMock = {
      results: [
        {
          trackId: 1001,
          trackName: 'Espresso',
          artistName: 'Sabrina Carpenter',
          artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/100x100bb.jpg',
          previewUrl: 'https://audio-ssl.itunes.apple.com/preview.mp3',
          primaryGenreName: 'Pop',
          trackViewUrl: 'https://music.apple.com/track/1001',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => itunesMock,
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('http://localhost:3000/api/instagram/trending-audios?q=Espresso');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tracks).toHaveLength(1);

    const track = data.tracks[0];
    expect(track.id).toBe('1001');
    expect(track.title).toBe('Espresso');
    expect(track.artist).toBe('Sabrina Carpenter');
    expect(track.display_name).toBe('Sabrina Carpenter - Espresso');
    expect(track.artwork_url).toBe('https://is1-ssl.mzstatic.com/image/thumb/300x300bb.jpg');
    expect(track.preview_url).toBe('https://audio-ssl.itunes.apple.com/preview.mp3');
    expect(track.instagram_search_url).toContain('Sabrina%20Carpenter%20Espresso');
  });

  it('retorna faixas curadas quando nenhuma busca por termo for enviada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user_123' } as any);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            trackId: 2002,
            trackName: 'Experience',
            artistName: 'Ludovico Einaudi',
            artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/100x100bb.jpg',
            previewUrl: 'https://audio-ssl.itunes.apple.com/preview2.mp3',
            primaryGenreName: 'Classical',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('http://localhost:3000/api/instagram/trending-audios?category=aesthetic');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tracks)).toBe(true);
    // Deve retornar itens filtrados pela categoria aesthetic
    data.tracks.forEach((t: any) => {
      expect(t.category).toBe('aesthetic');
    });
  });
});
