import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

export interface LocationResult {
  id: string;
  name: string;
  subtitle: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: string;
  lon?: string;
  is_custom?: boolean;
}

const DEFAULT_POPULAR_PLACES: LocationResult[] = [
  { id: 'custom-sp', name: 'São Paulo, Brasil', subtitle: 'São Paulo, SP', state: 'SP', country: 'Brasil' },
  { id: 'custom-rj', name: 'Rio de Janeiro, Brasil', subtitle: 'Rio de Janeiro, RJ', state: 'RJ', country: 'Brasil' },
  { id: 'custom-rec', name: 'Recife, Brasil', subtitle: 'Pernambuco, PE', state: 'PE', country: 'Brasil' },
  { id: 'custom-bsb', name: 'Brasília, Brasil', subtitle: 'Distrito Federal, DF', state: 'DF', country: 'Brasil' },
  { id: 'custom-ssa', name: 'Salvador, Brasil', subtitle: 'Bahia, BA', state: 'BA', country: 'Brasil' },
  { id: 'custom-bh', name: 'Belo Horizonte, Brasil', subtitle: 'Minas Gerais, MG', state: 'MG', country: 'Brasil' },
];

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();

    if (!query) {
      return NextResponse.json({ locations: DEFAULT_POPULAR_PLACES });
    }

    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(
        query
      )}`;

      const res = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'GENSBot-Instagram-Publisher/1.0 (contato@gens.com.br)',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const results: LocationResult[] = data.map((item: any) => {
            const addr = item.address || {};
            const mainName =
              addr.amenity ||
              addr.shop ||
              addr.tourism ||
              addr.building ||
              addr.suburb ||
              addr.city ||
              addr.town ||
              addr.village ||
              item.name ||
              query;

            const parts: string[] = [];
            if (addr.city && addr.city !== mainName) parts.push(addr.city);
            else if (addr.town && addr.town !== mainName) parts.push(addr.town);
            if (addr.state) parts.push(addr.state);
            if (addr.country) parts.push(addr.country);

            const subtitle = parts.join(', ') || item.display_name.split(',').slice(1, 3).join(',').trim();

            return {
              id: String(item.place_id),
              name: mainName,
              subtitle: subtitle || mainName,
              city: addr.city || addr.town,
              state: addr.state,
              country: addr.country,
              lat: item.lat,
              lon: item.lon,
            };
          });

          // Adiciona opção direta com o termo exato digitado caso o usuário queira
          results.unshift({
            id: `custom-${Date.now()}`,
            name: query,
            subtitle: 'Local personalizado',
            is_custom: true,
          });

          return NextResponse.json({ locations: results });
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar serviço de geolocalização:', err);
    }

    // Fallback: se a API externa não responder ou não encontrar
    return NextResponse.json({
      locations: [
        {
          id: `custom-${Date.now()}`,
          name: query,
          subtitle: 'Local personalizado',
          is_custom: true,
        },
        ...DEFAULT_POPULAR_PLACES.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase())
        ),
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
