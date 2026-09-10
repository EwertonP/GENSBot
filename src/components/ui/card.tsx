import React from 'react';
import { cn } from '@/lib/utils';

const PADDING = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof PADDING;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', ...props }, ref) => (
    <div
      ref={ref}
      // Elevação vem de sombra por padrão (light mode) — borda só reaparece no
      // dark mode, onde sombra quase não se vê contra o fundo quase-preto
      // (a separação lá vem de variação de tom entre bg-background/bg-card).
      className={cn('bg-card rounded-lg shadow-sm dark:border dark:border-border', PADDING[padding], className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';
