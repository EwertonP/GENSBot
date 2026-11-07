/**
 * Regras de responsabilidade pelas entregas (alimentam a produtividade da equipe).
 *
 * 1. Demanda sem responsável: quem a trabalha (move de etapa, edita o conteúdo,
 *    conclui ou publica) passa a ser o responsável, para a entrega contar.
 * 2. Post sem demanda: o responsável é quem agendou/publicou (ou quem foi
 *    escolhido no agendamento) e o post conta como uma entrega.
 */

/** Campos que indicam trabalho na peça (mexer só em ordem, etiqueta ou prazo não conta). */
export const CAMPOS_DE_TRABALHO = [
  'status',
  'concluida',
  'titulo',
  'legenda',
  'briefing',
  'briefing_html',
  'arquivos',
  'cover_url',
  'data_programada',
  'publicado_em',
  'automacao_config',
  'tipo',
] as const;

export function ehTrabalho(updates: Record<string, unknown>): boolean {
  return CAMPOS_DE_TRABALHO.some((c) => c in updates);
}

/**
 * Quem passa a ser o responsável: o ator, se a demanda ainda não tem ninguém e
 * a ação foi de trabalho. Devolve null quando nada muda.
 */
export function responsavelAutomatico(args: {
  responsavelAtual: string | null | undefined;
  atorId: string | null | undefined;
  updates: Record<string, unknown>;
}): string | null {
  if (!args.atorId || args.responsavelAtual) return null;
  if ('responsavel_id' in args.updates) return null; // a pessoa escolheu quem é (mesmo que "ninguém")
  return ehTrabalho(args.updates) ? args.atorId : null;
}

export type TipoEntrega = 'post' | 'reel' | 'story' | 'carrossel';

/** Tipo da entrega a partir do tipo de mídia do Instagram. */
export function tipoDoPostDireto(mediaType: string | null | undefined): TipoEntrega {
  switch ((mediaType || '').toUpperCase()) {
    case 'REELS':
    case 'VIDEO':
      return 'reel';
    case 'STORIES':
    case 'STORY':
      return 'story';
    case 'CAROUSEL':
      return 'carrossel';
    default:
      return 'post';
  }
}

export interface PostAgendadoBruto {
  id: string;
  user_id: string | null;
  responsavel_id?: string | null;
  instagram_user_id: string | null;
  media_type: string | null;
  caption?: string | null;
  status: string;
  published_at: string | null;
}

export interface PostDireto {
  id: string;
  responsavel_id: string;
  cliente_id: string | null;
  tipo: TipoEntrega;
  titulo: string;
  publicado_em: string;
}

/**
 * Posts publicados que não pertencem a nenhuma demanda: cada um conta como
 * uma entrega do responsável (ou de quem agendou, se não houver responsável).
 */
export function postsDiretos(
  posts: PostAgendadoBruto[],
  idsComDemanda: Set<string>,
  clientePorConta: Map<string, string>
): PostDireto[] {
  const saida: PostDireto[] = [];
  for (const p of posts) {
    if (p.status !== 'published' || !p.published_at) continue;
    if (idsComDemanda.has(p.id)) continue;
    const responsavel = p.responsavel_id || p.user_id;
    if (!responsavel) continue;
    const legenda = (p.caption || '').replace(/\s+/g, ' ').trim();
    saida.push({
      id: p.id,
      responsavel_id: responsavel,
      cliente_id: p.instagram_user_id ? clientePorConta.get(p.instagram_user_id) ?? null : null,
      tipo: tipoDoPostDireto(p.media_type),
      titulo: legenda ? (legenda.length > 70 ? `${legenda.slice(0, 67)}...` : legenda) : 'Post publicado direto',
      publicado_em: p.published_at,
    });
  }
  return saida;
}
