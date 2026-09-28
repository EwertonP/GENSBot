import { supabase as serviceSupabase } from '@/lib/supabase';
import { emitirTokens, erroOAuth, hashToken, pkceConfere } from '@/lib/mcp/oauth';

async function lerCorpo(req: Request): Promise<Record<string, string>> {
  const tipo = req.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    const json = (await req.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v)]));
  }
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await lerCorpo(req);
  } catch {
    return erroOAuth('invalid_request', 'Corpo inválido.');
  }

  if (body.grant_type === 'authorization_code') return trocarCode(body);
  if (body.grant_type === 'refresh_token') return renovar(body);
  return erroOAuth('unsupported_grant_type', 'Use authorization_code ou refresh_token.');
}

async function trocarCode(body: Record<string, string>) {
  const { code, code_verifier, client_id, redirect_uri } = body;
  if (!code || !code_verifier || !client_id || !redirect_uri) {
    return erroOAuth('invalid_request', 'code, code_verifier, client_id e redirect_uri são obrigatórios.');
  }

  const { data: registro } = await serviceSupabase
    .from('oauth_codes')
    .select('code_hash, client_id, membro_id, redirect_uri, code_challenge, scope, expira_em, usado_em')
    .eq('code_hash', hashToken(code))
    .maybeSingle();

  if (!registro || registro.usado_em || new Date(registro.expira_em).getTime() < Date.now()) {
    return erroOAuth('invalid_grant', 'Código inválido, expirado ou já usado.');
  }
  if (registro.client_id !== client_id || registro.redirect_uri !== redirect_uri) {
    return erroOAuth('invalid_grant', 'client_id ou redirect_uri não conferem.');
  }
  if (!pkceConfere(code_verifier, registro.code_challenge)) {
    return erroOAuth('invalid_grant', 'code_verifier não confere (PKCE).');
  }

  // Marca como usado antes de emitir: um code nunca gera dois pares de token.
  const { data: marcado } = await serviceSupabase
    .from('oauth_codes')
    .update({ usado_em: new Date().toISOString() })
    .eq('code_hash', registro.code_hash)
    .is('usado_em', null)
    .select('code_hash');
  if (!marcado?.length) return erroOAuth('invalid_grant', 'Código já usado.');

  const { data: membro } = await serviceSupabase
    .from('membros')
    .select('id, agencia_id, ativo')
    .eq('id', registro.membro_id)
    .maybeSingle();
  if (!membro?.ativo) return erroOAuth('invalid_grant', 'Membro inativo.');

  const tokens = await emitirTokens({
    clientId: client_id,
    membroId: membro.id,
    agenciaId: membro.agencia_id,
    scope: registro.scope,
  });
  return Response.json(tokens, { headers: { 'Cache-Control': 'no-store' } });
}

async function renovar(body: Record<string, string>) {
  const { refresh_token, client_id } = body;
  if (!refresh_token || !client_id) return erroOAuth('invalid_request', 'refresh_token e client_id são obrigatórios.');

  const { data: atual } = await serviceSupabase
    .from('oauth_tokens')
    .select('id, client_id, membro_id, scope, refresh_expira_em, revogado_em')
    .eq('refresh_hash', hashToken(refresh_token))
    .maybeSingle();

  const expirado = !atual?.refresh_expira_em || new Date(atual.refresh_expira_em).getTime() < Date.now();
  if (!atual || atual.revogado_em || atual.client_id !== client_id || expirado) {
    return erroOAuth('invalid_grant', 'Refresh token inválido ou expirado.');
  }

  // Rotação: o par antigo morre aqui.
  const { data: revogado } = await serviceSupabase
    .from('oauth_tokens')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', atual.id)
    .is('revogado_em', null)
    .select('id');
  if (!revogado?.length) return erroOAuth('invalid_grant', 'Refresh token já usado.');

  const { data: membro } = await serviceSupabase
    .from('membros')
    .select('id, agencia_id, ativo')
    .eq('id', atual.membro_id)
    .maybeSingle();
  if (!membro?.ativo) return erroOAuth('invalid_grant', 'Membro inativo.');

  const tokens = await emitirTokens({ clientId: client_id, membroId: membro.id, agenciaId: membro.agencia_id, scope: atual.scope });
  return Response.json(tokens, { headers: { 'Cache-Control': 'no-store' } });
}
