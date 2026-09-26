import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

/**
 * KPI no padrão "Stat Cards" (Spectrum UI): rótulo, valor grande, uma frase
 * que diz o que o número significa (nunca um delta inventado) e, quando há
 * série real, um minigráfico ao lado.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  sentence,
  sentenceTone = 'muted',
  series,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  sentence?: React.ReactNode;
  sentenceTone?: 'muted' | 'success' | 'destructive';
  /** Pontos reais (ex.: alcance diário). Com menos de 2 pontos, não desenha. */
  series?: number[];
  className?: string;
}) {
  const temSerie = !!series && series.length >= 2 && series.some((v) => v > 0);
  return (
    <Card className={cn('p-5 rounded-2xl flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon aria-hidden className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="shrink-0 text-display font-semibold font-display text-foreground tabular-nums leading-none">{value}</span>
        {temSerie && <Sparkline values={series!} className="h-9 min-w-10 max-w-24 flex-1" />}
      </div>
      {sentence && (
        <p
          className={cn(
            'text-xs',
            sentenceTone === 'success' ? 'text-success font-medium' : sentenceTone === 'destructive' ? 'text-destructive font-medium' : 'text-muted-foreground'
          )}
        >
          {sentence}
        </p>
      )}
    </Card>
  );
}

/** Minigráfico de linha (sem eixos) — só tendência, o número fica ao lado. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 96;
  const h = 36;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / range) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className={className}>
      <path d={area} fill="var(--chart-1)" fillOpacity={0.12} />
      <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
