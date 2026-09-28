/**
 * Validação comum da requisição de autorização (/oauth/authorize), usada pela
 * página de consentimento e pelo POST que emite o code.
 */
import { supabase as serviceSupabase } from '../supabase';

export interface PedidoAutorizacao {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scope: string | null;
  resource: string | null;
}

export type ResultadoPedido = { ok: true; pedido: PedidoAutorizacao } | { ok: false; erro: string; podeRedirecionar: boolean };

export async function validarPedido(params: Record<string, string | undefined>): Promise<ResultadoPedido> {
  const clientId = params.client_id;
  const redirectUri = params.redirect_uri;
  if (!clientId || !redirectUri) return { ok: false, erro: 'client_id e redirect_uri são obrigatórios.', podeRedirecionar: false };

  const { data: client } = await serviceSupabase
    .from('oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();

  // Sem client válido ou com redirect não registrado, nunca redirecionamos (evita open redirect).
  if (!client) return { ok: false, erro: 'Aplicativo não registrado.', podeRedirecionar: false };
  if (!client.redirect_uris.includes(redirectUri)) return { ok: false, erro: 'Endereço de retorno não autorizado.', podeRedirecionar: false };

  if (params.response_type !== 'code') return { ok: false, erro: 'response_type precisa ser "code".', podeRedirecionar: true };
  if (!params.code_challenge || params.code_challenge_method !== 'S256') {
    return { ok: false, erro: 'PKCE (S256) é obrigatório.', podeRedirecionar: true };
  }

  return {
    ok: true,
    pedido: {
      clientId,
      clientName: client.client_name || 'Aplicativo',
      redirectUri,
      codeChallenge: params.code_challenge,
      state: params.state || null,
      scope: params.scope || null,
      resource: params.resource || null,
    },
  };
}

export function urlDeRetorno(redirectUri: string, valores: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(valores)) if (v) url.searchParams.set(k, v);
  return url.toString();
}
