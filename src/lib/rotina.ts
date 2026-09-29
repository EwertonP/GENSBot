/**
 * Rotina 2.0 — "Meu trabalho".
 *
 * O Kanban pessoal junta duas fontes:
 * - tarefas próprias (tabela `tarefas`): internas, peças avulsas e sub-tarefas de demanda;
 * - demandas da esteira (`conteudo_items`) em que a pessoa é responsável ou editora.
 *
 * Tarefa anda livre entre as 4 colunas. Demanda é espelho da esteira: a coluna
 * vem da etapa dela, e arrastar move a etapa de verdade (com histórico).
 */
import type { StatusConteudo } from './conteudo';

export type StatusTarefa = 'a_fazer' | 'fazendo' | 'aguardando' | 'concluido';
/** 'pendente' é o status legado (antes do Kanban) e equivale a 'a_fazer'. */
export type StatusTarefaBanco = StatusTarefa | 'pendente';
export type TipoTarefa = 'interno' | 'peca_avulsa' | 'sub_tarefa';
export type PrioridadeTarefa = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface TarefaRotina {
  id: string;
  agencia_id: string;
  cliente_id: string | null;
  responsavel_id: string | null;
  demanda_id: string | null;
  tipo: TipoTarefa;
  titulo: string;
  descricao: string | null;
  status: StatusTarefaBanco;
  prioridade: PrioridadeTarefa;
  prazo: string | null;
  solicitante: string | null;
  aguardando_de: string | null;
  estimativa_min: number | null;
  ordem: number;
  origem: string;
  recorrencia_id?: string | null;
  data_ocorrencia?: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em?: string;
  cliente?: { id: string; nome: string; cor: string | null; foto_url: string | null } | null;
  responsavel?: { id: string; nome: string; email: string; cargo: string | null } | null;
  demanda?: { id: string; titulo: string | null; status: StatusConteudo } | null;
}

/** Demanda da esteira como aparece no Kanban pessoal. */
export interface DemandaRotina {
  id: string;
  cliente_id: string;
  tipo: string;
  titulo: string | null;
  status: StatusConteudo;
  prioridade?: string | null;
  prazo: string | null;
  data_programada: string | null;
  responsavel_id: string | null;
  editor_id: string | null;
  publicado_em: string | null;
  cliente?: { id: string; nome: string; cor: string | null; foto_url: string | null } | null;
}

export const COLUNAS_ROTINA: { id: StatusTarefa; label: string; descricao: string }[] = [
  { id: 'a_fazer', label: 'A fazer', descricao: 'Ainda não comecei' },
  { id: 'fazendo', label: 'Fazendo', descricao: 'Em andamento agora' },
  { id: 'aguardando', label: 'Aguardando', descricao: 'Parado esperando alguém' },
  { id: 'concluido', label: 'Concluído', descricao: 'Feito nos últimos 14 dias' },
];

export const TIPO_TAREFA_LABELS: Record<TipoTarefa, string> = {
  interno: 'Interno',
  peca_avulsa: 'Peça avulsa',
  sub_tarefa: 'Sub-tarefa',
};

export const STATUS_TAREFA_VALIDOS: StatusTarefaBanco[] = ['pendente', 'a_fazer', 'fazendo', 'aguardando', 'concluido'];
export const TIPOS_TAREFA_VALIDOS: TipoTarefa[] = ['interno', 'peca_avulsa', 'sub_tarefa'];

/** Quantos dias um item concluído continua visível na coluna "Concluído". */
export const DIAS_CONCLUIDO_VISIVEL = 14;

export function normalizarStatusTarefa(status: string | null | undefined): StatusTarefa {
  if (status === 'fazendo' || status === 'aguardando' || status === 'concluido') return status;
  return 'a_fazer';
}

/**
 * Em qual coluna do Kanban pessoal uma demanda aparece, a partir da etapa da esteira.
 * - planejamento → A fazer
 * - etapas de criação e ajuste pedido → Fazendo
 * - revisões, aprovação do cliente e agendamento → Aguardando (a bola está com outra pessoa)
 * - publicado → Concluído
 */
export function colunaDaDemanda(status: StatusConteudo): StatusTarefa {
  switch (status) {
    case 'planejamento':
      return 'a_fazer';
    case 'copy':
    case 'criacao_arte':
    case 'em_gravacao':
    case 'em_edicao':
    case 'travado':
      return 'fazendo';
    case 'revisao_arte':
    case 'revisao_interna':
    case 'revisao_cliente':
    case 'agendamento':
    case 'revisao_agendamento':
    case 'pronto_publicar':
      return 'aguardando';
    case 'publicado':
      return 'concluido';
    default:
      return 'a_fazer';
  }
}

/**
 * Etapa da esteira para onde a demanda vai quando é solta numa coluna do Kanban pessoal.
 * Retorna null quando o movimento não é permitido pelo Kanban pessoal
 * (publicar só acontece pela esteira/agendamento, que tem efeitos colaterais).
 * Se a demanda já está numa etapa que pertence à coluna de destino, mantém a etapa atual.
 */
export function etapaAoSoltarDemanda(atual: StatusConteudo, destino: StatusTarefa): StatusConteudo | null {
  if (destino === 'concluido') return null;
  if (colunaDaDemanda(atual) === destino) return atual;
  if (destino === 'a_fazer') return 'planejamento';
  if (destino === 'fazendo') return 'criacao_arte';
  return 'revisao_interna';
}

/** Campos derivados que acompanham uma troca de status de tarefa. */
export function camposDaTransicao(
  novo: StatusTarefa,
  atual: { iniciado_em: string | null } | null,
  agora: Date = new Date()
): Partial<Pick<TarefaRotina, 'concluido_em' | 'iniciado_em' | 'aguardando_de'>> {
  const iso = agora.toISOString();
  const campos: Partial<Pick<TarefaRotina, 'concluido_em' | 'iniciado_em' | 'aguardando_de'>> = {};
  campos.concluido_em = novo === 'concluido' ? iso : null;
  if ((novo === 'fazendo' || novo === 'concluido') && !atual?.iniciado_em) campos.iniciado_em = iso;
  if (novo !== 'aguardando') campos.aguardando_de = null;
  return campos;
}

/** Prazo (YYYY-MM-DD) já passou em relação a hoje? */
export function estaAtrasado(prazo: string | null, status: StatusTarefa, hoje: Date = new Date()): boolean {
  if (!prazo || status === 'concluido') return false;
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return prazo.slice(0, 10) < hojeStr;
}

/** Item concluído ainda deve aparecer na coluna "Concluído"? */
export function concluidoRecente(dataConclusao: string | null, hoje: Date = new Date()): boolean {
  if (!dataConclusao) return false;
  const limite = hoje.getTime() - DIAS_CONCLUIDO_VISIVEL * 24 * 60 * 60 * 1000;
  return new Date(dataConclusao).getTime() >= limite;
}

const PESO_PRIORIDADE: Record<string, number> = { urgente: 0, alta: 1, normal: 2, media: 2, baixa: 3 };

/** Ordena cards: atrasados primeiro, depois prioridade, depois prazo mais próximo. */
export function compararCards(
  a: { prazo: string | null; prioridade?: string | null; atrasado: boolean },
  b: { prazo: string | null; prioridade?: string | null; atrasado: boolean }
): number {
  if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
  const pa = PESO_PRIORIDADE[a.prioridade || 'normal'] ?? 2;
  const pb = PESO_PRIORIDADE[b.prioridade || 'normal'] ?? 2;
  if (pa !== pb) return pa - pb;
  if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
  if (a.prazo) return -1;
  if (b.prazo) return 1;
  return 0;
}

/** Soma de estimativas (min) formatada como "2h30" / "45min". */
export function formatarEstimativa(minutos: number): string {
  if (minutos <= 0) return '0min';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
