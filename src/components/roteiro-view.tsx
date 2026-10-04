import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Roteiro/briefing da demanda em modo leitura. Entende o pouco de markdown
 * que os roteiros usam: `## Seção` (Fala, Texto na tela, Produção visual),
 * `**Cena 1**` sozinho na linha como rótulo, `**negrito**` no meio do texto
 * e listas com `•` ou `-`. Renderiza só texto, sem HTML cru.
 */
function comNegrito(texto: string): React.ReactNode[] {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((parte, i) =>
      /^\*\*[^*]+\*\*$/.test(parte) ? (
        <strong key={i} className="font-semibold">
          {parte.slice(2, -2)}
        </strong>
      ) : (
        parte
      )
    );
}

export function RoteiroView({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground', className)}>
      {texto.split('\n').map((linha, i) => {
        const t = linha.trim();
        if (!t) return <div key={i} aria-hidden className="h-2" />;

        const secao = t.match(/^#{1,6}\s+(.*)$/);
        if (secao) {
          return (
            <h3
              key={i}
              className="font-display text-sm font-semibold text-foreground mt-4 first:mt-0 pb-1.5 mb-1 border-b border-border"
            >
              {comNegrito(secao[1])}
            </h3>
          );
        }

        const rotulo = t.match(/^\*\*([^*]+)\*\*$/);
        if (rotulo) {
          return (
            <p key={i} className="mt-2 text-label font-semibold text-muted-foreground tabular-nums">
              {rotulo[1]}
            </p>
          );
        }

        const item = t.match(/^[•-]\s+(.*)$/);
        if (item) {
          return (
            <p key={i} className="flex gap-2 break-words">
              <span aria-hidden className="text-muted-foreground">•</span>
              <span>{comNegrito(item[1])}</span>
            </p>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            {comNegrito(linha)}
          </p>
        );
      })}
    </div>
  );
}
