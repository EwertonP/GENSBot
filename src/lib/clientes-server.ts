/**
 * Contexto de agência para as rotas /api/clientes/**.
 *
 * Diferente do resto do GENSBot, que usa a service role e filtra `user_id` à
 * mão em cada rota, aqui usamos o cliente Supabase COM A SESSÃO DO USUÁRIO.
 * Assim a RLS de agência (private.agencia_atual()) faz o isolamento no banco,
 * e uma rota que esqueça um filtro não vaza dado de outra agência.
 */
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { listInstagramAccountsForUser } from '@/lib/instagram-account';

import { supabase as serviceSupabase } from '@/lib/supabase';

export interface Membro {
  id: string;
  agencia_id: string;
  nome?: string;
  cargo?: string | null;
  foto_url?: string | null;
  papel: 'master' | 'membro' | 'cliente';
  ativo: boolean;
  cliente_id?: string | null;
}

export interface ContextoAgencia {
  supabase: SupabaseClient;
  user: User;
  membro: Membro;
}

export function respostaErro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

/**
 * Resolve quem está chamando e a que agência pertence.
 * - 401: sem sessão.
 * - 403: logado, mas ainda sem acesso aprovado à agência.
 */
export async function getContextoAgencia(): Promise<
  { ok: true; ctx: ContextoAgencia } | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: respostaErro('Não autorizado. Faça login para continuar.', 401) };
  }

  // 1. Busca membro usando serviceSupabase para ignorar RLS circular e garantir leitura confiável
  let { data: membro, error } = await serviceSupabase
    .from('membros')
    .select('id, agencia_id, papel, ativo, cliente_id, nome, cargo, foto_url')
    .eq('id', user.id)
    .maybeSingle();

  // Se serviceSupabase falhar, tenta via client do usuário
  if (!membro) {
    const { data: membroUserClient } = await supabase
      .from('membros')
      .select('id, agencia_id, papel, ativo, cliente_id, nome, cargo, foto_url')
      .eq('id', user.id)
      .maybeSingle();
    if (membroUserClient) {
      membro = membroUserClient;
    }
  }

  // 2. A conta existe no Auth mas não foi aprovada. Nunca promovemos nem reativamos ninguém
  // aqui: antes qualquer cadastro virava master da agência.
  if (!membro) {
    return {
      ok: false,
      response: respostaErro('Sua conta ainda não está vinculada a uma agência. Peça a um administrador para liberar o acesso.', 403),
    };
  }
  if (!membro.ativo) {
    return { ok: false, response: respostaErro('Seu acesso está aguardando aprovação de um administrador.', 403) };
  }

  return { ok: true, ctx: { supabase, user, membro: membro as Membro } };
}

/**
 * A FK de clientes.instagram_account_id ignora RLS, então sem esta checagem
 * daria para vincular a conta de outro usuário só conhecendo o id dela.
 * Confere que a conta é uma das que o próprio usuário conectou.
 */
export async function validarContaInstagram(userId: string, contaId: string): Promise<boolean> {
  try {
    const contas = await listInstagramAccountsForUser(userId);
    return contas.some((c) => c.id === contaId);
  } catch (err) {
    // Falha fechada: se não dá para confirmar a posse, não vincula.
    console.error('Erro ao validar conta do Instagram:', err);
    return false;
  }
}

/**
 * Contas de Instagram do usuário para o seletor de vínculo. A lista de clientes
 * não pode cair só porque essa busca falhou (ela usa o cliente de service role,
 * que depende de variáveis de ambiente à parte), então degrada para vazio.
 */
export async function listarContasSeguro(userId: string) {
  try {
    return await listInstagramAccountsForUser(userId);
  } catch (err) {
    console.error('Erro ao listar contas do Instagram:', err);
    return [];
  }
}

/** Traduz erros do Postgres/PostgREST em resposta útil, sem vazar detalhe interno. */
export function traduzirErroBanco(error: { code?: string; message: string }, contexto: string) {
  switch (error.code) {
    case '23505':
      return respostaErro('Essa conta de Instagram já está vinculada a outro cliente.', 409);
    case '23503':
      return respostaErro('Referência inválida: o item vinculado não existe.', 400);
    case '23514':
      return respostaErro('Algum valor está fora do permitido.', 400);
    case '42501':
      return respostaErro('Você não tem permissão para essa ação.', 403);
    case '22P02':
      return respostaErro('Formato de identificador ou dado inválido.', 400);
    default:
      console.error(`Erro em ${contexto}:`, error.code, error.message);
      return respostaErro('Erro interno. Tente novamente.', 500);
  }
}
