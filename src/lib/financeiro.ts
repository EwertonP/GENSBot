/**
 * Regras do Financeiro, sem tocar em banco nem em tela.
 *
 * Um "lançamento" é uma linha de receita ou despesa com vencimento e status de
 * pago. As mensalidades dos clientes entram no cálculo como lançamentos
 * virtuais (nascem de valor_mensal + dia_vencimento) até alguém marcá-las como
 * recebidas, quando passam a existir como linha real (origem = 'mensalidade').
 */

export type TipoLancamento = 'receita' | 'despesa';

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  pago: boolean;
  pago_em: string | null;
  categoria: string;
  origem: 'manual' | 'mensalidade';
  /** AAAA-MM-01 da mensalidade que este lançamento representa. */
  competencia: string | null;
  cliente_id: string | null;
  observacoes?: string | null;
  /** Só no cliente: lançamento calculado, ainda sem linha no banco. */
  virtual?: boolean;
}

export interface ClienteCobranca {
  id: string;
  nome: string;
  valor_mensal: number | null;
  dia_vencimento: number | null;
  ativo: boolean;
  /** Quando o cliente entrou (AAAA-MM-DD ou ISO). Sem isso, a mensalidade vale em qualquer mês. */
  desde?: string | null;
}

export const CATEGORIAS_RECEITA = [
  { id: 'mensalidade', label: 'Mensalidades' },
  { id: 'projeto', label: 'Projetos avulsos' },
  { id: 'comissao', label: 'Comissões' },
  { id: 'outros', label: 'Outras receitas' },
] as const;

export const CATEGORIAS_DESPESA = [
  { id: 'equipe', label: 'Equipe e freelancers' },
  { id: 'ferramentas', label: 'Ferramentas e assinaturas' },
  { id: 'impostos', label: 'Impostos' },
  { id: 'trafego', label: 'Anúncios e tráfego' },
  { id: 'estrutura', label: 'Estrutura' },
  { id: 'outros', label: 'Outras despesas' },
] as const;

export function rotuloCategoria(tipo: TipoLancamento, id: string): string {
  const lista = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  return lista.find((c) => c.id === id)?.label ?? 'Outros';
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-11" a partir de uma data. */
export function chaveMes(data: Date | string): string {
  const s = typeof data === 'string' ? data : data.toISOString();
  return s.slice(0, 7);
}

export function mesAtual(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

export function somarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function rotuloMes(mes: string, curto = false): string {
  const [a, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1] ?? '';
  return curto ? `${nome.slice(0, 3)} ${a}` : `${nome} de ${a}`;
}

function ultimoDia(mes: string): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

/** Vencimento da mensalidade no mês, respeitando meses curtos (dia 31 em fevereiro vira 28). */
export function vencimentoMensalidade(mes: string, dia: number | null): string {
  const d = Math.min(Math.max(dia ?? 5, 1), ultimoDia(mes));
  return `${mes}-${String(d).padStart(2, '0')}`;
}

/**
 * Mensalidades que ainda não têm linha real no mês. O id é estável
 * ("mensalidade:<cliente>:<mês>") para a lista não piscar entre renders.
 */
export function mensalidadesVirtuais(clientes: ClienteCobranca[], mes: string, reais: Lancamento[]): Lancamento[] {
  const jaTem = new Set(
    reais.filter((l) => l.origem === 'mensalidade' && l.competencia?.slice(0, 7) === mes).map((l) => l.cliente_id)
  );
  return clientes
    .filter((c) => c.ativo && (c.valor_mensal ?? 0) > 0 && !jaTem.has(c.id) && (!c.desde || mes >= c.desde.slice(0, 7)))
    .map((c) => ({
      id: `mensalidade:${c.id}:${mes}`,
      tipo: 'receita' as const,
      descricao: `Mensalidade: ${c.nome}`,
      valor: c.valor_mensal as number,
      vencimento: vencimentoMensalidade(mes, c.dia_vencimento),
      pago: false,
      pago_em: null,
      categoria: 'mensalidade',
      origem: 'mensalidade' as const,
      competencia: `${mes}-01`,
      cliente_id: c.id,
      virtual: true,
    }));
}

/** Lançamentos do mês: os reais por vencimento + as mensalidades virtuais, em ordem de data. */
export function lancamentosDoMes(reais: Lancamento[], clientes: ClienteCobranca[], mes: string): Lancamento[] {
  const doMes = reais.filter((l) => chaveMes(l.vencimento) === mes);
  return [...doMes, ...mensalidadesVirtuais(clientes, mes, reais)].sort((a, b) =>
    a.vencimento === b.vencimento ? a.descricao.localeCompare(b.descricao) : a.vencimento < b.vencimento ? -1 : 1
  );
}

export interface ResumoMes {
  receitas: number;
  despesas: number;
  resultado: number;
  recebido: number;
  faltaReceber: number;
  pago: number;
  faltaPagar: number;
  atrasados: number;
}

const arred = (n: number) => Math.round(n * 100) / 100;

export function resumirMes(lancs: Lancamento[], hoje: string): ResumoMes {
  let receitas = 0, despesas = 0, recebido = 0, pago = 0, atrasados = 0;
  for (const l of lancs) {
    if (l.tipo === 'receita') {
      receitas += l.valor;
      if (l.pago) recebido += l.valor;
    } else {
      despesas += l.valor;
      if (l.pago) pago += l.valor;
    }
    if (!l.pago && l.vencimento < hoje) atrasados += 1;
  }
  return {
    receitas: arred(receitas),
    despesas: arred(despesas),
    resultado: arred(receitas - despesas),
    recebido: arred(recebido),
    faltaReceber: arred(receitas - recebido),
    pago: arred(pago),
    faltaPagar: arred(despesas - pago),
    atrasados,
  };
}

export interface PontoSerie {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
  /** Mês que ainda não terminou: inclui o que está previsto. */
  projecao: boolean;
}

/** Série de meses consecutivos; meses a partir do atual são marcados como projeção. */
export function serieMensal(reais: Lancamento[], clientes: ClienteCobranca[], de: string, quantidade: number, hoje: Date = new Date()): PontoSerie[] {
  const atual = mesAtual(hoje);
  const hojeStr = hoje.toISOString().slice(0, 10);
  return Array.from({ length: quantidade }, (_, i) => {
    const mes = somarMeses(de, i);
    const r = resumirMes(lancamentosDoMes(reais, clientes, mes), hojeStr);
    return { mes, receitas: r.receitas, despesas: r.despesas, saldo: r.resultado, projecao: mes >= atual };
  });
}

export function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Aceita "1.500,50", "1500.5" ou "1500". Devolve null se não for um valor positivo. */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
