import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

/**
 * Lista de conversas (uma por contato, com a última mensagem) — Onda 5, item
 * "Inbox com atendimento humano". Só existe porque `messages` agora grava de
 * verdade (Onda 0, item 1 — antes o insert quebrava silenciosamente em toda
 * mensagem por mandar `user_id`, coluna que não existe na tabela).
 */
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);
    if (!config?.instagram_user_id) return NextResponse.json([]);

    const { data: messages, error } = await supabase
      .from('messages')
      .select('contact_id, text, direction, created_at')
      .eq('instagram_user_id', config.instagram_user_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Primeira ocorrência de cada contact_id na lista (já ordenada desc) = última mensagem dele.
    const lastByContact = new Map<string, { text: string | null; direction: string; created_at: string }>();
    for (const m of messages || []) {
      if (!m.contact_id || lastByContact.has(m.contact_id)) continue;
      lastByContact.set(m.contact_id, { text: m.text, direction: m.direction, created_at: m.created_at as string });
    }

    const contactIds = Array.from(lastByContact.keys());
    if (contactIds.length === 0) return NextResponse.json([]);

    const { data: contacts } = await supabase
      .from('contacts')
      .select('instagram_id, name, username, profile_picture_url')
      .in('instagram_id', contactIds);
    const contactById = new Map((contacts || []).map((c) => [c.instagram_id, c]));

    const conversations = contactIds
      .map((id) => {
        const last = lastByContact.get(id)!;
        const c = contactById.get(id);
        return {
          contact_id: id,
          name: c?.name || null,
          username: c?.username || null,
          profile_picture_url: c?.profile_picture_url || null,
          last_message: last.text,
          last_direction: last.direction,
          last_at: last.created_at,
        };
      })
      .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

    return NextResponse.json(conversations);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
