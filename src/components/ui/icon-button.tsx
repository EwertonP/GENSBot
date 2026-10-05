'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Tip } from './tooltip';

/**
 * Botão só de ícone com nome acessível e tooltip embutidos. A área de toque é
 * 40px no celular e 32px a partir de `sm`, onde o ponteiro é preciso.
 *
 *   <IconButton label="Editar" onClick={…}><Pencil /></IconButton>
 *
 * O `label` vira `aria-label` e o texto do `Tip`; o ícone filho ganha 16px.
 */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  tone?: 'default' | 'destructive';
  /** Esconde o tooltip quando o rótulo já aparece por perto. */
  semTip?: boolean;
  tipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tone = 'default', semTip, tipSide, className, children, type = 'button', ...props }, ref) => {
    const botao = (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          'inline-flex size-10 sm:size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors cursor-pointer [&_svg]:size-4',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none',
          tone === 'destructive' ? 'hover:bg-destructive-soft hover:text-destructive' : 'hover:bg-accent hover:text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
    return semTip ? botao : <Tip label={label} side={tipSide}>{botao}</Tip>;
  }
);
IconButton.displayName = 'IconButton';
