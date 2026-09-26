'use client';

import React from 'react';
import { Menu } from '@base-ui/react/menu';
import { ArrowRightLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Mover para…" — troca a etapa de um card sem arrastar (teclado, toque,
 * leitor de tela). Complementa o drag-and-drop do kanban, que só funciona
 * com mouse.
 */
export function MoverEtapaMenu<T extends string>({
  etapas,
  atual,
  onMover,
  className,
}: {
  etapas: { status: T; label: string }[];
  atual: T;
  onMover: (status: T) => void;
  className?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Mover para outra etapa"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          'grid place-items-center size-7 rounded-lg border border-border-strong bg-card/95 text-muted-foreground shadow-xs backdrop-blur',
          'hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
          'data-popup-open:text-foreground data-popup-open:bg-accent',
          className
        )}
      >
        <ArrowRightLeft className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[80]">
          <Menu.Popup
            onClick={(e) => e.stopPropagation()}
            className="min-w-52 rounded-xl border border-border-strong bg-popover p-1 text-popover-foreground shadow-lg outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0"
          >
            <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Mover para</div>
            {etapas.map((e) => {
              const ehAtual = e.status === atual;
              return (
                <Menu.Item
                  key={e.status}
                  disabled={ehAtual}
                  onClick={() => onMover(e.status)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer outline-none data-highlighted:bg-accent data-disabled:cursor-default data-disabled:text-muted-foreground"
                >
                  <span className="flex-1">{e.label}</span>
                  {ehAtual && <Check aria-label="etapa atual" className="size-3.5" />}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
