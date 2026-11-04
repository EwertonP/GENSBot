import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Ícone do módulo, mostrado em destaque ao lado do título. */
  icon?: React.ElementType;
  title: string;
  description?: string;
  /** Botões da tela (ficam à direita; no celular descem para uma linha própria). */
  actions?: React.ReactNode;
  as?: 'h1' | 'h2';
  className?: string;
}

/**
 * Cabeçalho de página: título grande e leve (light) com o ícone do módulo,
 * descrição curta embaixo e as ações da tela à direita. Fonte única da
 * hierarquia de topo, no mesmo tamanho em todas as telas.
 */
export function PageHeader({ icon: Icon, title, description, actions, as: Tag = 'h1', className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4', className)}>
      <div className="min-w-0">
        <Tag className="flex items-center gap-2.5 font-display text-[2rem] sm:text-4xl font-light leading-[1.05] tracking-[-0.025em] text-foreground">
          {Icon && <Icon aria-hidden className="size-5 shrink-0 text-lime" strokeWidth={1.5} />}
          <span className="min-w-0 text-balance">{title}</span>
        </Tag>
        {description && <p className="mt-2 max-sm:hidden max-w-prose text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
