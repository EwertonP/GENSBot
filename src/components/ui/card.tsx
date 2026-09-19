import React from 'react';
import { cn } from '@/lib/utils';

const PADDING = {
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
      // Borda de 1px + sombra dura, como o card do site da agência: as duas
      // juntas, não uma ou outra. A sombra não tem blur — é o gesto de marca.
      className={cn(
        'bg-card rounded-lg border border-border shadow-sm transition-all duration-150',
        interactive && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        PADDING[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';
