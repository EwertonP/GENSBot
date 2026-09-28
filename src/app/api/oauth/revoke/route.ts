import { supabase as serviceSupabase } from '@/lib/supabase';
import { hashToken } from '@/lib/mcp/oauth';

/** RFC 7009 — responde 200 mesmo para token desconhecido. */
export async function POST(req: Request) {
  const texto = await req.text().catch(() => '');
  const token = new URLSearchParams(texto).get('token');
  if (token) {
    const hash = hashToken(token);
    const agora = new Date().toISOString();
    await serviceSupabase.from('oauth_tokens').update({ revogado_em: agora }).eq('access_hash', hash).is('revogado_em', null);
    await serviceSupabase.from('oauth_tokens').update({ revogado_em: agora }).eq('refresh_hash', hash).is('revogado_em', null);
  }
  return new Response(null, { status: 200 });
}
