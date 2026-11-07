import type { SupabaseClient } from '@supabase/supabase-js';
import { linhaArquivada, type DemandaParaArquivar } from './entregas-arquivadas';

/**
 * Guarda o registro leve das demandas antes de excluí-las. Devolve true só se
 * todas foram guardadas: quem exclui deve parar se o arquivamento falhar, para
 * a contagem nunca se perder.
 */
export async function arquivarEntregas(db: SupabaseClient, demandas: DemandaParaArquivar[]): Promise<boolean> {
  const linhas = demandas.map(linhaArquivada).filter((l): l is NonNullable<ReturnType<typeof linhaArquivada>> => !!l);
  if (linhas.length !== demandas.length) return false;
  if (linhas.length === 0) return true;
  try {
    const { error } = await db.from('entregas_arquivadas').upsert(linhas, { onConflict: 'id' });
    if (error) {
      console.warn('[Arquivo] não foi possível arquivar as entregas:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Arquivo] falha ao arquivar as entregas:', e);
    return false;
  }
}
