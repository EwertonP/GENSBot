/** Etiquetas das demandas: paleta fixa (classes Tailwind completas, para o JIT enxergar). */

export interface Etiqueta {
  id: string;
  nome: string;
  cor: CorEtiqueta;
}

export const CORES_ETIQUETA = {
  slate: { rotulo: 'Cinza', chip: 'bg-muted text-foreground border-border', dot: 'bg-muted-foreground' },
  red: { rotulo: 'Vermelho', chip: 'bg-destructive-soft text-destructive border-destructive-ring', dot: 'bg-destructive' },
  amber: { rotulo: 'Amarelo', chip: 'bg-warning-soft text-warning border-warning-ring', dot: 'bg-warning' },
  green: { rotulo: 'Verde', chip: 'bg-success-soft text-success border-success-ring', dot: 'bg-success' },
  blue: { rotulo: 'Azul', chip: 'bg-info-soft text-info border-info-ring', dot: 'bg-info' },
  mint: { rotulo: 'Menta', chip: 'bg-brand-soft text-brand-text border-brand-ring', dot: 'bg-lime' },
} as const;

export type CorEtiqueta = keyof typeof CORES_ETIQUETA;

export const COR_PADRAO: CorEtiqueta = 'slate';

export function ehCorEtiqueta(v: unknown): v is CorEtiqueta {
  return typeof v === 'string' && v in CORES_ETIQUETA;
}

export function corDaEtiqueta(cor: string): (typeof CORES_ETIQUETA)[CorEtiqueta] {
  return ehCorEtiqueta(cor) ? CORES_ETIQUETA[cor] : CORES_ETIQUETA[COR_PADRAO];
}

/** Nome limpo ou nulo se vazio/longo demais. */
export function nomeEtiquetaValido(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().replace(/\s+/g, ' ');
  return n.length >= 1 && n.length <= 40 ? n : null;
}

/** Alterna um id na lista (marcar/desmarcar). */
export function alternarEtiqueta(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
