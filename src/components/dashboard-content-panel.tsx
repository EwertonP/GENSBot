'use client';

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Video, Clapperboard, TrendingUp, Percent, ExternalLink, MoreHorizontal, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface SparklinePoint {
  date: string;
  value: number;
}

interface ContentPerformance {
  summary: {
    posts: number;
    reels: number;
    stories: number;
    reachTotal: number;
    engagementRate: number;
    postsSparkline: SparklinePoint[];
    reelsSparkline: SparklinePoint[];
    storiesSparkline: SparklinePoint[];
    reachSparkline: SparklinePoint[];
  };
  topPublications: {
    id: string;
    media_type: string;
    media_url: string;
    media_count: number;
    caption: string | null;
    published_at: string;
    reach: number;
    interactions: number;
  }[];
  topStories: {
    id: string;
    media_url: string;
    published_at: string;
    reach: number;
  }[];
  linkClicks: { bio: number; dm: number };
}

const PERIOD_OPTIONS: { value: 7 | 30 | 90; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

/** Sparkline com gradiente suave — padrão Linear/Vercel */
function Sparkline({ points, strokeColor = 'var(--primary)' }: { points: SparklinePoint[]; strokeColor?: string }) {
  if (points.length === 0 || points.every((p) => p.value === 0)) {
    return <div className="h-9 w-full bg-accent/20 rounded-md mt-1" />;
  }
  const max = Math.max(1, ...points.map((p) => p.value));
  const width = 120;
  const height = 36;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - 4 - ((p.value / max) * (height - 8))}`)
    .join(' ');

  const fillPath = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-9 overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--lime)" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#sparkline-grad)" />
      <path d={path} fill="none" stroke={strokeColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiCard({ icon: Icon, label, value, sparkline }: { icon: React.ElementType; label: string; value: string | number; sparkline: SparklinePoint[] }) {
  return (
    <Card padding="sm" className="flex flex-col justify-between gap-2 rounded-2xl p-4 border border-border/80 hover:border-foreground/20 shadow-2xs hover:shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="w-6 h-6 rounded-md bg-accent/60 flex items-center justify-center text-muted-foreground">
          <Icon className="w-3 h-3" />
        </div>
      </div>
      <span className="text-2xl font-bold font-display text-foreground tabular-nums tracking-tight mt-1">{value}</span>
      <Sparkline points={sparkline} />
    </Card>
  );
}

/** Card de mídia com menu "⋯" */
function MediaCard({
  mediaUrl,
  mediaCountBadge,
  primaryStat,
  secondaryStat,
  dateLabel,
}: {
  mediaUrl: string;
  mediaCountBadge?: number;
  primaryStat: string;
  secondaryStat: string;
  dateLabel: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative shrink-0 w-44 rounded-2xl border border-border/80 hover:border-foreground/30 bg-card overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-200">
      <div className="relative w-full aspect-square bg-accent overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL do próprio Storage */}
        <img src={mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {mediaCountBadge && mediaCountBadge > 1 && (
          <span className="absolute top-2 right-2 bg-foreground/80 backdrop-blur-md text-background text-[10px] font-bold px-2 py-0.5 rounded-full">
            {mediaCountBadge}
          </span>
        )}
        <div className="absolute top-2 left-2">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded-full bg-foreground/60 text-background hover:bg-foreground transition-all cursor-pointer backdrop-blur-md"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 z-20 w-32 animate-in fade-in zoom-in-95 duration-150">
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-all"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground" /> Abrir mídia
              </a>
            </div>
          )}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-0.5">
        <p className="text-xs font-bold font-display text-foreground tabular-nums">{primaryStat}</p>
        <p className="text-[11px] text-muted-foreground font-medium">{secondaryStat}</p>
        <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{dateLabel}</p>
      </div>
    </div>
  );
}

interface DashboardContentPanelProps {
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}

export default function DashboardContentPanel({ selectedAccountId, withAccount }: DashboardContentPanelProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ContentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErro(false);
    fetch(withAccount(`/api/dashboard/content-performance?period=${period}`))
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok || !result?.summary) throw new Error(result?.error || 'Resposta inválida');
        setData(result);
      })
      .catch(() => {
        setData(null);
        setErro(true);
      })
      .finally(() => setLoading(false));
  }, [selectedAccountId, period]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-6">
        <div>
          <h4 className="font-bold font-display text-foreground text-base tracking-tight">Desempenho de Conteúdo</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Publicações, alcance e engajamento orgânico</p>
        </div>
        <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70 self-start sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === opt.value
                  ? 'bg-card text-foreground shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : erro || !data ? (
        <div className="p-6 rounded-2xl bg-accent/20 border border-dashed border-border/80 text-center text-xs text-muted-foreground">
          Não foi possível carregar o desempenho de conteúdo no momento.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard icon={ImageIcon} label="Posts" value={data.summary.posts} sparkline={data.summary.postsSparkline} />
            <KpiCard icon={Clapperboard} label="Reels" value={data.summary.reels} sparkline={data.summary.reelsSparkline} />
            <KpiCard icon={Video} label="Stories" value={data.summary.stories} sparkline={data.summary.storiesSparkline} />
            <KpiCard icon={TrendingUp} label="Alcance total" value={data.summary.reachTotal.toLocaleString('pt-BR')} sparkline={data.summary.reachSparkline} />
            <KpiCard icon={Percent} label="Taxa de Engajamento" value={`${data.summary.engagementRate}%`} sparkline={[]} />
          </div>

          <Card padding="lg" className="rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold font-display text-foreground text-sm tracking-tight">Top Publicações</h4>
              <span className="text-[11px] text-muted-foreground font-medium">Ordenado por alcance</span>
            </div>
            {data.topPublications.length === 0 ? (
              <EmptyState icon={ImageIcon} title="Nenhuma publicação com dados de alcance neste período." />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
                {data.topPublications.map((pub) => (
                  <MediaCard
                    key={pub.id}
                    mediaUrl={pub.media_url}
                    mediaCountBadge={pub.media_count}
                    primaryStat={`${pub.reach.toLocaleString('pt-BR')} alcance`}
                    secondaryStat={`${pub.interactions} interações`}
                    dateLabel={new Date(pub.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="lg" className="rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold font-display text-foreground text-sm tracking-tight">Stories em Destaque</h4>
              <span className="text-[11px] text-muted-foreground font-medium">Últimas 24h</span>
            </div>
            {data.topStories.length === 0 ? (
              <EmptyState icon={Video} title="Nenhum story com dados de alcance neste período." />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
                {data.topStories.map((story) => (
                  <MediaCard
                    key={story.id}
                    mediaUrl={story.media_url}
                    primaryStat={`${story.reach.toLocaleString('pt-BR')} alcance`}
                    secondaryStat="Story"
                    dateLabel={new Date(story.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="lg" className="rounded-2xl flex flex-col gap-4">
            <h4 className="font-bold font-display text-foreground text-sm flex items-center gap-1.5 tracking-tight">
              <Link2 className="w-4 h-4 text-primary" /> Cliques em Links
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-accent/40 border border-border/60 rounded-2xl px-5 py-4 flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Link da bio</span>
                <span className="text-3xl font-bold font-display text-foreground tabular-nums tracking-tight">{data.linkClicks.bio}</span>
              </div>
              <div className="bg-accent/40 border border-border/60 rounded-2xl px-5 py-4 flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Via DM (automação)</span>
                <span className="text-3xl font-bold font-display text-foreground tabular-nums tracking-tight">{data.linkClicks.dm}</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
