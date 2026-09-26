import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Bloco de carregamento com o formato do conteúdo que vai chegar — evita o
 * "salto" de layout e dá noção de estrutura, ao contrário de um spinner
 * solto. Com prefers-reduced-motion o pulso vira estático (globals.css).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-muted', className)} {...props} />;
}

/** Linhas de lista/tabela carregando. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${70 - ((i * 13) % 30)}%` }} />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
