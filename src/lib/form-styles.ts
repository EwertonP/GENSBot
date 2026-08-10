/**
 * Padrão de input/label dos formulários do app — extraído do form de
 * automações em src/app/page.tsx (ex: linhas 1694/1703), que já usava esse
 * tamanho mais generoso antes de nós existirem. Fonte única pra não
 * duplicar a string em cada componente novo.
 */
export const fieldInputClass =
  'w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm ' +
  'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ' +
  'text-foreground placeholder-muted-foreground transition-all';

export const fieldLabelClass = 'text-xs font-bold text-muted-foreground';
