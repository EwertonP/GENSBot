/**
 * Servidor OAuth 2.1 do GENSBot para o connector MCP do Claude.
 *
 * Fluxo: Claude registra o client (DCR) → abre /oauth/authorize → a pessoa entra
 * com a conta do GENSBot e autoriza → Claude troca o code (PKCE S256) por tokens.
 * Tokens são opacos; no banco só fica o hash SHA-256.
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { supabase as serviceSupabase } from '../supabase';

export const ACCESS_TTL_S = 60 * 60; // 1h
export const REFRESH_TTL_S = 60 * 60 * 24 * 30; // 30 dias
export const CODE_TTL_S = 5 * 60; // 5min
export const ESCOPO_PADRAO = 'gensbot';

export function hashToken(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

export function gerarSegredo(prefixo: string): string {
  return `${prefixo}_${randomBytes(32).toString('base64url')}`;
}

/** Origem pública do app a partir da requisição (funciona em produção, preview e local). */
export function origemDaRequisicao(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export function metadataAuthServer(origem: string) {
  return {
    issuer: origem,
    authorization_endpoint: `${origem}/oauth/authorize`,
    token_endpoint: `${origem}/api/oauth/token`,
    registration_endpoint: `${origem}/api/oauth/register`,
    revocation_endpoint: `${origem}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [ESCOPO_PADRAO],
  };
}

export function metadataRecurso(origem: string) {
  return {
    resource: `${origem}/api/mcp`,
    authorization_servers: [origem],
    scopes_supported: [ESCOPO_PADRAO],
    bearer_methods_supported: ['header'],
    resource_name: 'GENSBot',
  };
}

/** PKCE S256: base64url(sha256(verifier)) === challenge. */
export function pkceConfere(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const calculado = createHash('sha256').update(verifier).digest('base64url');
  const a = Buffer.from(calculado);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** redirect_uri aceito no registro: https, ou http só para localhost (clientes de desenvolvimento). */
export function redirectUriValida(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

export interface ContextoMcp {
  tokenId: string;
  clientId: string;
  membroId: string;
  agenciaId: string;
  papel: 'master' | 'membro';
  nome: string;
}

/** Emite par access/refresh para um membro. Devolve os valores em claro (só nesta hora). */
export async function emitirTokens(params: { clientId: string; membroId: string; agenciaId: string; scope: string | null }) {
  const access = gerarSegredo('gat');
  const refresh = gerarSegredo('grt');
  const agora = Date.now();
  const { error } = await serviceSupabase.from('oauth_tokens').insert({
    access_hash: hashToken(access),
    refresh_hash: hashToken(refresh),
    client_id: params.clientId,
    membro_id: params.membroId,
    agencia_id: params.agenciaId,
    scope: params.scope,
    expira_em: new Date(agora + ACCESS_TTL_S * 1000).toISOString(),
    refresh_expira_em: new Date(agora + REFRESH_TTL_S * 1000).toISOString(),
  });
  if (error) throw new Error(`Falha ao emitir token: ${error.message}`);
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh,
    scope: params.scope || ESCOPO_PADRAO,
  };
}

/** Valida o Bearer do MCP. Membro precisa continuar ativo — desativar no GENSBot corta o acesso. */
export async function validarAccessToken(authorization: string | null): Promise<ContextoMcp | null> {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;

  const { data: token } = await serviceSupabase
    .from('oauth_tokens')
    .select('id, client_id, membro_id, agencia_id, expira_em, revogado_em')
    .eq('access_hash', hashToken(match[1]))
    .maybeSingle();

  if (!token || token.revogado_em || new Date(token.expira_em).getTime() < Date.now()) return null;

  const { data: membro } = await serviceSupabase
    .from('membros')
    .select('id, agencia_id, papel, ativo, nome')
    .eq('id', token.membro_id)
    .maybeSingle();

  if (!membro || !membro.ativo || membro.agencia_id !== token.agencia_id) return null;

  // Último uso é informativo; não segura a resposta.
  void serviceSupabase.from('oauth_tokens').update({ ultimo_uso_em: new Date().toISOString() }).eq('id', token.id);

  return {
    tokenId: token.id,
    clientId: token.client_id,
    membroId: membro.id,
    agenciaId: membro.agencia_id,
    papel: membro.papel === 'master' ? 'master' : 'membro',
    nome: membro.nome,
  };
}

export function erroOAuth(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: { 'Cache-Control': 'no-store' } });
}
