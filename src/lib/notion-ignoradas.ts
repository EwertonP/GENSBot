import type { SupabaseClient } from '@supabase/supabase-js';

interface DemandaComNotion {
  agencia_id: string | null;
  cliente_id?: string | null;
  titulo?: string | null;
  notion_page_id?: string | null;
}

/**
 * Lembra as páginas do Notion de demandas que estão sendo excluídas, para a
 * sincronização diária não recriá-las. Melhor esforço: nunca lança erro.
 */
export async function ignorarPaginasNotion(db: SupabaseClient, demandas: DemandaComNotion[]): Promise<void> {
  const linhas = demandas
    .filter((d) => d.notion_page_id && d.agencia_id)
    .map((d) => ({ notion_page_id: d.notion_page_id as string, agencia_id: d.agencia_id as string, cliente_id: d.cliente_id || null, titulo: d.titulo ? d.titulo.slice(0, 200) : null }));
  if (linhas.length === 0) return;
  try {
    const { error } = await db.from('notion_paginas_ignoradas').upsert(linhas, { onConflict: 'notion_page_id' });
    if (error) console.warn('[Notion] não foi possível registrar páginas ignoradas:', error.message);
  } catch (e) {
    console.warn('[Notion] falha ao registrar páginas ignoradas:', e);
  }
}

/** Conjunto de ids de páginas que a sincronização deve pular. Se a tabela não existir, nenhuma é ignorada. */
export async function paginasNotionIgnoradas(db: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await db.from('notion_paginas_ignoradas').select('notion_page_id').limit(10000);
    if (error) return new Set();
    return new Set((data || []).map((r: { notion_page_id: string }) => r.notion_page_id));
  } catch {
    return new Set();
  }
}
