'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface LineChartSeries {
  name: string;
  color: string; // valor CSS (var(--primary), var(--chart-2), etc.)
  points: { date: string; value: number }[];
}

export interface LineChartProps {
  series: LineChartSeries[];
  height?: number;
  emptyMessage?: string;
  className?: string;
}

const WIDTH = 600;
const PADDING_X = 8;
const PADDING_Y = 10;

/**
 * Gráfico de linha com tooltip no ponto (padrão "Corelystic" da Parte 2 do
 * PLANO_REDESIGN_2.0.md) — zero dependência nova, no mesmo espírito do
 * WeekBars que já existia. Suporta múltiplas séries plotadas juntas
 * (ex: alcance x visitas ao perfil).
 */
export function LineChart({ series, height = 160, emptyMessage = 'Sem dados para o período.', className }: LineChartProps) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const allDates = series[0]?.points.map((p) => p.date) || [];
  const hasData = allDates.length > 0 && series.some((s) => s.points.some((p) => p.value > 0));

  if (allDates.length === 0 || !hasData) {
    return (
      <div className={cn('flex items-center justify-center text-xs text-muted-foreground', className)} style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const stepX = allDates.length > 1 ? (WIDTH - PADDING_X * 2) / (allDates.length - 1) : 0;

  const toXY = (index: number, value: number) => {
    const x = PADDING_X + index * stepX;
    const y = height - PADDING_Y - (value / maxValue) * (height - PADDING_Y * 2);
    return { x, y };
  };

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const index = Math.round((relativeX - PADDING_X) / (stepX || 1));
    const clamped = Math.min(Math.max(index, 0), allDates.length - 1);
    const { x, y } = toXY(clamped, series[0]?.points[clamped]?.value ?? 0);
    setHover({ index: clamped, x, y });
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative w-full" style={{ height }}>
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          {series.map((s) => {
            const path = s.points
              .map((p, i) => {
                const { x, y } = toXY(i, p.value);
                return `${i === 0 ? 'M' : 'L'}${x},${y}`;
              })
              .join(' ');
            return <path key={s.name} d={path} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />;
          })}

          {hover &&
            series.map((s) => {
              const point = s.points[hover.index];
              if (!point) return null;
              const { x, y } = toXY(hover.index, point.value);
              return <circle key={s.name} cx={x} cy={y} r={3.5} fill={s.color} />;
            })}

          {hover && (
            <line x1={hover.x} y1={0} x2={hover.x} y2={height} stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />
          )}

          <rect
            x={0}
            y={0}
            width={WIDTH}
            height={height}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>

        {hover && (
          <div
            className="absolute z-10 pointer-events-none bg-card border border-border rounded-lg shadow-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap"
            style={{
              left: `${(hover.x / WIDTH) * 100}%`,
              top: 0,
              transform: `translate(${hover.x > WIDTH / 2 ? '-105%' : '5%'}, 0)`,
            }}
          >
            <p className="font-bold text-foreground mb-0.5">
              {new Date(allDates[hover.index]).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.name}: <span className="font-bold text-foreground tabular-nums">{s.points[hover.index]?.value ?? 0}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
