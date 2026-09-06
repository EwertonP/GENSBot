import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Loga (sem lançar) erros de escrita no Supabase que antes eram descartados
 * silenciosamente — foi assim que o bug de `analytics_events` sem `user_id`
 * (insert falhando em toda automação, sempre, sem ninguém notar) passou
 * despercebido por meses. Usar em todo `insert`/`update`/`upsert`/`delete`
 * cujo resultado não seja checado de outra forma.
 */
export function logDbError(context: string, error: PostgrestError | null) {
  if (error) console.error(`[db] ${context}:`, error.message, error.details || error.hint || '');
}
