import { supabase as serviceSupabase } from '@/lib/supabase';
import { erroOAuth, gerarSegredo, redirectUriValida } from '@/lib/mcp/oauth';

/** RFC 7591 — registro dinâmico de client (o Claude se registra sozinho ao adicionar o connector). */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return erroOAuth('invalid_client_metadata', 'Corpo JSON inválido.');
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(redirectUriValida)) {
    return erroOAuth('invalid_redirect_uri', 'redirect_uris precisa ter de 1 a 10 URLs https (ou http://localhost).');
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : 'Cliente MCP';
  const clientId = gerarSegredo('gcl');

  const { error } = await serviceSupabase
    .from('oauth_clients')
    .insert({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris });
  if (error) return erroOAuth('server_error', 'Não foi possível registrar o client.', 500);

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  );
}
