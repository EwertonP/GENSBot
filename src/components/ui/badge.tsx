import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Padrão de status inspirado no Spectrum UI: fundo soft (10%) + texto no tom
// forte do tema (700-800 no claro / 300-400 no escuro) + ring de 30%. Todas as
// cores vêm dos tokens do globals.css — contraste do texto ≥4.5:1 nos dois temas.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        success: 'bg-success-soft text-success ring-success-ring',
        warning: 'bg-warning-soft text-warning ring-warning-ring',
        destructive: 'bg-destructive-soft text-destructive ring-destructive-ring',
        info: 'bg-info-soft text-info ring-info-ring',
        brand: 'bg-brand-soft text-brand-text ring-brand-ring',
        muted: 'bg-muted text-muted-foreground ring-border-strong',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ElementType;
  /** Ponto de status à esquerda (herda a cor do texto). */
  dot?: boolean;
}

export function Badge({ className, variant, icon: Icon, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {Icon && <Icon aria-hidden className="w-3 h-3" />}
      {children}
    </span>
  );
}
