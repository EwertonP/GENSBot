'use client';

import React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { cn } from '@/lib/utils';

/**
 * Tooltip acessível (substitui `title=`): aparece no hover E no foco do
 * teclado, é anunciado por leitor de tela e respeita o tema. Envolva um
 * único elemento interativo:
 *
 *   <Tip label="Recolher menu" shortcut="Ctrl+B"><button …/></Tip>
 *
 * Botão só de ícone ainda precisa de `aria-label` — o tooltip é reforço
 * visual, não o nome acessível.
 */
export function Tip({
  label,
  shortcut,
  side = 'top',
  disabled,
  children,
}: {
  label: React.ReactNode;
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  children: React.ReactElement;
}) {
  if (disabled) return children;
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-[80]">
          <BaseTooltip.Popup
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border-strong bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md',
              'origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-instant:duration-0'
            )}
          >
            {label}
            {shortcut && (
              <kbd className="rounded border border-border-strong bg-muted px-1 font-sans text-xs text-muted-foreground">{shortcut}</kbd>
            )}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export const TooltipProvider = BaseTooltip.Provider;
