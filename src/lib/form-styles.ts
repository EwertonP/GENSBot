/**
 * Padrão de input/label dos formulários do app — extraído do form de
 * automações em src/app/page.tsx (ex: linhas 1694/1703), que já usava esse
 * tamanho mais generoso antes de nós existirem. Fonte única pra não
 * duplicar a string em cada componente novo.
 */
export const fieldInputClass =
  'w-full bg-card border border-border rounded-xl px-3.5 py-2 text-sm ' +
  'focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 ' +
  'text-foreground placeholder-muted-foreground shadow-2xs transition-all duration-150';

export const fieldLabelClass = 'text-xs font-semibold text-foreground/80 tracking-tight';
