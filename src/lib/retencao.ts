/**
 * Retenção das demandas publicadas: o texto fica disponível no link do mês
 * (aba Publicados) por um prazo e depois a demanda é excluída de vez.
 * A mídia já é apagada do armazenamento no momento da publicação.
 */
export const RETENCAO_TEXTO_PADRAO_DIAS = 30;
export const RETENCAO_TEXTO_MIN_DIAS = 7;
export const RETENCAO_TEXTO_MAX_DIAS = 365;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Prazo em dias para o cliente: o valor salvo (7 a 365) ou o padrão. */
export function diasRetencaoTexto(valor: number | null | undefined): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return RETENCAO_TEXTO_PADRAO_DIAS;
  const inteiro = Math.round(valor);
  if (inteiro < RETENCAO_TEXTO_MIN_DIAS || inteiro > RETENCAO_TEXTO_MAX_DIAS) return RETENCAO_TEXTO_PADRAO_DIAS;
  return inteiro;
}

/** Data (ISO) em que o texto sai do ar, ou null se não houver publicação. */
export function dataLimiteTexto(publicadoEm: string | null | undefined, dias: number): string | null {
  if (!publicadoEm) return null;
  const t = new Date(publicadoEm).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + dias * DIA_MS).toISOString();
}

/** A demanda publicada já passou do prazo e pode ser excluída? */
export function vencidaParaExcluir(publicadoEm: string | null | undefined, dias: number, agora: Date = new Date()): boolean {
  const limite = dataLimiteTexto(publicadoEm, dias);
  return !!limite && new Date(limite).getTime() <= agora.getTime();
}
