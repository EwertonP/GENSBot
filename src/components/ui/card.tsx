import React from 'react';
import { cn } from '@/lib/utils';

const PADDING = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof PADDING;
  /** Hover-lift (leve elevação + sombra mais forte) — só pra cards clicáveis
   * de verdade (ex: item de board, item de lista). Não é o padrão porque um
   * card estático "levantando" ao passar o mouse sugere clicabilidade que
   * não existe (anti-padrão de affordance). */
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-card rounded-2xl border border-border shadow-2xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-150',
        interactive && 'cursor-pointer hover:border-foreground/20 hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0',
        PADDING[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';
