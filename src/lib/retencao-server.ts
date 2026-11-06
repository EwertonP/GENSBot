import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanupStorageMedia } from './storage-upload';
import { diasRetencaoTexto, RETENCAO_TEXTO_MIN_DIAS, vencidaParaExcluir } from './retencao';

interface ItemPublicado {
  id: string;
  publicado_em: string | null;
  arquivos: unknown[] | null;
  cliente_id: string;
}

/**
 * Exclui de vez as demandas publicadas que passaram do prazo de retenção do
 * cliente (padrão 30 dias). Antes de apagar, remove qualquer mídia que tenha
 * sobrado no armazenamento. Nunca lança erro: é limpeza de rotina.
 */
export async function limparConteudoPublicado(db: SupabaseClient, agora: Date = new Date()): Promise<{ excluidas: number }> {
  try {
    const corte = new Date(agora.getTime() - RETENCAO_TEXTO_MIN_DIAS * 24 * 60 * 60 * 1000).toISOString();

    const { data: itens, error } = await db
      .from('conteudo_items')
      .select('id, publicado_em, arquivos, cliente_id')
      .eq('status', 'publicado')
      .not('publicado_em', 'is', null)
      .lt('publicado_em', corte)
      .limit(300);
    if (error || !itens?.length) return { excluidas: 0 };

    // Prazo por cliente. Se a coluna ainda não existir, todos usam o padrão.
    const clienteIds = [...new Set((itens as ItemPublicado[]).map((i) => i.cliente_id))];
    const prazoPorCliente = new Map<string, number | null>();
    const { data: clientes, error: erroClientes } = await db.from('clientes').select('id, retencao_texto_dias').in('id', clienteIds);
    if (!erroClientes) {
      for (const c of clientes || []) prazoPorCliente.set(c.id, c.retencao_texto_dias ?? null);
    }

    const vencidas = (itens as ItemPublicado[]).filter((i) =>
      vencidaParaExcluir(i.publicado_em, diasRetencaoTexto(prazoPorCliente.get(i.cliente_id)), agora)
    );
    if (vencidas.length === 0) return { excluidas: 0 };

    for (const item of vencidas) {
      if (Array.isArray(item.arquivos) && item.arquivos.length > 0) {
        await cleanupStorageMedia(db, item.arquivos).catch(() => {});
      }
    }

    const { error: erroDelete } = await db
      .from('conteudo_items')
      .delete()
      .in('id', vencidas.map((i) => i.id))
      .eq('status', 'publicado');
    if (erroDelete) {
      console.warn('[Retenção] Erro ao excluir demandas publicadas antigas:', erroDelete.message);
      return { excluidas: 0 };
    }
    return { excluidas: vencidas.length };
  } catch (err) {
    console.warn('[Retenção] Falha na limpeza de demandas publicadas:', err);
    return { excluidas: 0 };
  }
}
