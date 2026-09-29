'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Item de controle segmentado no estilo HeroUI: a "pílula" do item ativo
 * desliza entre as opções com mola, em vez de trocar de repente.
 *
 * Itens do mesmo grupo compartilham o mesmo `group` (string única na tela).
 * O contêiner continua sendo o <div> que já existe em cada tela.
 */
export interface SegmentedItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  group: string;
  pillClassName?: string;
}

export function SegmentedItem({ active, group, className, pillClassName, children, type, ...props }: SegmentedItemProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-pressed={props.role ? undefined : active}
      className={cn(
        'relative isolate inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer',
        'transition-colors duration-150 select-none outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/40',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId={`seg-pill-${group}`}
          aria-hidden
          className={cn('absolute inset-0 -z-10 rounded-[inherit] bg-card border border-border shadow-xs', pillClassName)}
          transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
        />
      )}
      {children}
    </button>
  );
}
