import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, type ContextoAgencia } from '@/lib/clientes-server';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, type TipoLancamento } from '@/lib/financeiro';

/** Financeiro é só do master da agência. */
export async function contextoFinanceiro(): Promise<{ ok: true; ctx: ContextoAgencia } | { ok: false; response: NextResponse }> {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth;
  if (auth.ctx.membro.papel !== 'master') {
    return { ok: false, response: respostaErro('O Financeiro é restrito à administração da agência.', 403) };
  }
  return auth;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function mesValido(v: unknown): v is string {
  return typeof v === 'string' && MES_RE.test(v);
}

function dataValida(v: unknown): v is string {
  if (typeof v !== 'string' || !DATA_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export interface CamposLancamento {
  tipo?: TipoLancamento;
  descricao?: string;
  valor?: number;
  vencimento?: string;
  categoria?: string;
  pago?: boolean;
  pago_em?: string | null;
  cliente_id?: string | null;
  observacoes?: string | null;
}

/**
 * Valida o corpo de criação (completo) ou edição (parcial). Devolve só os
 * campos conhecidos, já limpos, ou a mensagem do primeiro erro.
 */
export function validarLancamento(corpo: unknown, parcial: boolean): { ok: true; campos: CamposLancamento } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Corpo inválido.' };
  const b = corpo as Record<string, unknown>;
  const c: CamposLancamento = {};

  if (b.tipo !== undefined || !parcial) {
    if (b.tipo !== 'receita' && b.tipo !== 'despesa') return { ok: false, erro: 'Escolha receita ou despesa.' };
    c.tipo = b.tipo;
  }
  if (b.descricao !== undefined || !parcial) {
    const d = typeof b.descricao === 'string' ? b.descricao.trim() : '';
    if (!d) return { ok: false, erro: 'Descreva o lançamento.' };
    if (d.length > 160) return { ok: false, erro: 'A descrição passou de 160 caracteres.' };
    c.descricao = d;
  }
  if (b.valor !== undefined || !parcial) {
    if (typeof b.valor !== 'number' || !Number.isFinite(b.valor) || b.valor <= 0 || b.valor > 99_999_999.99) {
      return { ok: false, erro: 'Informe um valor maior que zero.' };
    }
    c.valor = Math.round(b.valor * 100) / 100;
  }
  if (b.vencimento !== undefined || !parcial) {
    if (!dataValida(b.vencimento)) return { ok: false, erro: 'Data de vencimento inválida.' };
    c.vencimento = b.vencimento;
  }
  if (b.categoria !== undefined) {
    const tipo = c.tipo ?? (b.tipo as TipoLancamento | undefined);
    const lista = tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;
    if (typeof b.categoria !== 'string' || (tipo && !lista.some((x) => x.id === b.categoria))) {
      return { ok: false, erro: 'Categoria inválida.' };
    }
    c.categoria = b.categoria;
  }
  if (b.pago !== undefined) {
    if (typeof b.pago !== 'boolean') return { ok: false, erro: 'Status inválido.' };
    c.pago = b.pago;
    if (b.pago) {
      if (b.pago_em !== undefined && b.pago_em !== null && !dataValida(b.pago_em)) return { ok: false, erro: 'Data de pagamento inválida.' };
      c.pago_em = (b.pago_em as string | null | undefined) ?? new Date().toISOString().slice(0, 10);
    } else {
      c.pago_em = null;
    }
  }
  if (b.cliente_id !== undefined) {
    if (b.cliente_id !== null && (typeof b.cliente_id !== 'string' || !UUID_RE.test(b.cliente_id))) return { ok: false, erro: 'Cliente inválido.' };
    c.cliente_id = b.cliente_id as string | null;
  }
  if (b.observacoes !== undefined) {
    if (b.observacoes !== null && typeof b.observacoes !== 'string') return { ok: false, erro: 'Observações inválidas.' };
    c.observacoes = b.observacoes ? String(b.observacoes).slice(0, 1000) : null;
  }
  return { ok: true, campos: c };
}
