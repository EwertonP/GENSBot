/**
 * Entregas arquivadas: antes de uma demanda publicada ser excluída (retenção ou
 * exclusão manual), guardamos um registro leve dela para a produtividade
 * continuar contando mês a mês por cliente e por pessoa.
 */

export interface DemandaParaArquivar {
  id: string;
  agencia_id: string | null;
  cliente_id: string | null;
  tipo: string | null;
  titulo: string | null;
  status: string | null;
  concluida?: boolean | null;
  mes_referencia: string | null;
  responsavel_id: string | null;
  co_responsaveis_ids?: string[] | null;
  scheduled_post_id?: string | null;
  publicado_em: string | null;
  criado_em?: string | null;
}

export interface LinhaArquivada {
  id: string;
  agencia_id: string;
  cliente_id: string | null;
  tipo: string;
  titulo: string | null;
  status: string;
  concluida: boolean;
  mes_referencia: string | null;
  responsavel_id: string | null;
  co_responsaveis_ids: string[];
  scheduled_post_id: string | null;
  publicado_em: string | null;
  criado_em: string | null;
}

/** Linha a gravar a partir da demanda; null se não dá para arquivar (sem agência). */
export function linhaArquivada(d: DemandaParaArquivar): LinhaArquivada | null {
  if (!d.id || !d.agencia_id) return null;
  return {
    id: d.id,
    agencia_id: d.agencia_id,
    cliente_id: d.cliente_id || null,
    tipo: d.tipo || 'post',
    titulo: d.titulo ? d.titulo.slice(0, 200) : null,
    status: d.status || 'publicado',
    concluida: true,
    mes_referencia: d.mes_referencia ? d.mes_referencia.slice(0, 10) : null,
    responsavel_id: d.responsavel_id || null,
    co_responsaveis_ids: Array.isArray(d.co_responsaveis_ids) ? d.co_responsaveis_ids.filter(Boolean) : [],
    scheduled_post_id: d.scheduled_post_id || null,
    publicado_em: d.publicado_em || null,
    criado_em: d.criado_em || null,
  };
}

/** A linha arquivada no mesmo formato de uma demanda, para somar com as vivas. */
export function arquivadaComoDemanda(l: Partial<LinhaArquivada> & { id: string }) {
  return {
    id: l.id,
    titulo: l.titulo ?? null,
    tipo: l.tipo || 'post',
    status: 'publicado',
    concluida: true,
    mes_referencia: l.mes_referencia ?? '',
    data_programada: null,
    publicado_em: l.publicado_em ?? null,
    responsavel_id: l.responsavel_id ?? null,
    co_responsaveis_ids: Array.isArray(l.co_responsaveis_ids) ? l.co_responsaveis_ids : [],
    cliente_id: l.cliente_id ?? null,
    arquivada: true as const,
  };
}
