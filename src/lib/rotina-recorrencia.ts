/**
 * Tarefas recorrentes da Rotina.
 *
 * Mesma regra de `private.recorrencia_ocorre_em` (migration 20260929_rotina_recorrente):
 * - semanal: dias da semana (0=domingo … 6=sábado);
 * - mensal: dia do mês (1–31); em mês mais curto cai no último dia.
 * Datas são strings AAAA-MM-DD no fuso de Brasília, sem hora.
 */

export type FrequenciaRecorrencia = 'semanal' | 'mensal';

export interface RegraRecorrencia {
  frequencia: FrequenciaRecorrencia;
  dias_semana: number[];
  dia_mes: number | null;
  inicio_em: string;
}

export interface TarefaRecorrente extends RegraRecorrencia {
  id: string;
  agencia_id: string;
  titulo: string;
  descricao: string | null;
  tipo: 'interno' | 'peca_avulsa';
  cliente_id: string | null;
  solicitante: string | null;
  responsavel_id: string | null;
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  estimativa_min: number | null;
  prazo_dias: number;
  ativo: boolean;
  ultima_geracao: string | null;
  criado_em: string;
  cliente?: { id: string; nome: string; cor: string | null } | null;
  responsavel?: { id: string; nome: string } | null;
}

export const DIAS_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const DIAS_UTEIS = [1, 2, 3, 4, 5];

function partes(dia: string): [number, number, number] {
  const [y, m, d] = dia.split('-').map(Number);
  return [y, m, d];
}

function formatar(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function ultimoDiaDoMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Hoje em Brasília, AAAA-MM-DD. */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

export function somarDias(dia: string, n: number): string {
  const [y, m, d] = partes(dia);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return formatar(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function ocorreEm(regra: RegraRecorrencia, dia: string): boolean {
  if (dia < regra.inicio_em) return false;
  const [y, m, d] = partes(dia);
  if (regra.frequencia === 'semanal') {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return regra.dias_semana.includes(dow);
  }
  if (regra.frequencia === 'mensal' && regra.dia_mes) {
    return d === Math.min(regra.dia_mes, ultimoDiaDoMes(y, m));
  }
  return false;
}

/** Próxima data (a partir de `desde`, inclusive) em que a regra gera tarefa. */
export function proximaOcorrencia(regra: RegraRecorrencia, desde: string): string | null {
  let dia = desde < regra.inicio_em ? regra.inicio_em : desde;
  for (let i = 0; i < 400; i++) {
    if (ocorreEm(regra, dia)) return dia;
    dia = somarDias(dia, 1);
  }
  return null;
}

/** "Toda seg, qua e sex" · "Todo dia útil" · "Todo dia 25 do mês". */
export function descreverRegra(regra: Pick<RegraRecorrencia, 'frequencia' | 'dias_semana' | 'dia_mes'>): string {
  if (regra.frequencia === 'mensal') return `Todo dia ${regra.dia_mes} do mês`;
  const dias = [...regra.dias_semana].sort((a, b) => a - b);
  if (dias.length === 7) return 'Todo dia';
  if (dias.join(',') === DIAS_UTEIS.join(',')) return 'Todo dia útil';
  const nomes = dias.map((d) => DIAS_SEMANA_CURTO[d]);
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0];
  return `Toda ${lista}`;
}

/** Valida e normaliza a regra vinda do cliente. */
export function validarRegra(entrada: {
  frequencia?: unknown;
  dias_semana?: unknown;
  dia_mes?: unknown;
}): { ok: true; frequencia: FrequenciaRecorrencia; dias_semana: number[]; dia_mes: number | null } | { ok: false; erro: string } {
  if (entrada.frequencia === 'semanal') {
    const dias = Array.isArray(entrada.dias_semana)
      ? [...new Set(entrada.dias_semana.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
      : [];
    if (dias.length === 0) return { ok: false, erro: 'Escolha pelo menos um dia da semana.' };
    return { ok: true, frequencia: 'semanal', dias_semana: dias, dia_mes: null };
  }
  if (entrada.frequencia === 'mensal') {
    const dia = Number(entrada.dia_mes);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { ok: false, erro: 'Dia do mês precisa ser de 1 a 31.' };
    return { ok: true, frequencia: 'mensal', dias_semana: [], dia_mes: dia };
  }
  return { ok: false, erro: 'Frequência deve ser semanal ou mensal.' };
}
