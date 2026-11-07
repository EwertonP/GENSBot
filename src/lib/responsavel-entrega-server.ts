import { supabase } from './supabase';

/** O membro existe nesta agência? (impede escolher responsável de outra agência) */
export async function membroDaAgencia(membroId: unknown, agenciaId: string): Promise<string | null> {
  if (typeof membroId !== 'string' || !membroId) return null;
  try {
    const { data } = await supabase.from('membros').select('id').eq('id', membroId).eq('agencia_id', agenciaId).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Garante responsável numa demanda que está sendo publicada/agendada: se ainda
 * não tem ninguém, fica com quem agendou. Nunca troca um responsável existente
 * e nunca lança erro (é um complemento da publicação).
 */
export async function garantirResponsavelDaDemanda(itemId: string, membroId: string | null | undefined): Promise<void> {
  if (!itemId || !membroId) return;
  try {
    await supabase.from('conteudo_items').update({ responsavel_id: membroId }).eq('id', itemId).is('responsavel_id', null);
  } catch {
    /* melhor esforço */
  }
}
