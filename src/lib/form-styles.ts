/**
 * Padrão de input/label dos formulários do app — extraído do form de
 * automações em src/app/page.tsx (ex: linhas 1694/1703), que já usava esse
 * tamanho mais generoso antes de nós existirem. Fonte única pra não
 * duplicar a string em cada componente novo.
 */
export const fieldInputClass =
  'w-full bg-card border border-input rounded-xl px-3.5 py-2 text-sm ' +
  'focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 ' +
  'text-foreground placeholder:text-muted-foreground shadow-2xs transition-[border-color,box-shadow] duration-150 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-destructive/20';

export const fieldLabelClass = 'text-label font-medium text-foreground';
