import { supabase } from '@/lib/supabase';

export interface InstagramAccount {
  id: string;
  user_id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  access_token: string;
  token_expires_at: string | null;
  profile_picture_url: string | null;
}

/**
 * Busca a conta do Instagram dona de um determinado instagram_user_id (usado
 * pelo webhook e pelo worker de fila, que recebem apenas o ID da Meta e
 * precisam descobrir a quem ela pertence). Substitui a antiga tabela `config`,
 * que só suportava uma única linha para o sistema inteiro.
 */
export async function getInstagramAccountByInstagramUserId(instagramUserId: string) {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('instagram_user_id', instagramUserId)
    .maybeSingle<InstagramAccount>();

  if (error) throw error;
  return data;
}

/**
 * Lista todas as contas do Instagram conectadas por um usuário, mais recente
 * primeiro. Usada para popular o seletor de contas no dashboard.
 */
export async function listInstagramAccountsForUser(userId: string) {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('id, instagram_user_id, instagram_username, profile_picture_url, token_expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Busca a conta do Instagram "ativa" para as rotas de API. Se `instagramUserId`
 * for informado (vindo do seletor de contas no dashboard), busca exatamente
 * essa conta do usuário. Caso contrário, cai para a conta conectada mais
 * recentemente — mantém funcionando quem ainda não usou o seletor.
 */
export async function getActiveInstagramAccountForUser(userId: string, instagramUserId?: string | null) {
  let query = supabase
    .from('instagram_accounts')
    .select('*')
    .eq('user_id', userId);

  if (instagramUserId) {
    query = query.eq('instagram_user_id', instagramUserId);
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(1).maybeSingle<InstagramAccount>();

  if (error) throw error;
  return data;
}
