/**
 * Link do mês: a cliente acompanha todo o processo de cada post do mês.
 *
 * Etapas que ela vê (a partir da coluna do kanban):
 *  1. texto      planejamento: só o texto; ela aprova o texto ou sugere mudança
 *  2. producao   criação, gravação, edição: texto visível, arte ainda não
 *  3. revisao    revisão interna ou ajuste pela equipe: texto visível, arte não
 *  4. aprovacao  revisão do cliente: texto + arte, com aprovar/pedir ajuste
 *  5. agendado   aprovado e na fila de publicação
 *  6. publicado  já no ar
 *
 * O status é lido a cada abertura (e a página recarrega sozinha): mover o card
 * no kanban já muda o que ela vê. O mês de cada post é o da data programada.
 */
import { mapearStatusParaColunaKanban, type ArquivoConteudo, type StatusConteudo } from './conteudo';
import { formatoDoPost, limparTitulo, separarRoteiro, type FormatoPost } from './roteiro-cliente';

export type EtapaMes = 'texto' | 'producao' | 'revisao' | 'aprovacao' | 'agendado' | 'publicado';
export type FiltroMes = 'todos' | 'para_voce' | 'publicados';

/** Etapas na ordem do processo, com o texto que a cliente lê. */
export const ETAPAS_PROCESSO: { etapa: EtapaMes; rotulo: string; descricao: string }[] = [
  { etapa: 'texto', rotulo: 'Planejamento', descricao: 'Revise o texto. Quando estiver bom, toque em Aprovar texto. A arte vem depois.' },
  { etapa: 'producao', rotulo: 'Produção', descricao: 'A equipe está criando a arte ou o vídeo.' },
  { etapa: 'revisao', rotulo: 'Revisão da equipe', descricao: 'A equipe está revisando ou ajustando antes de mostrar a você.' },
  { etapa: 'aprovacao', rotulo: 'Sua aprovação', descricao: 'O post está pronto. Confira e toque em Aprovar post, ou peça ajuste.' },
  { etapa: 'agendado', rotulo: 'Agendado', descricao: 'Aprovado e na fila para publicar na data marcada.' },
  { etapa: 'publicado', rotulo: 'Publicado', descricao: 'Já está no seu perfil.' },
];

export function indiceDaEtapa(etapa: EtapaMes): number {
  return ETAPAS_PROCESSO.findIndex((e) => e.etapa === etapa);
}

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
  texto_aprovado_em?: string | null;
  texto_aprovado_por?: string | null;
}

export interface SugestaoPublica {
  campo: 'titulo' | 'briefing' | 'legenda';
  texto: string;
}

export interface ItemDoMes {
  id: string;
  tipo: string;
  /** Formato para mostrar (Reels, Carrossel, Story, Post). */
  formato: FormatoPost;
  etapa: EtapaMes;
  titulo: string | null;
  legenda: string | null;
  briefing: string | null;
  data_programada: string | null;
  publicado_em: string | null;
  arquivos: ArquivoConteudo[];
  cover_url: string | null;
  /** Só vem preenchido quando a cliente pode aprovar a arte (etapa "aprovacao"). */
  token_aprovacao: string | null;
  /** Aprovar a arte (etapa "aprovacao"). */
  pode_agir: boolean;
  /** Aprovar o texto (etapa "texto", ainda não aprovado). */
  pode_aprovar_texto: boolean;
  texto_aprovado_em: string | null;
  texto_aprovado_por: string | null;
  /** Há algo para a cliente fazer agora. */
  precisa_de_voce: boolean;
  /** Até quando o texto fica disponível (só posts publicados). */
  texto_ate?: string | null;
  /** Sugestões de texto da cliente ainda pendentes (só em planejamento). */
  sugestoes?: SugestaoPublica[];
}

/** Etapa que a cliente vê para um status da esteira. */
export function etapaNoLinkDoMes(status: StatusConteudo): EtapaMes {
  switch (mapearStatusParaColunaKanban(status)) {
    case 'planejamento':
      return 'texto';
    case 'criacao_arte':
      return 'producao';
    case 'revisao_interna':
      return 'revisao';
    case 'revisao_cliente':
      return 'aprovacao';
    case 'agendamento':
      return 'agendado';
    case 'publicado':
      return 'publicado';
    default:
      return 'texto';
  }
}

/** A arte só aparece quando já foi mostrada à cliente para aprovar. */
export function etapaMostraArte(etapa: EtapaMes): boolean {
  return etapa === 'aprovacao' || etapa === 'agendado' || etapa === 'publicado';
}

/**
 * Com a arte pronta, o post é o que importa: o texto dos slides/roteiro sai de
 * cena e ficam só a prévia e a legenda.
 */
export function etapaMostraRoteiro(etapa: EtapaMes): boolean {
  return !etapaMostraArte(etapa);
}

export function itemNoFiltro(item: Pick<ItemDoMes, 'etapa' | 'precisa_de_voce'>, filtro: FiltroMes): boolean {
  if (filtro === 'para_voce') return item.precisa_de_voce;
  if (filtro === 'publicados') return item.etapa === 'agendado' || item.etapa === 'publicado';
  return true;
}

/**
 * Monta o item que vai para a cliente. Nada além do necessário sai daqui: arte
 * só depois de pronta para ela, token de aprovação só na etapa de aprovação.
 */
export function montarItemDoMes(item: ItemBrutoDoMes): ItemDoMes | null {
  if (item.visivel_cliente === false || item.arquivada_em) return null;
  const etapa = etapaNoLinkDoMes(item.status);

  const temMidia = etapaMostraArte(etapa);
  const arquivos = temMidia
    ? [...(item.arquivos || [])].filter((a) => !!a?.url).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    : [];
  const podeAgir = etapa === 'aprovacao';
  const textoAprovadoEm = item.texto_aprovado_em ?? null;
  const podeAprovarTexto = etapa === 'texto' && !textoAprovadoEm;

  return {
    id: item.id,
    tipo: item.tipo,
    formato: formatoDoPost(item.tipo, item.titulo, (item.arquivos || []).length),
    etapa,
    // Prefixos internos do título e notas internas do roteiro não saem do servidor.
    titulo: limparTitulo(item.titulo) || null,
    legenda: item.legenda,
    // Com a arte pronta o roteiro nem sai do servidor: só prévia e legenda.
    briefing: etapaMostraRoteiro(etapa) ? separarRoteiro(item.briefing).visivel || null : null,
    data_programada: item.data_programada,
    publicado_em: item.publicado_em,
    arquivos,
    cover_url: temMidia ? item.cover_url : null,
    token_aprovacao: podeAgir ? item.token_aprovacao : null,
    pode_agir: podeAgir,
    pode_aprovar_texto: podeAprovarTexto,
    texto_aprovado_em: textoAprovadoEm,
    texto_aprovado_por: textoAprovadoEm ? item.texto_aprovado_por ?? null : null,
    precisa_de_voce: podeAgir || podeAprovarTexto,
  };
}

/** Aceita "2026-11", "2026-11-01" ou data ISO e devolve "2026-11-01" (ou null). */
export function normalizarMes(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(valor.trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** Mês de uma data no fuso de Brasília, como "YYYY-MM-01". */
export function mesDaData(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(data);
  return `${partes.slice(0, 7)}-01`;
}

/** Mês corrente no fuso de Brasília, como "YYYY-MM-01". */
export function mesAtual(agora: Date = new Date()): string {
  return mesDaData(agora);
}

/**
 * Mês em que o post aparece: o da data programada (o que a cliente espera ver),
 * ou o mês de referência quando ainda não há data.
 */
export function mesDoItem(item: { data_programada: string | null; mes_referencia: string }): string | null {
  if (item.data_programada) {
    const d = new Date(item.data_programada.length <= 10 ? `${item.data_programada}T12:00:00-03:00` : item.data_programada);
    if (!Number.isNaN(d.getTime())) return mesDaData(d);
  }
  return normalizarMes(item.mes_referencia);
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
