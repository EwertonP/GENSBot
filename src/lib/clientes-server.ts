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
import { ehUuid } from '@/lib/clientes';

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

/**
 * Quais clientes o usuário logado pode trabalhar.
 * - master: `total` (vê a agência inteira, como antes).
 * - papel 'cliente' (portal): só o próprio cliente.
 * - membro comum: só os clientes vinculados em membro_clientes.
 *
 * A RLS já aplica a mesma regra no banco para a sessão do usuário. Esta função
 * existe porque as rotas que usam a service role ignoram RLS e precisam filtrar
 * na mão.
 */
export type EscopoClientes = { total: true } | { total: false; ids: string[] };

export async function escopoClientes(ctx: ContextoAgencia): Promise<EscopoClientes> {
  const { membro } = ctx;
  if (membro.papel === 'master') return { total: true };
  if (membro.papel === 'cliente') {
    return { total: false, ids: membro.cliente_id ? [membro.cliente_id] : [] };
  }
  // Falha fechada: se a consulta falhar, o escopo fica vazio.
  const { data, error } = await serviceSupabase
    .from('membro_clientes')
    .select('cliente_id')
    .eq('membro_id', membro.id)
    .eq('agencia_id', membro.agencia_id);
  if (error) {
    console.error('Erro ao carregar escopo de clientes:', error.message);
    return { total: false, ids: [] };
  }
  return { total: false, ids: (data ?? []).map((r) => r.cliente_id as string) };
}

/** Confere se o escopo cobre este cliente. */
export function podeAcessarCliente(escopo: EscopoClientes, clienteId: string | null | undefined): boolean {
  if (escopo.total) return true;
  return !!clienteId && escopo.ids.includes(clienteId);
}

/**
 * Guarda para rotas de uma demanda (conteudo_items) por id. Retorna uma resposta de
 * erro se o usuário não puder ver a demanda, ou null se pode seguir.
 * Responde 404 (e não 403) para não confirmar que a demanda existe.
 */
export async function validarAcessoItemConteudo(
  ctx: ContextoAgencia,
  itemId: string
): Promise<NextResponse | null> {
  const escopo = await escopoClientes(ctx);
  if (escopo.total) return null;

  const { data } = await serviceSupabase
    .from('conteudo_items')
    .select('cliente_id, agencia_id')
    .eq('id', itemId)
    .maybeSingle();

  if (!data || data.agencia_id !== ctx.membro.agencia_id || !podeAcessarCliente(escopo, data.cliente_id)) {
    return respostaErro('Demanda não encontrada.', 404);
  }
  return null;
}

/**
 * Troca os clientes liberados para um membro. Usa o cliente da sessão: a RLS de
 * membro_clientes já garante que só master escreve.
 */
export async function salvarVinculosClientes(
  ctx: ContextoAgencia,
  membroId: string,
  clientesIds: unknown[]
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const ids = Array.from(new Set(clientesIds.filter((c): c is string => typeof c === 'string' && ehUuid(c))));
  const { supabase, membro } = ctx;

  const { error: erroApagar } = await supabase
    .from('membro_clientes')
    .delete()
    .eq('membro_id', membroId)
    .eq('agencia_id', membro.agencia_id);
  if (erroApagar) return { ok: false, response: traduzirErroBanco(erroApagar, 'equipe vinculos apagar') };

  if (ids.length > 0) {
    const linhas = ids.map((cliente_id) => ({ membro_id: membroId, cliente_id, agencia_id: membro.agencia_id }));
    const { error: erroInserir } = await supabase.from('membro_clientes').insert(linhas);
    if (erroInserir) return { ok: false, response: traduzirErroBanco(erroInserir, 'equipe vinculos inserir') };
  }
  return { ok: true };
}

/**
 * Áreas da agência inteira (CRM, Inbox, Rotina, Calendário, WhatsApp) não são de
 * quem tem escopo de clientes. Papel 'membro' (não master) recebe 403. Papel
 * 'cliente' segue as regras de cada rota.
 */
export function respostaSeMembroEscopado(ctx: ContextoAgencia): NextResponse | null {
  if (ctx.membro.papel === 'membro') {
    return respostaErro('Essa área é restrita à administração da agência.', 403);
  }
  return null;
}

/** Campos da ficha de cliente que são financeiros ou jurídicos. Só master vê. */
export const CAMPOS_FINANCEIROS_CLIENTE = [
  'valor_mensal',
  'dia_vencimento',
  'contrato_inicio',
  'contrato_duracao_meses',
  'contrato_arquivo_url',
  'cnpj_cpf',
  'responsavel_legal',
  'cpf_responsavel',
  'endereco',
  'responsavel_venda_id',
  'convertido_em',
  'lead_id',
] as const;

/** Remove os campos financeiros de um cliente quando quem consulta não é master. */
export function ocultarCamposFinanceiros<T extends object>(cliente: T, escopo: EscopoClientes): T {
  if (escopo.total) return cliente;
  const copia: Record<string, unknown> = { ...(cliente as Record<string, unknown>) };
  for (const campo of CAMPOS_FINANCEIROS_CLIENTE) delete copia[campo];
  return copia as T;
}
