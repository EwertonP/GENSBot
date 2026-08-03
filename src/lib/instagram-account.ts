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
 * Busca a conta do Instagram mais recentemente conectada por um usuário logado.
 * Mantém o comportamento de "uma conta ativa por usuário" que as rotas de API
 * já assumiam via `config`, mas sem o bug de single-row global.
 */
export async function getActiveInstagramAccountForUser(userId: string) {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<InstagramAccount>();

  if (error) throw error;
  return data;
}
