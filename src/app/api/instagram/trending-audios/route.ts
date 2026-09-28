import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

export interface TrendingTrack {
  id: string;
  title: string;
  artist: string;
  display_name: string; // "Artista - Título"
  artwork_url: string | null;
  preview_url: string | null; // Stream MP3 de 30 segundos
  genre?: string;
  category: 'viral' | 'aesthetic' | 'business' | 'pop';
  category_label: string;
  instagram_search_url: string;
  external_url?: string;
}

// Catálogo com curadoria de áudios que performam alto em Reels e Carrosséis no Instagram
const CURATED_TRENDING: { query: string; category: TrendingTrack['category']; label: string }[] = [
  // 1. Virais do Reels & TikTok
  { query: 'Sabrina Carpenter Espresso', category: 'viral', label: '🔥 Viral Reels' },
  { query: 'Billie Eilish BIRDS OF A FEATHER', category: 'viral', label: '🔥 Viral Reels' },
  { query: 'Dua Lipa Houdini', category: 'viral', label: '🔥 Viral Reels' },
  { query: 'Alok Hear Me Now', category: 'viral', label: '🔥 Viral Reels' },
  { query: 'Benson Boone Beautiful Things', category: 'viral', label: '🔥 Viral Reels' },
  { query: 'Vintage Culture Promised Land', category: 'viral', label: '🔥 Viral Reels' },

  // 2. Aesthetic, Lo-Fi e Vlogs (Perfeito para Carrosséis Educativos)
  { query: 'Ludovico Einaudi Experience', category: 'aesthetic', label: '☕ Aesthetic & Lofi' },
  { query: 'Leonell Cassio The Paranormal Unicorn', category: 'aesthetic', label: '☕ Aesthetic & Lofi' },
  { query: 'Cody Francis Honey Take My Hand', category: 'aesthetic', label: '☕ Aesthetic & Lofi' },
  { query: 'Praz Khanal Chill Day', category: 'aesthetic', label: '☕ Aesthetic & Lofi' },
  { query: 'Nujabes Feather', category: 'aesthetic', label: '☕ Aesthetic & Lofi' },

  // 3. Business, Autoridade & Inspiração
  { query: 'Hans Zimmer Time', category: 'business', label: '💼 Business & Inspiração' },
  { query: 'Tony Anderson Eyes Wide Open', category: 'business', label: '💼 Business & Inspiração' },
  { query: 'Max Richter On the Nature of Daylight', category: 'business', label: '💼 Business & Inspiração' },
  { query: 'Secession Studios Heart of Darkness', category: 'business', label: '💼 Business & Inspiração' },
  { query: 'Olafur Arnalds Near Light', category: 'business', label: '💼 Business & Inspiração' },

  // 4. Pop, Funk & Eletrônica Brasil
  { query: 'Coldplay Viva La Vida', category: 'pop', label: '⚡ Pop & Eletrônica' },
  { query: 'The Weeknd Blinding Lights', category: 'pop', label: '⚡ Pop & Eletrônica' },
  { query: 'Peggy Gou It Goes Like Nanana', category: 'pop', label: '⚡ Pop & Eletrônica' },
  { query: 'Daft Punk One More Time', category: 'pop', label: '⚡ Pop & Eletrônica' },
];

// Cache em memória para evitar chamadas redundantes
let memoryCache: { timestamp: number; tracks: TrendingTrack[] } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

async function fetchCuratedTracks(): Promise<TrendingTrack[]> {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.tracks;
  }

  const results: TrendingTrack[] = [];

  // Busca cada música curada para obter stream de preview e artwork reais
  await Promise.all(
    CURATED_TRENDING.map(async (item) => {
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
          item.query
        )}&country=BR&entity=song&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const t = data.results?.[0];
          if (t) {
            results.push({
              id: String(t.trackId),
              title: t.trackName,
              artist: t.artistName,
              display_name: `${t.artistName} - ${t.trackName}`,
              artwork_url: t.artworkUrl100?.replace('100x100bb', '300x300bb') || null,
              preview_url: t.previewUrl || null,
              genre: t.primaryGenreName,
              category: item.category,
              category_label: item.label,
              instagram_search_url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(
                `${t.artistName} ${t.trackName}`
              )}`,
              external_url: t.trackViewUrl,
            });
          }
        }
      } catch (err) {
        console.warn(`Erro ao carregar preview para "${item.query}":`, err);
      }
    })
  );

  memoryCache = { timestamp: Date.now(), tracks: results };
  return results;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();
    const category = searchParams.get('category') || 'all';

    // 1. Se o usuário estiver pesquisando por termo
    if (query) {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        query
      )}&country=BR&entity=song&limit=18`;

      const res = await fetch(itunesUrl);
      if (!res.ok) {
        throw new Error('Falha ao pesquisar no catálogo de áudios');
      }

      const data = await res.json();
      const tracks: TrendingTrack[] = (data.results || []).map((t: any) => ({
        id: String(t.trackId),
        title: t.trackName,
        artist: t.artistName,
        display_name: `${t.artistName} - ${t.trackName}`,
        artwork_url: t.artworkUrl100?.replace('100x100bb', '300x300bb') || null,
        preview_url: t.previewUrl || null,
        genre: t.primaryGenreName,
        category: 'viral',
        category_label: 'Resultado da Busca',
        instagram_search_url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(
          `${t.artistName} ${t.trackName}`
        )}`,
        external_url: t.trackViewUrl,
      }));

      return NextResponse.json({ tracks });
    }

    // 2. Se for navegação por categoria ou lista em alta geral
    const allCurated = await fetchCuratedTracks();
    let filtered = allCurated;

    if (category !== 'all') {
      filtered = allCurated.filter((t) => t.category === category);
    }

    return NextResponse.json({ tracks: filtered });
  } catch (err: any) {
    console.error('Erro na API de trending audios:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
