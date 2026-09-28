import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { CODE_TTL_S, gerarSegredo, hashToken } from '@/lib/mcp/oauth';
import { urlDeRetorno, validarPedido } from '@/lib/mcp/autorizacao';

/** Recebe o "Permitir" / "Cancelar" da tela /oauth/authorize e devolve o code ao client. */
export async function POST(req: Request) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  const validacao = await validarPedido(params);
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 });
  const { pedido } = validacao;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 });

  if (params.decisao !== 'permitir') {
    return NextResponse.redirect(urlDeRetorno(pedido.redirectUri, { error: 'access_denied', state: pedido.state }), 303);
  }

  const { data: membro } = await serviceSupabase.from('membros').select('id, ativo').eq('id', user.id).maybeSingle();
  if (!membro?.ativo) return NextResponse.json({ error: 'Seu acesso ao GENSBot ainda não foi aprovado.' }, { status: 403 });

  const code = gerarSegredo('gco');
  const { error } = await serviceSupabase.from('oauth_codes').insert({
    code_hash: hashToken(code),
    client_id: pedido.clientId,
    membro_id: membro.id,
    redirect_uri: pedido.redirectUri,
    code_challenge: pedido.codeChallenge,
    scope: pedido.scope,
    resource: pedido.resource,
    expira_em: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Não foi possível concluir a autorização.' }, { status: 500 });

  return NextResponse.redirect(urlDeRetorno(pedido.redirectUri, { code, state: pedido.state }), 303);
}
