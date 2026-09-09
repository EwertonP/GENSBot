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

/** Sparkline minúscula embutida no card de KPI — mostra a tendência do período junto do número. */
function Sparkline({ points }: { points: SparklinePoint[] }) {
  if (points.length === 0 || points.every((p) => p.value === 0)) {
    return <div className="h-8" />;
  }
  const max = Math.max(1, ...points.map((p) => p.value));
  const width = 100;
  const height = 32;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - (p.value / max) * height}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiCard({ icon: Icon, label, value, sparkline }: { icon: React.ElementType; label: string; value: string | number; sparkline: SparklinePoint[] }) {
  return (
    <Card padding="sm" className="flex flex-col gap-2 rounded-2xl">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
      <Sparkline points={sparkline} />
    </Card>
  );
}

/** Card de mídia com menu "⋯" — linha horizontal rolável, padrão "Logistics" da Parte 2 do plano. */
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
    <div className="relative shrink-0 w-40 rounded-xl border border-border bg-card overflow-hidden">
      <div className="relative w-full aspect-square bg-accent">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL do próprio Storage */}
        <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
        {mediaCountBadge && mediaCountBadge > 1 && (
          <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {mediaCountBadge}
          </span>
        )}
        <div className="absolute top-1.5 left-1.5">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 w-32">
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-accent transition-all"
              >
                <ExternalLink className="w-3 h-3" /> Abrir mídia
              </a>
            </div>
          )}
        </div>
      </div>
      <div className="p-2 flex flex-col gap-0.5">
        <p className="text-xs font-bold text-foreground tabular-nums">{primaryStat}</p>
        <p className="text-[10px] text-muted-foreground">{secondaryStat}</p>
        <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
      </div>
    </div>
  );
}

interface DashboardContentPanelProps {
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}

/** Seção "Desempenho de Conteúdo" do Dashboard 2.0 (PLANO_REDESIGN_2.0.md Parte 3). */
export default function DashboardContentPanel({ selectedAccountId, withAccount }: DashboardContentPanelProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ContentPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(withAccount(`/api/dashboard/content-performance?period=${period}`))
      .then((res) => res.json())
      .then((result) => setData(result))
      .finally(() => setLoading(false));
  }, [selectedAccountId, period]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-foreground text-base">Desempenho de Conteúdo</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Publicações, alcance e engajamento das contas conectadas</p>
        </div>
        <div className="flex gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={period === opt.value ? 'primary' : 'secondary'}
              onClick={() => setPeriod(opt.value)}
              className="rounded-lg"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <p className="text-xs text-muted-foreground">Carregando desempenho de conteúdo...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard icon={ImageIcon} label="Posts" value={data.summary.posts} sparkline={data.summary.postsSparkline} />
            <KpiCard icon={Clapperboard} label="Reels" value={data.summary.reels} sparkline={data.summary.reelsSparkline} />
            <KpiCard icon={Video} label="Stories" value={data.summary.stories} sparkline={data.summary.storiesSparkline} />
            <KpiCard icon={TrendingUp} label="Alcance total" value={data.summary.reachTotal} sparkline={data.summary.reachSparkline} />
            <KpiCard icon={Percent} label="Engajamento médio" value={`${data.summary.engagementRate}%`} sparkline={[]} />
          </div>

          <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-3">
            <h4 className="font-bold text-foreground text-sm">Top Publicações</h4>
            {data.topPublications.length === 0 ? (
              <EmptyState icon={ImageIcon} title="Nenhuma publicação com dados de alcance neste período." />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {data.topPublications.map((pub) => (
                  <MediaCard
                    key={pub.id}
                    mediaUrl={pub.media_url}
                    mediaCountBadge={pub.media_count}
                    primaryStat={`${pub.reach} de alcance`}
                    secondaryStat={`${pub.interactions} interações`}
                    dateLabel={new Date(pub.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-3">
            <h4 className="font-bold text-foreground text-sm">Stories em Destaque</h4>
            {data.topStories.length === 0 ? (
              <EmptyState icon={Video} title="Nenhum story com dados de alcance neste período." />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {data.topStories.map((story) => (
                  <MediaCard
                    key={story.id}
                    mediaUrl={story.media_url}
                    primaryStat={`${story.reach} de alcance`}
                    secondaryStat="Story"
                    dateLabel={new Date(story.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-3">
            <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Link2 className="w-4 h-4" /> Cliques em Links
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl px-4 py-3 flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Link da bio</span>
                <span className="text-2xl font-bold text-foreground tabular-nums">{data.linkClicks.bio}</span>
              </div>
              <div className="bg-muted/40 rounded-xl px-4 py-3 flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Via DM (automação)</span>
                <span className="text-2xl font-bold text-foreground tabular-nums">{data.linkClicks.dm}</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
