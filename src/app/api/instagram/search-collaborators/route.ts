import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';
import { getUserIdsInSameAgency } from '@/lib/instagram-account';

export interface CollaboratorSuggestion {
  username: string;
  name: string;
  avatar_url: string | null;
  source: 'conta' | 'cliente' | 'equipe' | 'recente' | 'custom';
  badge: string;
}

function cleanHandle(text: string): string {
  return text
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();
    const cleanQuery = cleanHandle(query);

    const agencyUserIds = await getUserIdsInSameAgency(user.id);

    // 1. Contas do Instagram conectadas
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('instagram_username, profile_picture_url')
      .in('user_id', agencyUserIds.length > 0 ? agencyUserIds : [user.id]);

    // 2. Clientes da agência
    const { data: clientes } = await supabase
      .from('clientes')
      .select('nome, foto_url, instagram_username')
      .limit(30);

    // 3. Membros da equipe
    const { data: membros } = await supabase
      .from('membros')
      .select('nome, avatar_url, email')
      .limit(20);

    // 4. Colaboradores recentes em publicações agendadas
    const { data: recentPosts } = await supabase
      .from('scheduled_posts')
      .select('collaborators')
      .not('collaborators', 'is', null)
      .order('created_at', { ascending: false })
      .limit(25);

    const map = new Map<string, CollaboratorSuggestion>();

    // Adiciona contas conectadas
    if (accounts) {
      for (const acc of accounts) {
        if (acc.instagram_username) {
          const handle = cleanHandle(acc.instagram_username);
          map.set(handle, {
            username: handle,
            name: `@${acc.instagram_username}`,
            avatar_url: acc.profile_picture_url || null,
            source: 'conta',
            badge: 'Sua Conta',
          });
        }
      }
    }

    // Adiciona clientes
    if (clientes) {
      for (const c of clientes) {
        const handle = c.instagram_username
          ? cleanHandle(c.instagram_username)
          : cleanHandle(c.nome);
        if (handle && !map.has(handle)) {
          map.set(handle, {
            username: handle,
            name: c.nome,
            avatar_url: c.foto_url || null,
            source: 'cliente',
            badge: 'Cliente',
          });
        }
      }
    }

    // Adiciona membros da equipe
    if (membros) {
      for (const m of membros) {
        const handle = cleanHandle(m.nome);
        if (handle && !map.has(handle)) {
          map.set(handle, {
            username: handle,
            name: m.nome,
            avatar_url: m.avatar_url || null,
            source: 'equipe',
            badge: 'Equipe',
          });
        }
      }
    }

    // Adiciona recentes
    if (recentPosts) {
      for (const p of recentPosts) {
        if (Array.isArray(p.collaborators)) {
          for (const col of p.collaborators) {
            if (typeof col === 'string' && col.trim()) {
              const handle = cleanHandle(col);
              if (handle && !map.has(handle)) {
                map.set(handle, {
                  username: handle,
                  name: `@${handle}`,
                  avatar_url: null,
                  source: 'recente',
                  badge: 'Usado Recentemente',
                });
              }
            }
          }
        }
      }
    }

    let all = Array.from(map.values());

    if (cleanQuery) {
      const filtered = all.filter(
        (c) =>
          c.username.includes(cleanQuery) ||
          c.name.toLowerCase().includes(query.toLowerCase())
      );

      // Se a query não for idêntica a nenhum username já conhecido, adiciona como opção customizada no topo
      if (!map.has(cleanQuery) && cleanQuery.length > 0) {
        filtered.unshift({
          username: cleanQuery,
          name: query.startsWith('@') ? query : `@${cleanQuery}`,
          avatar_url: null,
          source: 'custom',
          badge: 'Adicionar Tag',
        });
      }

      return NextResponse.json({ collaborators: filtered.slice(0, 10) });
    }

    return NextResponse.json({ collaborators: all.slice(0, 10) });
  } catch (err: any) {
    console.error('Erro ao buscar sugestões de colaboradores:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
