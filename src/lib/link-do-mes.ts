/**
 * Link do mês: janela viva do que a cliente precisa ver, mês a mês.
 *
 * Regra (por coluna do kanban):
 *  - planejamento     → "texto": só o texto (título, roteiro, legenda), sem arte
 *  - criação / revisão interna → oculto
 *  - revisão do cliente → "aprovacao": texto + mídia pronta, com aprovar/ajuste
 *  - agendado / publicado → "publicado": aba somente leitura
 *
 * O status é lido a cada abertura do link; mover o card no kanban já atualiza.
 */
import { mapearStatusParaColunaKanban, type ArquivoConteudo, type StatusConteudo } from './conteudo';

export type EtapaMes = 'texto' | 'aprovacao' | 'publicado';
export type AbaMes = 'para_voce' | 'publicados';

export interface ItemBrutoDoMes {
  id: string;
  tipo: string;
  status: StatusConteudo;
  titulo: string | null;
  legenda: string | null;
  briefing: string | null;
  mes_referencia: string;
  data_programada: string | null;
  publicado_em: string | null;
  ordem: number | null;
  arquivos: ArquivoConteudo[] | null;
  cover_url: string | null;
  token_aprovacao: string | null;
  visivel_cliente?: boolean | null;
  arquivada_em?: string | null;
}

export interface SugestaoPublica {
  campo: 'titulo' | 'briefing' | 'legenda';
  texto: string;
}

export interface ItemDoMes {
  id: string;
  tipo: string;
  etapa: EtapaMes;
  aba: AbaMes;
  titulo: string | null;
  legenda: string | null;
  briefing: string | null;
  data_programada: string | null;
  publicado_em: string | null;
  arquivos: ArquivoConteudo[];
  cover_url: string | null;
  /** Só vem preenchido quando a cliente pode agir (etapa "aprovacao"). */
  token_aprovacao: string | null;
  pode_agir: boolean;
  /** Sugestões de texto da cliente ainda pendentes (só em planejamento). */
  sugestoes?: SugestaoPublica[];
}

/** Em que etapa o item aparece no link, ou null se deve ficar oculto. */
export function etapaNoLinkDoMes(status: StatusConteudo): EtapaMes | null {
  switch (mapearStatusParaColunaKanban(status)) {
    case 'planejamento':
      return 'texto';
    case 'revisao_cliente':
      return 'aprovacao';
    case 'agendamento':
    case 'publicado':
      return 'publicado';
    default:
      return null;
  }
}

export function abaDaEtapa(etapa: EtapaMes): AbaMes {
  return etapa === 'publicado' ? 'publicados' : 'para_voce';
}

/**
 * Monta o item que vai para a cliente. Nada além do necessário sai daqui:
 * em "texto" a arte e o token de aprovação nunca são enviados.
 */
export function montarItemDoMes(item: ItemBrutoDoMes): ItemDoMes | null {
  if (item.visivel_cliente === false || item.arquivada_em) return null;
  const etapa = etapaNoLinkDoMes(item.status);
  if (!etapa) return null;

  const temMidia = etapa !== 'texto';
  const arquivos = temMidia
    ? [...(item.arquivos || [])].filter((a) => !!a?.url).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    : [];
  const podeAgir = etapa === 'aprovacao';

  return {
    id: item.id,
    tipo: item.tipo,
    etapa,
    aba: abaDaEtapa(etapa),
    titulo: item.titulo,
    legenda: item.legenda,
    briefing: item.briefing,
    data_programada: item.data_programada,
    publicado_em: item.publicado_em,
    arquivos,
    cover_url: temMidia ? item.cover_url : null,
    token_aprovacao: podeAgir ? item.token_aprovacao : null,
    pode_agir: podeAgir,
  };
}

/** Aceita "2026-11", "2026-11-01" ou data ISO e devolve "2026-11-01" (ou null). */
export function normalizarMes(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(valor.trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** Mês corrente no fuso de Brasília, como "YYYY-MM-01". */
export function mesAtual(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(agora);
  return `${partes.slice(0, 7)}-01`;
}

/**
 * Mês exibido: o pedido, se válido; senão o corrente, se tiver itens; senão o
 * mais recente com itens; senão o corrente.
 */
export function escolherMes(pedido: string | null | undefined, mesesComItens: string[], agora: Date = new Date()): string {
  const pedidoOk = normalizarMes(pedido);
  if (pedidoOk) return pedidoOk;
  const atual = mesAtual(agora);
  if (mesesComItens.includes(atual)) return atual;
  const ordenados = [...mesesComItens].sort();
  return ordenados[ordenados.length - 1] || atual;
}

/** Ordena por data programada (sem data vai para o fim) e depois pela ordem do kanban. */
export function ordenarItensDoMes<T extends { data_programada: string | null; id: string }>(
  itens: T[],
  ordemPorId: Map<string, number> = new Map()
): T[] {
  return [...itens].sort((a, b) => {
    if (a.data_programada && b.data_programada) {
      const d = a.data_programada.localeCompare(b.data_programada);
      if (d !== 0) return d;
    } else if (a.data_programada) {
      return -1;
    } else if (b.data_programada) {
      return 1;
    }
    return (ordemPorId.get(a.id) ?? 0) - (ordemPorId.get(b.id) ?? 0);
  });
}
