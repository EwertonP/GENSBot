import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Grupo de botões que nunca fica torto. No celular: 1 botão ocupa a linha,
 * 2 botões dividem a linha em partes iguais e 3 ou mais empilham, todos com a
 * mesma largura e a mesma altura (48px). No desktop: fila alinhada à direita,
 * com a largura natural de cada botão.
 *
 * `sticky` gruda a barra no rodapé do painel (folhas e formulários), com
 * respeito à área segura do aparelho.
 */
export function ActionBar({ children, sticky, className }: { children: React.ReactNode; sticky?: boolean; className?: string }) {
  const n = React.Children.toArray(children).filter(Boolean).length;
  return (
    <div
      className={cn(
        'grid gap-2 md:flex md:items-center md:justify-end',
        n === 2 ? 'grid-cols-2' : 'grid-cols-1',
        'max-md:[&>*]:h-12 max-md:[&>*]:w-full',
        sticky && 'sticky bottom-0 z-10 border-t border-border bg-card/95 p-3 backdrop-blur max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
