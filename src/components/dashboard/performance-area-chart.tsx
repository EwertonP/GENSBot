'use client';

import React, { useState } from 'react';
import { Calendar, Eye, Users, TrendingUp, Sparkles } from 'lucide-react';

export interface DailyDataPoint {
  date: string;
  metricA: number; // ex: Alcance
  metricB: number; // ex: Visitas ou Engajamento
}

interface PerformanceAreaChartProps {
  data?: DailyDataPoint[];
  title?: string;
  subtitle?: string;
  labelA?: string;
  labelB?: string;
  period?: '7d' | '30d' | '90d' | '12m';
  onPeriodChange?: (period: '7d' | '30d' | '90d' | '12m') => void;
  loading?: boolean;
}

export function PerformanceAreaChart({
  data,
  title = 'Evolução de Audiência & Conversões',
  subtitle = 'Alcance diário e interações registradas no período',
  labelA = 'Alcance Diário',
  labelB = 'Visitas ao Perfil',
  period = '30d',
  onPeriodChange,
  loading = false,
}: PerformanceAreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Dados mock demonstrativos caso a conta ainda não tenha devolvido dados
  const defaultData: DailyDataPoint[] = [
    { date: '01/10', metricA: 3200, metricB: 420 },
    { date: '05/10', metricA: 4100, metricB: 580 },
    { date: '10/10', metricA: 3800, metricB: 510 },
    { date: '15/10', metricA: 5900, metricB: 890 },
    { date: '20/10', metricA: 7200, metricB: 1120 },
    { date: '25/10', metricA: 6800, metricB: 980 },
    { date: '30/10', metricA: 9400, metricB: 1450 },
    { date: '05/11', metricA: 11200, metricB: 1780 },
  ];

  const pointsData = data && data.length > 0 ? data : defaultData;

  const width = 800;
  const height = 240;
  const paddingX = 24;
  const paddingY = 28;

  const maxA = Math.max(1, ...pointsData.map((d) => d.metricA));
  const maxB = Math.max(1, ...pointsData.map((d) => d.metricB));
  const overallMax = Math.max(maxA, maxB * 4, 100);

  const stepX = pointsData.length > 1 ? (width - paddingX * 2) / (pointsData.length - 1) : 0;

  const pointsA = pointsData.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = height - paddingY - (d.metricA / overallMax) * (height - paddingY * 2);
    return { x, y, ...d };
  });

  const pointsB = pointsData.map((d, i) => {
    const x = paddingX + i * stepX;
    // Multiplicador visual para a métrica B aparecer proporcionalmente na mesma escala
    const scaledVal = d.metricB * 4;
    const y = height - paddingY - (scaledVal / overallMax) * (height - paddingY * 2);
    return { x, y, ...d };
  });

  // Catmull-Rom / Spline generator
  const createSplinePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const lineA = createSplinePath(pointsA);
  const areaA = `${lineA} L ${pointsA[pointsA.length - 1]?.x} ${height - paddingY} L ${pointsA[0]?.x} ${height - paddingY} Z`;

  const lineB = createSplinePath(pointsB);

  const hoveredPoint = hoverIndex !== null ? pointsData[hoverIndex] : null;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs flex flex-col gap-6">
      {/* Cabeçalho do Gráfico com Filtros de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold font-display text-foreground tracking-tight">
              {title}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-brand-text">
              <Sparkles className="w-3 h-3" /> Ao Vivo
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        {/* Legenda e Alternador de Período */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00DC94]" />
              <span className="text-muted-foreground">{labelA}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#018B61]" />
              <span className="text-muted-foreground">{labelB}</span>
            </div>
          </div>

          {onPeriodChange && (
            <div className="flex items-center p-1 bg-secondary rounded-full border border-border">
              {(['7d', '30d', '90d', '12m'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPeriodChange(p)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                    period === p
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Área do Gráfico SVG */}
      <div className="relative w-full h-64 select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xPos = ((e.clientX - rect.left) / rect.width) * width;
            const idx = Math.min(
              Math.max(Math.round((xPos - paddingX) / (stepX || 1)), 0),
              pointsData.length - 1
            );
            setHoverIndex(idx);
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="chartGradientA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00DC94" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00DC94" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartGradientB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#018B61" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#018B61" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = paddingY + pct * (height - paddingY * 2);
            return (
              <line
                key={i}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Áreas preenchidas */}
          <path d={areaA} fill="url(#chartGradientA)" />

          {/* Linhas principais */}
          <path
            d={lineA}
            fill="none"
            stroke="#00DC94"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={lineB}
            fill="none"
            stroke="#018B61"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 4"
          />

          {/* Linha vertical e pontos no hover */}
          {hoverIndex !== null && pointsA[hoverIndex] && (
            <>
              <line
                x1={pointsA[hoverIndex].x}
                y1={paddingY}
                x2={pointsA[hoverIndex].x}
                y2={height - paddingY}
                stroke="#00DC94"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={pointsA[hoverIndex].x}
                cy={pointsA[hoverIndex].y}
                r="6"
                fill="#00DC94"
                className="stroke-card stroke-2"
              />
              <circle
                cx={pointsB[hoverIndex].x}
                cy={pointsB[hoverIndex].y}
                r="5"
                fill="#018B61"
                className="stroke-card stroke-2"
              />
            </>
          )}

          {/* Datas no eixo X */}
          {pointsData.map((d, i) => {
            const x = paddingX + i * stepX;
            return (
              <text
                key={i}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-medium"
              >
                {d.date}
              </text>
            );
          })}
        </svg>

        {/* Tooltip flutuante HTML */}
        {hoverIndex !== null && hoveredPoint && pointsA[hoverIndex] && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 bg-popover text-popover-foreground border border-border px-3 py-2 rounded-xl shadow-lg flex flex-col gap-1 z-20 text-xs min-w-[130px]"
            style={{
              left: `${(pointsA[hoverIndex].x / width) * 100}%`,
              top: '10px',
            }}
          >
            <span className="text-[11px] font-semibold text-muted-foreground border-b border-border pb-1">
              Data: {hoveredPoint.date}
            </span>
            <div className="flex items-center justify-between gap-3 text-brand-text font-bold">
              <span>{labelA}:</span>
              <span>{hoveredPoint.metricA.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>{labelB}:</span>
              <span>{hoveredPoint.metricB.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
