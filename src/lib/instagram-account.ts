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
 * Busca todos os IDs de usuários da mesma agência do usuário fornecido.
 * Se o usuário pertence a uma agência, os outros sócios e membros dessa agência
 * compartilham o acesso aos perfis do Instagram conectados.
 */
async function getUserIdsInSameAgency(userId: string): Promise<string[]> {
  try {
    const { data: userMembro } = await supabase
      .from('membros')
      .select('agencia_id')
      .eq('id', userId)
      .maybeSingle();

    if (userMembro?.agencia_id) {
      const { data: agenciaMembros } = await supabase
        .from('membros')
        .select('id')
        .eq('agencia_id', userMembro.agencia_id);

      if (agenciaMembros && agenciaMembros.length > 0) {
        return agenciaMembros.map((m) => m.id);
      }
    }
  } catch (err) {
    console.error('Erro ao buscar membros da mesma agência:', err);
  }
  return [userId];
}

/**
 * Busca a conta do Instagram dona de um determinado instagram_user_id (usado
 * pelo webhook e pelo worker de fila).
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
 * Lista todas as contas do Instagram conectadas pela agência/usuário, mais recente primeiro.
 * Usada para popular o seletor de contas no dashboard.
 */
export async function listInstagramAccountsForUser(userId: string) {
  const agencyUserIds = await getUserIdsInSameAgency(userId);
  
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('id, instagram_user_id, instagram_username, profile_picture_url, token_expires_at, created_at')
    .in('user_id', agencyUserIds.length > 0 ? agencyUserIds : [userId])
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    // Fallback: se não encontrar por ID de membro, retorna todas as contas cadastradas do sistema
    const { data: fallback } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_user_id, instagram_username, profile_picture_url, token_expires_at, created_at')
      .order('created_at', { ascending: false });
    return fallback || [];
  }
  return data;
}

/**
 * Busca a conta do Instagram "ativa" para as rotas de API. Se `instagramUserId`
 * for informado, busca exatamente essa conta da agência. Caso contrário, cai para a
 * conta conectada mais recentemente.
 */
export async function getActiveInstagramAccountForUser(userId: string, instagramUserId?: string | null) {
  const agencyUserIds = await getUserIdsInSameAgency(userId);

  let query = supabase
    .from('instagram_accounts')
    .select('*');

  if (instagramUserId && instagramUserId !== 'all') {
    query = query.eq('instagram_user_id', instagramUserId);
  } else {
    query = query.in('user_id', agencyUserIds.length > 0 ? agencyUserIds : [userId]).order('created_at', { ascending: false });
  }

  let { data, error } = await query.limit(1).maybeSingle<InstagramAccount>();

  if (!data && instagramUserId) {
    // Busca global por instagram_user_id sem filtro de user_id
    const { data: fallback } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('instagram_user_id', instagramUserId)
      .limit(1)
      .maybeSingle<InstagramAccount>();
    data = fallback;
  }

  if (!data) {
    // Fallback final: pega a conta de Instagram mais recente cadastrada
    const { data: fallback } = await supabase
      .from('instagram_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<InstagramAccount>();
    data = fallback;
  }

  return data;
}
