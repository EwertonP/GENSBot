'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  MessageCircle,
  Sparkles,
  Layers,
  Globe,
  ArrowUpRight,
} from 'lucide-react';

export interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  delta?: {
    percent: number;
    isPositive: boolean;
    periodLabel?: string;
  };
  icon?: React.ReactNode;
  sparkline?: number[];
  badge?: string;
  sublabel?: string;
  highlight?: boolean;
}

interface ExecutiveKPIGridProps {
  cards?: KPICardData[];
  loading?: boolean;
}

function MiniSparkline({ data, isPositive = true }: { data?: number[]; isPositive?: boolean }) {
  if (!data || data.length < 2) return null;

  const width = 110;
  const height = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const path = `M ${points.join(' L ')}`;
  const strokeColor = isPositive ? '#00DC94' : '#FF8A70';

  return (
    <svg width={width} height={height} className="overflow-visible select-none">
      <defs>
        <linearGradient id={`grad-${isPositive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${width},${height} L 0,${height} Z`}
        fill={`url(#grad-${isPositive ? 'pos' : 'neg'})`}
      />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExecutiveKPIGrid({ cards, loading = false }: ExecutiveKPIGridProps) {
  const defaultCards: KPICardData[] = [
    {
      id: 'alcance',
      label: 'Alcance Único',
      value: '142.850',
      delta: { percent: 24.8, isPositive: true, periodLabel: 'vs. mês anterior' },
      icon: <Eye className="w-4 h-4 text-primary" />,
      sparkline: [22, 28, 35, 42, 38, 55, 68, 85],
      sublabel: 'Pessoas impactadas na campanha',
      highlight: true,
    },
    {
      id: 'engajamento',
      label: 'Contas Engajadas',
      value: '18.420',
      delta: { percent: 14.2, isPositive: true, periodLabel: 'vs. mês anterior' },
      icon: <Users className="w-4 h-4 text-primary" />,
      sparkline: [12, 15, 14, 18, 22, 20, 26, 31],
      sublabel: 'Comentários, DMs e curtidas',
    },
    {
      id: 'leads',
      label: 'Oportunidades & Leads',
      value: '384',
      delta: { percent: 32.5, isPositive: true, periodLabel: 'vs. mês anterior' },
      icon: <Sparkles className="w-4 h-4 text-lime" />,
      sparkline: [3, 8, 12, 19, 15, 24, 30, 42],
      sublabel: 'Gerados via Direct & Formulários',
    },
    {
      id: 'entregas',
      label: 'Ativos Produzidos',
      value: '36',
      badge: '100% da Meta',
      icon: <Layers className="w-4 h-4 text-primary" />,
      sublabel: 'Reels, Carrosséis e Stories no ar',
    },
    {
      id: 'blog',
      label: 'Artigos no Blog (SEO)',
      value: '8',
      delta: { percent: 100, isPositive: true, periodLabel: 'Publicados no Cloudflare CMS' },
      icon: <Globe className="w-4 h-4 text-primary" />,
      sublabel: 'Indexados e gerando autoridade',
    },
  ];

  const items = cards && cards.length > 0 ? cards : defaultCards;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {items.map((card) => {
        const isHighlight = card.highlight;
        return (
          <div
            key={card.id}
            className={`relative overflow-hidden rounded-3xl border transition-all duration-200 p-5 flex flex-col justify-between gap-4 group ${
              isHighlight
                ? 'bg-gradient-to-br from-card via-card to-primary/10 border-primary/30 shadow-sm'
                : 'bg-card border-border shadow-2xs hover:border-border-strong hover:shadow-sm'
            }`}
          >
            {/* Topo do card: Rótulo e Ícone */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                {card.label}
              </span>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                {card.icon}
              </div>
            </div>

            {/* Valor Principal & Delta */}
            <div className="flex flex-col gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
                {card.value}
              </div>

              {card.delta && (
                <div className="flex items-center gap-1.5 text-xs font-medium flex-wrap">
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                      card.delta.isPositive
                        ? 'bg-success-soft text-success'
                        : 'bg-destructive-soft text-destructive'
                    }`}
                  >
                    {card.delta.isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {card.delta.isPositive ? '+' : ''}
                    {card.delta.percent}%
                  </span>
                  {card.delta.periodLabel && (
                    <span className="text-muted-foreground text-[11px]">
                      {card.delta.periodLabel}
                    </span>
                  )}
                </div>
              )}

              {card.badge && !card.delta && (
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text">
                  <span>●</span> {card.badge}
                </div>
              )}
            </div>

            {/* Rodapé do card: Sparkline ou Sublabel */}
            <div className="flex items-end justify-between gap-2 pt-2 border-t border-border/50">
              {card.sublabel && (
                <span className="text-[11px] text-muted-foreground truncate leading-tight">
                  {card.sublabel}
                </span>
              )}
              {card.sparkline && (
                <div className="shrink-0">
                  <MiniSparkline
                    data={card.sparkline}
                    isPositive={card.delta ? card.delta.isPositive : true}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
