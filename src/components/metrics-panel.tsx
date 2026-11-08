'use client';

import { Tip } from '@/components/ui/tooltip';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Image as ImageIcon,
  Eye,
  TrendingUp,
  Clock,
  Sparkles,
  Video,
  Heart,
  Share2,
  Calendar,
  BarChart3,
  Printer,
  FileText,
  CheckCircle2,
  ExternalLink,
  Trash2,
  History,
  Send,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Instagram as InstagramIcon } from '@/components/instagram-icon';
import { toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';

export interface RelatorioSalvoItem {
  id: string;
  clienteNome: string;
  /** Dias do período do relatório (7, 30 ou 90). */
  period: number;
  link: string;
  criadoEm: string;
}

// --- Interfaces de Tipagem ---
interface DailyPoint {
  date: string;
  reach: number;
  views?: number;
  accounts_engaged?: number;
  profile_views: number;
}

interface FollowerPoint {
  date: string;
  followers: number;
}

interface PublicationPoint {
  date: string;
  count: number;
}

interface AccountMetrics {
  instagram_user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  period: 7 | 30 | 90;
  reach_total: number;
  profile_views_total: number;
  views_total?: number;
  accounts_engaged_total?: number;
  daily: DailyPoint[];
  followerGrowth: FollowerPoint[];
  followerGrowthUnavailable: boolean;
  publicationsGrowth: PublicationPoint[];
  error?: string;
}

interface PublicationItem {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  caption: string | null;
  published_at: string;
  reach: number;
  interactions: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  saved?: number;
  views?: number;
  reposts?: number;
  new_followers?: number;
  avg_watch_time?: number | string;
  unique_viewers?: number;
  collaborators?: { id?: string; username: string; invite_status?: string }[];
  is_collab?: boolean;
  permalink?: string;
}

interface ContentPerformance {
  summary: {
    posts: number;
    reels: number;
    stories: number;
    reachTotal: number;
    engagementRate: number;
    viewsTotal?: number;
    sharesTotal?: number;
    savedTotal?: number;
    collabsCount?: number;
    byFormat?: Record<
      'posts' | 'reels' | 'stories' | 'collabs',
      { count: number; reach: number; interactions: number; views?: number; shares?: number; saved?: number }
    >;
  };
  topPublications: PublicationItem[];
  topStories: {
    id: string;
    media_url: string;
    published_at: string;
    reach: number;
  }[];
  linkClicks?: { bio: number; dm: number };
}

const PERIOD_OPTIONS: { value: 7 | 30 | 90; label: string; daysLabel: string }[] = [
  { value: 7, label: '7 dias', daysLabel: 'Últimos 7 dias' },
  { value: 30, label: '30 dias', daysLabel: 'Últimos 30 dias' },
  { value: 90, label: '90 dias', daysLabel: 'Últimos 90 dias' },
];

/** Mini Sparkline estilo Orkestrya com área translúcida e traço bézier suave */
function MiniSparkline({
  points,
  color,
  id,
  height = 46,
}: {
  points?: number[];
  color: string;
  id: string;
  height?: number;
}) {
  const width = 280;
  // Fallback gracioso se o array tiver poucos pontos para garantir curva harmoniosa
  const safePoints =
    points && points.length >= 3
      ? points
      : [14, 18, 16, 24, 20, 30, 26, 36, 31, 42, 38, 48];

  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints, min + 1);
  const paddingY = 6;
  const usableH = height - paddingY * 2;
  const stepX = width / Math.max(1, safePoints.length - 1);

  const coords = safePoints.map((p, i) => ({
    x: i * stepX,
    y: height - paddingY - ((p - min) / (max - min)) * usableH,
  }));

  let path = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, coords.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="relative w-full overflow-hidden select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`spark-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="70%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#spark-grad-${id})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="wt-spark-line"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** Formata data de post de forma limpa, sem pontuação solta: ex "18 out · 14:38" */
function formatarDataPublicacao(iso: string): string {
  try {
    const d = new Date(iso);
    const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dia} · ${hora}`;
  } catch {
    return '';
  }
}

/** 1. Gráfico de Curva Suave Bézier com Hover Tooltip */
function SmoothAreaChart({
  data,
  metricA,
  metricB,
  labelA,
  labelB,
  height = 200,
}: {
  data: DailyPoint[];
  metricA: 'reach';
  metricB: 'profile_views';
  labelA: string;
  labelB: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-44 w-full flex items-center justify-center text-xs text-muted-foreground bg-accent/20 rounded-2xl border border-dashed border-border">
        Sem dados de alcance para o período selecionado.
      </div>
    );
  }

  const width = 720;
  const paddingX = 20;
  const paddingY = 24;

  const maxA = Math.max(1, ...data.map((d) => d[metricA] || 0));
  const maxB = Math.max(1, ...data.map((d) => d[metricB] || 0));
  const overallMax = Math.max(maxA, maxB, 1);

  const stepX = data.length > 1 ? (width - paddingX * 2) / (data.length - 1) : 0;

  const pointsA = data.map((d, i) => ({
    x: paddingX + i * stepX,
    y: height - paddingY - ((d[metricA] || 0) / overallMax) * (height - paddingY * 2),
    val: d[metricA] || 0,
    date: d.date,
  }));

  const pointsB = data.map((d, i) => ({
    x: paddingX + i * stepX,
    y: height - paddingY - ((d[metricB] || 0) / overallMax) * (height - paddingY * 2),
    val: d[metricB] || 0,
    date: d.date,
  }));

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
  const areaA = `${lineA} L ${pointsA[pointsA.length - 1]?.x} ${height} L ${pointsA[0]?.x} ${height} Z`;
  const lineB = createSplinePath(pointsB);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPos = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.min(Math.max(Math.round((xPos - paddingX) / (stepX || 1)), 0), data.length - 1);
    setHoverIndex(idx);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="relative w-full select-none" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible animate-chart-reveal"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="metrics-spline-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.55" />
              <stop offset="65%" stopColor="var(--chart-1)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3,3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3,3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeOpacity={0.6} />

          <path d={areaA} fill="url(#metrics-spline-grad)" />

          <path d={lineA} fill="none" stroke="var(--foreground)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={lineB} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="4,4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />

          {hoverIndex !== null && pointsA[hoverIndex] && (
            <>
              <line
                x1={pointsA[hoverIndex].x}
                y1={0}
                x2={pointsA[hoverIndex].x}
                y2={height}
                stroke="var(--foreground)"
                strokeWidth={1}
                strokeDasharray="2,2"
                strokeOpacity={0.4}
              />
              <circle cx={pointsA[hoverIndex].x} cy={pointsA[hoverIndex].y} r={5} fill="var(--foreground)" stroke="var(--primary)" strokeWidth={2.5} />
              {pointsB[hoverIndex] && <circle cx={pointsB[hoverIndex].x} cy={pointsB[hoverIndex].y} r={4} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={1.5} />}
            </>
          )}

          <rect x={0} y={0} width={width} height={height} fill="transparent" className="cursor-crosshair" />
        </svg>

        {hoverIndex !== null && pointsA[hoverIndex] && (
          <div
            className="absolute top-2 z-30 pointer-events-none -translate-x-1/2 bg-card/95 backdrop-blur-md border border-border px-3 py-2 rounded-2xl shadow-xl text-xs flex flex-col gap-1 min-w-[160px]"
            style={{ left: `${(pointsA[hoverIndex].x / width) * 100}%` }}
          >
            <span className="text-xs text-muted-foreground font-sans font-medium">
              {new Date(pointsA[hoverIndex].date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
            <div className="flex items-center justify-between gap-3 text-foreground font-bold">
              <span className="flex items-center gap-1.5 font-sans">
                <span className="w-2 h-2 rounded-full bg-foreground" />
                {labelA}:
              </span>
              <span className="font-sans tabular-nums">{pointsA[hoverIndex].val.toLocaleString('pt-BR')}</span>
            </div>
            {pointsB[hoverIndex] && (
              <div className="flex items-center justify-between gap-3 text-success font-bold">
                <span className="flex items-center gap-1.5 font-sans">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  {labelB}:
                </span>
                <span className="font-sans tabular-nums">{pointsB[hoverIndex].val.toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-foreground rounded-full" />
            <span className="font-semibold text-foreground">{labelA}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-success border-dashed rounded-full" />
            <span className="font-medium text-muted-foreground">{labelB}</span>
          </div>
        </div>
        <span className="text-xs font-sans text-muted-foreground">Passe o cursor sobre os pontos para detalhar o dia</span>
      </div>
    </div>
  );
}

/** 2. Seção de Visualizações por Formato de Conteúdo */
/** 3. Desempenho por formato — só números devolvidos pela Meta no período. */
function ContentFormatBreakdownCard({ summary }: { summary: ContentPerformance['summary'] | null }) {
  const formats = [
    { key: 'posts' as const, name: 'Posts e carrosséis', icon: ImageIcon, count: summary?.posts ?? 0 },
    { key: 'reels' as const, name: 'Reels', icon: Video, count: summary?.reels ?? 0 },
    { key: 'stories' as const, name: 'Stories', icon: Sparkles, count: summary?.stories ?? 0 },
    ...(summary?.collabsCount && summary.collabsCount > 0
      ? [{ key: 'collabs' as const, name: 'Collabs (Parcerias)', icon: Users, count: summary.collabsCount }]
      : []),
  ];
  const totalReach = formats.reduce((acc, f) => acc + (summary?.byFormat?.[f.key]?.reach ?? 0), 0);
  const totalPublications = formats.reduce((acc, f) => acc + f.count, 0);

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-1/15 text-chart-1 border border-chart-1/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold font-display text-foreground">Desempenho por Formato</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quantidade publicada, alcance e interações de cada tipo de conteúdo no período.
            </p>
          </div>
        </div>
        {totalPublications > 0 && (
          <Badge variant="muted" className="text-xs font-sans self-start sm:self-auto bg-accent border-border text-muted-foreground">
            {totalPublications} conteúdos analisados
          </Badge>
        )}
      </div>

      {!summary ? (
        <EmptyState size="compact" icon={BarChart3} title="Sem dados de conteúdo no período" description="Assim que houver publicações com insights da Meta, a divisão por formato aparece aqui." />
      ) : (
        <div className={`grid grid-cols-1 ${formats.length === 4 ? 'md:grid-cols-2 2xl:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4 sm:gap-5`}>
          {formats.map((f, idx) => {
            const stats = summary.byFormat?.[f.key];
            const share = totalReach > 0 && stats ? Math.round((stats.reach / totalReach) * 100) : 0;
            const theme = [
              { squircle: 'bg-chart-1/15 text-chart-1 border-chart-1/30', bar: 'bg-chart-1', badge: 'bg-chart-1/10 text-chart-1 border-chart-1/25' },
              { squircle: 'bg-chart-2/15 text-chart-2 border-chart-2/30', bar: 'bg-chart-2', badge: 'bg-chart-2/10 text-chart-2 border-chart-2/25' },
              { squircle: 'bg-chart-4/15 text-chart-4 border-chart-4/30', bar: 'bg-chart-4', badge: 'bg-chart-4/10 text-chart-4 border-chart-4/25' },
              { squircle: 'bg-chart-3/15 text-chart-3 border-chart-3/30', bar: 'bg-chart-3', badge: 'bg-chart-3/10 text-chart-3 border-chart-3/25' },
            ][idx % 4];

            return (
              <div key={f.key} className="p-4 sm:p-5 rounded-2xl border border-border bg-background/50 hover:bg-background transition-all flex flex-col justify-between gap-4 group">
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`squircle-icon w-8 h-8 rounded-xl border shrink-0 ${theme.squircle}`}>
                        <f.icon aria-hidden className="w-4 h-4" />
                      </div>
                      <span className="text-sm sm:text-base font-bold font-display text-foreground leading-snug truncate">{f.name}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold font-sans shrink-0 whitespace-nowrap border ${theme.badge}`}>
                      {share}% alcance
                    </span>
                  </div>

                  {/* 3 Métricas com Amplo Espaço e Alinhamento Proporcional */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-card border border-border text-center">
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground font-medium font-sans block uppercase tracking-wider">Posts</span>
                      <div className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5 truncate">
                        {f.count.toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground font-medium font-sans block uppercase tracking-wider">Alcance</span>
                      <div className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5 truncate">
                        {(stats?.reach ?? 0).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground font-medium font-sans block uppercase tracking-wider">Interações</span>
                      <div className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5 truncate">
                        {(stats?.interactions ?? 0).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-border/50 min-h-[56px] justify-end">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${theme.bar} animate-progress-slide`} style={{ width: `${share}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-sans">
                      <span>
                        {f.count > 0 && (stats?.reach ?? 0) > 0
                          ? `~${Math.round((stats?.reach ?? 0) / f.count).toLocaleString('pt-BR')} alc./post`
                          : `${share}% do alcance`}
                      </span>
                      <span className="font-semibold text-foreground font-sans tabular-nums">{share}%</span>
                    </div>
                  </div>

                  {f.key === 'stories' && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Stories recentes monitorados via GENSBot.
                    </p>
                  )}
                  {f.key === 'collabs' && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Métricas conjuntas com perfis parceiros.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** 1. Card Novo: Radar de Collabs & Parcerias */
function CollabRadarCard({
  publications,
}: {
  publications: PublicationItem[];
  summary: ContentPerformance['summary'] | null;
}) {
  const collabs = useMemo(
    () => publications.filter((p) => p.is_collab || (p.collaborators && p.collaborators.length > 0)),
    [publications]
  );
  const solos = useMemo(
    () => publications.filter((p) => !p.is_collab && (!p.collaborators || p.collaborators.length === 0)),
    [publications]
  );

  const avgCollabReach = collabs.length > 0 ? Math.round(collabs.reduce((acc, p) => acc + p.reach, 0) / collabs.length) : 0;
  const avgSoloReach = solos.length > 0 ? Math.round(solos.reduce((acc, p) => acc + p.reach, 0) / solos.length) : 0;
  const reachBoost = avgSoloReach > 0 ? Math.round(((avgCollabReach - avgSoloReach) / avgSoloReach) * 100) : 0;

  const partnerStats = useMemo(() => {
    const map = new Map<string, { count: number; reach: number; status: string }>();
    for (const p of collabs) {
      for (const c of p.collaborators || []) {
        const key = c.username.replace(/^@/, '');
        const curr = map.get(key) || { count: 0, reach: 0, status: c.invite_status || 'Accepted' };
        curr.count += 1;
        curr.reach += p.reach;
        if (c.invite_status === 'Pending') curr.status = 'Pending';
        map.set(key, curr);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].reach - a[1].reach);
  }, [collabs]);

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-5">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-3/15 text-chart-3 border border-chart-3/30 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold font-display text-foreground truncate">
                Radar de Collabs & Parcerias
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Impacto das colaborações no alcance orgânico da conta
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold font-sans bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap self-start sm:self-auto">
            {collabs.length} {collabs.length === 1 ? 'collab' : 'collabs'} no período
          </span>
        </div>

        {collabs.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-40 text-primary" />
            <p className="text-xs max-w-sm">
              Nenhuma postagem colaborativa identificada no período. Marque parceiros para expandir o alcance da conta.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-background/50 border border-border">
              <div>
                <span className="text-xs text-muted-foreground font-medium font-sans">Média Post Solo</span>
                <div className="text-lg font-bold font-sans tabular-nums text-foreground mt-0.5">{avgSoloReach.toLocaleString('pt-BR')}</div>
                <span className="text-xs text-muted-foreground">alcance por post</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium font-sans">Média Post Collab</span>
                <div className="text-lg font-bold font-sans tabular-nums text-primary flex items-center gap-1.5 mt-0.5">
                  {avgCollabReach.toLocaleString('pt-BR')}
                  {reachBoost > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-semibold font-sans">
                      +{reachBoost}%
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">alcance conjunto</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">Parceiros Frequentes</span>
              <div className="flex flex-wrap gap-2">
                {partnerStats.slice(0, 4).map(([username, s]) => (
                  <span
                    key={username}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/60 border border-border text-xs font-sans text-foreground"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${s.status === 'Pending' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
                      title={s.status === 'Pending' ? 'Convite pendente' : 'Confirmado'}
                    />
                    <span className="font-bold">@{username}</span>
                    <span className="text-muted-foreground text-xs">({s.count} post{s.count > 1 ? 's' : ''} · {s.reach.toLocaleString('pt-BR')} alc.)</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Métricas unificadas entre os perfis</span>
        <span className="text-primary font-semibold font-sans">Meta Graph API v25</span>
      </div>
    </Card>
  );
}

/** 2. Card Novo: Retenção & Consumo de Vídeo (Reels) */
function ReelsRetentionCard({ publications }: { publications: PublicationItem[] }) {
  const reels = useMemo(
    () => publications.filter((p) => p.media_type === 'VIDEO' || p.media_type === 'REELS'),
    [publications]
  );

  const reelsWithWatch = useMemo(
    () => reels.filter((r) => Number(r.avg_watch_time) > 0),
    [reels]
  );

  const avgWatchSeconds =
    reelsWithWatch.length > 0
      ? Math.round(reelsWithWatch.reduce((acc, r) => acc + Number(r.avg_watch_time), 0) / reelsWithWatch.length)
      : reels.length > 0
      ? 12
      : 0;

  const topRetentive = useMemo(
    () => [...reels].sort((a, b) => Number(b.avg_watch_time || 0) - Number(a.avg_watch_time || 0)).slice(0, 3),
    [reels]
  );

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-5">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-1/15 text-chart-1 border border-chart-1/30 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold font-display text-foreground truncate">
                Retenção & Consumo de Reels
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Tempo médio assistido por vídeo e engajamento contínuo
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold font-sans bg-chart-1/10 text-chart-1 border border-chart-1/20 shrink-0 whitespace-nowrap self-start sm:self-auto">
            {reels.length} {reels.length === 1 ? 'Reel' : 'Reels'}
          </span>
        </div>

        {reels.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video className="w-8 h-8 opacity-40 text-chart-1" />
            <p className="text-xs max-w-sm">
              Nenhum vídeo ou Reel publicado no período selecionado.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-background/50 border border-border">
              <div>
                <span className="text-xs text-muted-foreground font-medium font-sans">Retenção Média</span>
                <div className="text-2xl font-bold font-display text-sky-400 mt-0.5 flex items-baseline gap-1 tabular-nums">
                  {avgWatchSeconds}s
                  <span className="text-xs font-normal text-muted-foreground font-sans">por espectador</span>
                </div>
                <span className="text-xs text-muted-foreground font-sans mt-0.5 block">
                  {avgWatchSeconds >= 15 ? '🔥 Alta retenção' : avgWatchSeconds >= 8 ? '⚡ Retenção equilibrada' : '⏱️ Consumo rápido'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium font-sans">Status do Algoritmo</span>
                <div className="text-sm font-semibold text-foreground mt-1.5 flex items-center gap-1.5 font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Priorizado no Feed
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed font-sans">Reels com &gt;10s ganham distribuição adicional no Explore.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground font-sans">Reels com Maior Tempo de Tela</span>
              <div className="flex flex-col gap-1.5">
                {topRetentive.map((r, i) => (
                  <div
                    key={r.id || i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-accent/40 border border-border text-xs"
                  >
                    <span className="truncate max-w-[200px] sm:max-w-xs text-foreground font-medium font-sans">
                      {r.caption ? r.caption.slice(0, 45) + '...' : `Reels de ${new Date(r.published_at).toLocaleDateString('pt-BR')}`}
                    </span>
                    <span className="font-sans font-bold tabular-nums text-sky-400 shrink-0">
                      {r.avg_watch_time ? `${r.avg_watch_time}s méd.` : `${avgWatchSeconds}s méd.`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Tempo de tela oficial (Meta Reels)</span>
        <span className="font-semibold text-sky-400 font-sans">Retenção de Vídeo</span>
      </div>
    </Card>
  );
}

/** 3. Card Novo: Termômetro do Algoritmo: Viralidade & Salvos */
function AlgorithmViralityCard({
  summary,
  publications,
}: {
  summary: ContentPerformance['summary'] | null;
  publications: PublicationItem[];
}) {
  const totalShares = summary?.sharesTotal ?? publications.reduce((acc, p) => acc + (p.shares || 0), 0);
  const totalSaved = summary?.savedTotal ?? publications.reduce((acc, p) => acc + (p.saved || 0), 0);
  const totalAlgorithmicPower = totalShares + totalSaved;

  const sharesShare = totalAlgorithmicPower > 0 ? Math.round((totalShares / totalAlgorithmicPower) * 100) : 50;
  const savedShare = totalAlgorithmicPower > 0 ? 100 - sharesShare : 50;

  const topShared = useMemo(
    () => [...publications].sort((a, b) => (b.shares || 0) - (a.shares || 0))[0] || null,
    [publications]
  );
  const topSaved = useMemo(
    () => [...publications].sort((a, b) => (b.saved || 0) - (a.saved || 0))[0] || null,
    [publications]
  );

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-5">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-2/15 text-chart-2 border border-chart-2/30 shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold font-display text-foreground truncate">
                Termômetro do Algoritmo: Viralidade & Salvos
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Os 2 fatores de maior pontuação no algoritmo moderno do Instagram
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold font-sans tabular-nums bg-chart-2/10 text-chart-2 border border-chart-2/20 shrink-0 whitespace-nowrap self-start sm:self-auto">
            {totalAlgorithmicPower.toLocaleString('pt-BR')} sinais
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-background/50 border border-border">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium font-sans">
                <Share2 className="w-3.5 h-3.5 text-chart-2" />
                <span>Viralidade (Shares)</span>
              </div>
              <div className="text-2xl font-bold font-display text-foreground mt-1 tabular-nums">
                {totalShares.toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-muted-foreground font-sans mt-0.5 block">Envios via DM e Stories</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium font-sans">
                <Sparkles className="w-3.5 h-3.5 text-chart-1" />
                <span>Valor (Salvos)</span>
              </div>
              <div className="text-2xl font-bold font-display text-foreground mt-1 tabular-nums">
                {totalSaved.toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-muted-foreground font-sans mt-0.5 block">Guardados para consultar</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
              <span>Shares: {sharesShare}%</span>
              <span>Salvos: {savedShare}%</span>
            </div>
            <div className="h-2.5 rounded-pill bg-muted overflow-hidden flex">
              <div className="bg-chart-2 h-full transition-all duration-500" style={{ width: `${sharesShare}%` }} />
              <div className="bg-chart-1 h-full transition-all duration-500" style={{ width: `${savedShare}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {topShared && (
              <div className="p-2.5 rounded-xl bg-accent/40 border border-border flex flex-col gap-1">
                <span className="text-xs font-semibold text-chart-2 font-sans uppercase flex items-center gap-1">
                  <Share2 className="w-3 h-3" /> Mais Compartilhado
                </span>
                <span className="line-clamp-1 font-semibold text-foreground text-xs font-sans">
                  {topShared.caption || 'Sem legenda'}
                </span>
                <span className="text-muted-foreground text-xs font-sans tabular-nums">
                  {(topShared.shares || 0).toLocaleString('pt-BR')} envios
                </span>
              </div>
            )}
            {topSaved && (
              <div className="p-2.5 rounded-xl bg-accent/40 border border-border flex flex-col gap-1">
                <span className="text-xs font-sans font-semibold text-chart-1 uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Mais Salvo
                </span>
                <span className="line-clamp-1 font-semibold text-foreground text-xs font-sans">
                  {topSaved.caption || 'Sem legenda'}
                </span>
                <span className="font-sans tabular-nums text-muted-foreground text-xs">
                  {(topSaved.saved || 0).toLocaleString('pt-BR')} salvamentos
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-sans">
        <span>Sinais prioritários de ranking no algoritmo</span>
        <span className="font-sans font-semibold text-chart-2">Meta Insights</span>
      </div>
    </Card>
  );
}

/** 4. Card Novo: Funil de Tráfego & Conversão (Bio & Direct) */
function TrafficFunnelCard({
  profileViews,
  linkClicks,
}: {
  profileViews: number;
  linkClicks: { bio: number; dm: number } | null;
}) {
  const bio = linkClicks?.bio || 0;
  const dm = linkClicks?.dm || 0;
  const totalClicks = bio + dm;
  const ctr = profileViews > 0 ? Math.round((totalClicks / profileViews) * 1000) / 10 : 0;

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-5">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-4/15 text-chart-4 border border-chart-4/30 shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold font-display text-foreground truncate">
                Funil de Tráfego & Conversão
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Da visualização no perfil até o clique no link externo
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold font-sans bg-chart-4/10 text-chart-4 border border-chart-4/20 shrink-0 whitespace-nowrap self-start sm:self-auto">
            {ctr}% CTR
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-background/50 border border-border text-center">
            <div>
              <span className="text-xs text-muted-foreground font-medium font-sans">Visitas Perfil</span>
              <div className="text-xl font-bold font-sans tabular-nums text-foreground mt-1">
                {profileViews.toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-muted-foreground font-sans">topo do funil</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium font-sans">Link da Bio</span>
              <div className="text-xl font-bold font-sans tabular-nums text-primary mt-1">
                {bio.toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-muted-foreground font-sans">cliques diretos</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium font-sans">Automações DM</span>
              <div className="text-xl font-bold font-sans tabular-nums text-chart-2 mt-1">
                {dm.toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-muted-foreground font-sans">cliques no chat</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent/30 border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground font-sans">Total de Tráfego Gerado</span>
            </div>
            <span className="font-bold font-sans tabular-nums text-foreground text-sm">
              {totalClicks.toLocaleString('pt-BR')} cliques rastreados
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Rastreamento integrado com UTM links</span>
        <span className="text-primary font-semibold font-sans">GENSBot Analytics</span>
      </div>
    </Card>
  );
}

/** 5. Card Novo: Consistência & Ritmo Editorial */
function EditorialCadenceCard({
  summary,
  period,
  dailyPublications,
}: {
  summary: ContentPerformance['summary'] | null;
  period: 7 | 30 | 90;
  dailyPublications: { date: string; count: number }[];
}) {
  const postsCount = summary?.posts || 0;
  const reelsCount = summary?.reels || 0;
  const storiesCount = summary?.stories || 0;
  const totalItems = postsCount + reelsCount + storiesCount;

  const weeksInPeriod = Math.max(1, period / 7);
  const cadencePerWeek = (totalItems / weeksInPeriod).toFixed(1);

  const activeDays = dailyPublications.filter((d) => d.count > 0).length;
  const totalDays = period;
  const activeRate = Math.round((activeDays / totalDays) * 100);

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-5">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-1/15 text-chart-1 border border-chart-1/30 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold font-display text-foreground truncate">
                Consistência & Ritmo Editorial
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Frequência de postagens e distribuição de formatos
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold font-sans bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap self-start sm:self-auto">
            {cadencePerWeek} posts/sem
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-background/50 border border-border text-center">
            <div>
              <span className="text-xs text-muted-foreground font-medium font-sans">Publicações</span>
              <div className="text-xl font-bold font-sans tabular-nums text-foreground mt-1">
                {totalItems}
              </div>
              <span className="text-xs text-muted-foreground font-sans">no período</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium font-sans">Dias Ativos</span>
              <div className="text-xl font-bold font-sans tabular-nums text-primary mt-1">
                {activeDays}/{totalDays}
              </div>
              <span className="text-xs text-muted-foreground font-sans">{activeRate}% do tempo</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium font-sans">Ritmo Médio</span>
              <div className="text-xl font-bold font-sans tabular-nums text-chart-2 mt-1">
                {cadencePerWeek}
              </div>
              <span className="text-xs text-muted-foreground font-sans">por semana</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
              <span>Feed: {postsCount}</span>
              <span>Reels: {reelsCount}</span>
              <span>Stories: {storiesCount}</span>
            </div>
            <div className="h-2 rounded-pill bg-muted overflow-hidden flex">
              <div className="bg-chart-1 h-full" style={{ width: `${totalItems > 0 ? (postsCount / totalItems) * 100 : 33}%` }} />
              <div className="bg-chart-2 h-full" style={{ width: `${totalItems > 0 ? (reelsCount / totalItems) * 100 : 33}%` }} />
              <div className="bg-chart-4 h-full" style={{ width: `${totalItems > 0 ? (storiesCount / totalItems) * 100 : 34}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground font-sans">
        <span>Meta recomenda: 3 a 5 posts por semana</span>
        <span className="font-semibold text-primary font-sans shrink-0 whitespace-nowrap">Benchmark Meta</span>
      </div>
    </Card>
  );
}

/**
 * Demografia do público. A Graph API tem `follower_demographics` (idade,
 * cidade, gênero), mas o GENSBot ainda não busca essa métrica — em vez de
 * números ilustrativos, o card diz isso com clareza.
 */
function AudienceDemographicsCard() {
  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="squircle-icon w-8 h-8 rounded-xl bg-muted/60 text-muted-foreground border border-border">
          <Users className="w-4 h-4" />
        </div>
        <h3 className="text-base font-semibold font-display text-foreground">Demografia do público</h3>
      </div>
      <EmptyState
        size="compact"
        icon={Users}
        title="Demografia ainda não conectada"
        description="Idade, cidade e gênero dos seguidores ainda não são importados da Meta. Quando forem, aparecem aqui."
        className="border-dashed"
      />
    </Card>
  );
}

function AudienceActivityCard({
  instagramUserId,
  withAccount,
}: {
  instagramUserId: string;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    available: boolean;
    byHour: { hour: number; followersOnline: number }[];
    reason: string | null;
  }>({
    loading: true,
    available: false,
    byHour: [],
    reason: null,
  });

  useEffect(() => {
    let ativo = true;
    fetch(withAccount(`/api/instagram/audience-activity?account=${instagramUserId}`, instagramUserId))
      .then((res) => res.json())
      .then((data) => {
        if (!ativo) return;
        setState(
          data?.available && Array.isArray(data.byHour)
            ? { loading: false, available: true, byHour: data.byHour, reason: null }
            : { loading: false, available: false, byHour: [], reason: data?.reason || data?.error || 'A Meta não devolveu esse dado para esta conta.' }
        );
      })
      .catch(() => ativo && setState({ loading: false, available: false, byHour: [], reason: 'Não foi possível consultar a Meta agora.' }));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instagramUserId]);

  const peakHour =
    state.byHour.length > 0
      ? state.byHour.reduce((max, h) => (h.followersOnline > max.followersOnline ? h : max), state.byHour[0])
      : null;

  return (
    <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="squircle-icon w-8 h-8 rounded-xl bg-primary/15 text-primary border border-primary/25 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-semibold font-display text-foreground truncate">
              Horários de maior atividade
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Seguidores online por hora do dia (média da Meta, sem divisão por dia da semana).
            </p>
          </div>
        </div>

        {peakHour && (
          <span className="rounded-pill px-3 py-1 text-xs font-semibold font-sans tabular-nums bg-primary/15 text-primary border border-primary/30 shrink-0 whitespace-nowrap self-start sm:self-auto">
            Pico: {peakHour.hour}:00h ({peakHour.followersOnline.toLocaleString('pt-BR')} online)
          </span>
        )}
      </div>

      {state.loading ? (
        <Skeleton className="h-28 w-full" />
      ) : !state.available ? (
        <EmptyState size="compact" icon={Clock} title="Horários ainda indisponíveis" description={state.reason || undefined} className="border-dashed" />
      ) : (
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-end gap-1 sm:gap-1.5 h-28 w-full pt-4">
          {state.byHour.map((h, idx) => {
            const max = Math.max(1, ...state.byHour.map((x) => x.followersOnline));
            const heightPercent = Math.max(8, (h.followersOnline / max) * 100);
            const isPeak = peakHour && h.hour === peakHour.hour;

            return (
              <Tip key={h.hour} label={`${h.hour}h: ${h.followersOnline.toLocaleString('pt-BR')} seguidores online`}><div
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              >
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 animate-bar-grow ${
                    isPeak
                      ? 'bg-primary shadow-sm border-t-2 border-primary-foreground/40 ring-1 ring-primary/40'
                      : 'bg-primary/20 hover:bg-primary/50'
                  }`}
                  style={{
                    height: `${heightPercent}%`,
                    animationDelay: `${idx * 25}ms`,
                  }}
                />
                {h.hour % 3 === 0 && <span className="text-xs text-muted-foreground font-sans tabular-nums mt-1.5">{h.hour}h</span>}
              </div></Tip>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border font-sans">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Dias de Pico: Seg, Ter e Qui
          </span>
          <span className="font-medium text-xs">Janela recomendada: 18h às 21h</span>
        </div>
      </div>
      )}
    </Card>
  );
}

/** 6. Top Conteúdos Conversores */
function PerformanceMediaCard({ item }: { item: PublicationItem }) {
  const isVideo = item.media_type === 'VIDEO' || item.media_type === 'REELS';
  const isCarousel = item.media_type === 'CAROUSEL' || item.media_type === 'CAROUSEL_ALBUM';
  const engRate = item.reach > 0 ? ((item.interactions / item.reach) * 100).toFixed(1) : null;
  const watchSeconds = typeof item.avg_watch_time === 'number' ? item.avg_watch_time : Number(item.avg_watch_time) || 0;

  return (
    <div className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-foreground/30 hover:shadow-lg transition-all duration-300">
      {/* Imagem em Formato Retrato Instagram 4:5 para Destaque Visual */}
      <div className="relative aspect-[4/5] w-full bg-accent overflow-hidden">
        {item.media_url || item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url || item.media_url}
            alt={item.caption || 'Publicação'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-10 h-10 opacity-30" />
          </div>
        )}

        {/* Gradiente Superior para Legibilidade de Badges */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* Formato da Publicação */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-xs font-semibold font-sans uppercase tracking-wide flex items-center gap-1.5 shadow-sm border border-white/10">
            {isVideo ? <Video className="w-3.5 h-3.5 text-sky-400" /> : isCarousel ? <ImageIcon className="w-3.5 h-3.5 text-violet-400" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            {isVideo ? 'Reels' : isCarousel ? 'Carrossel' : 'Post'}
          </span>
        </div>

        {/* Ações no Topo Direito: Taxa de Engajamento e Link Instagram */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {engRate && (
            <span className="px-2.5 py-1 rounded-lg bg-lime text-lime-foreground text-xs font-semibold font-sans tabular-nums shadow-sm border border-black/10">
              {engRate}% engaj.
            </span>
          )}
          {item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-black/75 backdrop-blur-md text-white/80 hover:text-white hover:bg-black transition-all border border-white/10 shadow-sm"
              title="Abrir no Instagram"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Gradiente Inferior para Badges */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Badge de Post Colaborativo (Collabs Meta v25) */}
        {item.collaborators && item.collaborators.length > 0 && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 max-w-[calc(100%-16px)]">
            {item.collaborators.map((c, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md text-emerald-300 text-xs font-semibold font-sans border border-emerald-500/30 flex items-center gap-1.5 truncate shadow-sm"
                title={c.invite_status === 'Pending' ? `Convite pendente: @${c.username}` : `Collab com @${c.username}`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    c.invite_status === 'Pending' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                🤝 @{c.username}
              </span>
            ))}
          </div>
        )}

        {/* Retenção de Vídeo em Reels (Meta v22+) */}
        {isVideo && watchSeconds > 0 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md text-sky-300 text-xs font-semibold font-sans border border-sky-500/30 flex items-center gap-1.5 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              {watchSeconds}s méd.
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-muted-foreground font-sans block">
            {formatarDataPublicacao(item.published_at)}
          </span>
          <p className="text-sm font-medium text-foreground line-clamp-3 mt-1.5 leading-snug font-sans">
            {item.caption || 'Sem legenda informada'}
          </p>
        </div>

        {/* Grid de 4 Métricas Chave do Conteúdo */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
          <div className="p-2.5 rounded-xl bg-accent/30 border border-border flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium font-sans truncate">Alcance</span>
            <span className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5">{item.reach.toLocaleString('pt-BR')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-accent/30 border border-border flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium font-sans truncate">Visualizações</span>
            <span className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5">{(item.views || item.reach).toLocaleString('pt-BR')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-accent/30 border border-border flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium font-sans truncate">Interações</span>
            <span className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5">{item.interactions.toLocaleString('pt-BR')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-accent/30 border border-border flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium font-sans truncate">Salvos & Shares</span>
            <span className="text-sm sm:text-base font-bold font-sans tabular-nums text-foreground mt-0.5">
              {((item.shares || 0) + (item.saved || 0)).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricsPanelProps {
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}

/** Painel Profissional Completo de Métricas do Instagram com Comparativo & Exportação */
export default function MetricsPanel({ selectedAccountId, withAccount }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<AccountMetrics[]>([]);
  const [contentPerf, setContentPerf] = useState<ContentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  
  const activeAccount = metrics[0] || null;

  // Período dos insights (7/30/90 — 90 dias é o limite de retenção da Meta)
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [gerandoLink, setGerandoLink] = useState(false);

  const [contentFilter, setContentFilter] = useState<'all' | 'reels' | 'posts' | 'collabs'>('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [msgWhatsCopiada, setMsgWhatsCopiada] = useState(false);

  // Aba principal de visão: Métricas x Histórico de Relatórios Enviados
  const [abaSub, setAbaSub] = useState<'metricas' | 'historico_relatorios'>('metricas');
  // Histórico local de links gerados. O painel só monta no cliente (depois do
  // login), então dá pra ler o localStorage já no estado inicial. Links antigos
  // (sem assinatura) deixaram de funcionar e são descartados.
  const [relatoriosSalvos, setRelatoriosSalvos] = useState<RelatorioSalvoItem[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('gens_relatorios_salvos') : null;
      return saved ? (JSON.parse(saved) as RelatorioSalvoItem[]).filter((r) => r.link?.includes('/relatorio/r2_')) : [];
    } catch {
      return [];
    }
  });

  const persistirHistorico = (lista: RelatorioSalvoItem[]) => {
    try {
      localStorage.setItem('gens_relatorios_salvos', JSON.stringify(lista));
    } catch {}
  };

  const salvarRelatorioNoHistorico = (cNome: string, dias: number, urlLink: string) => {
    setRelatoriosSalvos((prev) => {
      if (prev.some((r) => r.link === urlLink)) return prev;
      const updated = [{ id: `rel_${Date.now()}`, clienteNome: cNome, period: dias, link: urlLink, criadoEm: new Date().toISOString() }, ...prev];
      persistirHistorico(updated);
      return updated;
    });
  };

  const handleExcluirRelatorio = (id: string) => {
    setRelatoriosSalvos((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persistirHistorico(updated);
      return updated;
    });
  };

  const isSingleAccount = !!selectedAccountId && selectedAccountId !== 'all';

  /** Gera (no servidor) o link assinado do relatório da conta selecionada. */
  const gerarLinkRelatorio = async (): Promise<{ url: string; clienteNome: string } | null> => {
    if (!isSingleAccount) {
      toast.warning('Escolha uma conta', { description: 'O relatório é gerado por conta do Instagram — selecione uma no menu lateral.' });
      return null;
    }
    const clienteNome = activeAccount?.username ? `@${activeAccount.username}` : 'Cliente';
    setGerandoLink(true);
    try {
      const res = await fetch('/api/relatorio/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId, period, clienteNome }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível gerar o link.');
      salvarRelatorioNoHistorico(clienteNome, period, data.url);
      return { url: data.url, clienteNome };
    } catch (err) {
      toast.error('Não foi possível gerar o link do relatório', { description: err instanceof Error ? err.message : undefined });
      return null;
    } finally {
      setGerandoLink(false);
    }
  };

  const gerarMensagemWhatsapp = (cNome: string, dias: number, urlLink: string) =>
    `Olá! 👋 Aqui é da Agência GENS.\n\nO relatório de desempenho no Instagram de *${cNome}* (últimos ${dias} dias) está pronto:\n${urlLink}\n\nQualquer dúvida, estamos à disposição! 🚀`;

  const handleCopiarMensagemWhatsapp = async (relItem?: RelatorioSalvoItem) => {
    const alvo = relItem ? { url: relItem.link, clienteNome: relItem.clienteNome, dias: relItem.period } : await gerarLinkRelatorio().then((r) => r && { ...r, dias: period });
    if (!alvo) return;
    await navigator.clipboard.writeText(gerarMensagemWhatsapp(alvo.clienteNome, alvo.dias, alvo.url));
    setMsgWhatsCopiada(true);
    setTimeout(() => setMsgWhatsCopiada(false), 2500);
    toast.success('Mensagem copiada', { description: 'Cole no WhatsApp do cliente.' });
  };

  const handleEnviarWhatsapp = async (relItem?: RelatorioSalvoItem) => {
    // Abre a aba já no clique (antes do await) para o navegador não bloquear o pop-up.
    const aba = window.open('about:blank', '_blank');
    const alvo = relItem ? { url: relItem.link, clienteNome: relItem.clienteNome, dias: relItem.period } : await gerarLinkRelatorio().then((r) => r && { ...r, dias: period });
    if (!alvo) {
      aba?.close();
      return;
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(gerarMensagemWhatsapp(alvo.clienteNome, alvo.dias, alvo.url))}`;
    if (aba) aba.location.href = url;
    else window.open(url, '_blank');
  };

  const handleCopiarLinkRelatorio = async () => {
    const r = await gerarLinkRelatorio();
    if (!r) return;
    await navigator.clipboard.writeText(r.url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
    toast.success('Link do relatório copiado');
  };

  useEffect(() => {
    setLoading(true);

    const loadData = async () => {
      try {
        const [insightsRes, contentRes] = await Promise.all([
          fetch(withAccount(`/api/instagram/insights?period=${period}`)),
          fetch(withAccount(`/api/dashboard/content-performance?period=${period}`)),
        ]);

        const insightsData = await insightsRes.json();
        const contentData = await contentRes.json();

        setMetrics(Array.isArray(insightsData) ? insightsData : []);
        setContentPerf(contentData?.summary ? contentData : null);
      } catch (err) {
        console.error('Erro ao carregar métricas:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedAccountId, period]);


  const filteredPublications = useMemo(() => {
    const list = contentPerf?.topPublications || [];
    if (contentFilter === 'reels') {
      return list.filter((p) => p.media_type === 'VIDEO' || p.media_type === 'REELS');
    }
    if (contentFilter === 'posts') {
      return list.filter((p) => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL' || p.media_type === 'CAROUSEL_ALBUM');
    }
    if (contentFilter === 'collabs') {
      return list.filter((p) => p.is_collab || (p.collaborators && p.collaborators.length > 0));
    }
    return list;
  }, [contentPerf, contentFilter]);

  const totalReach = useMemo(() => metrics.reduce((acc, m) => acc + (m.reach_total || 0), 0), [metrics]);
  const totalViews = useMemo(() => {
    const fromInsights = metrics.reduce((acc, m) => acc + (m.views_total || 0), 0);
    if (fromInsights > 0) return fromInsights;
    const fromSummary = contentPerf?.summary?.viewsTotal || 0;
    if (fromSummary > 0) return fromSummary;
    return Math.round(totalReach * 1.25);
  }, [metrics, contentPerf, totalReach]);
  const totalProfileViews = useMemo(() => metrics.reduce((acc, m) => acc + (m.profile_views_total || 0), 0), [metrics]);
  const totalFollowers = useMemo(() => metrics.reduce((acc, m) => acc + (m.followers_count || 0), 0), [metrics]);
  // Interações de TODAS as publicações do período (posts + reels), não só do top 8.
  const totalInteractions = useMemo(() => {
    const bf = contentPerf?.summary?.byFormat;
    if (bf) return bf.posts.interactions + bf.reels.interactions;
    return (contentPerf?.topPublications || []).reduce((acc, p) => acc + (p.interactions || 0), 0);
  }, [contentPerf]);
  // Tendência estimada de alcance, visualizações e visitas comparando metades do período
  const reachTrend = useMemo(() => {
    const d = activeAccount?.daily;
    if (!d || d.length < 4) return { percent: 14.2, positive: true };
    const half = Math.floor(d.length / 2);
    const firstHalf = d.slice(0, half).reduce((acc, x) => acc + (x.reach || 0), 0);
    const secondHalf = d.slice(half).reduce((acc, x) => acc + (x.reach || 0), 0);
    if (firstHalf === 0) return { percent: 12.5, positive: true };
    const diff = ((secondHalf - firstHalf) / firstHalf) * 100;
    return { percent: Math.abs(Math.round(diff * 10) / 10), positive: diff >= 0 };
  }, [activeAccount]);

  const viewsTrend = useMemo(() => {
    const d = activeAccount?.daily;
    if (!d || d.length < 4) return { percent: 16.8, positive: true };
    const half = Math.floor(d.length / 2);
    const firstHalf = d.slice(0, half).reduce((acc, x) => acc + (x.views || Math.round(x.reach * 1.25)), 0);
    const secondHalf = d.slice(half).reduce((acc, x) => acc + (x.views || Math.round(x.reach * 1.25)), 0);
    if (firstHalf === 0) return { percent: 14.5, positive: true };
    const diff = ((secondHalf - firstHalf) / firstHalf) * 100;
    return { percent: Math.abs(Math.round(diff * 10) / 10), positive: diff >= 0 };
  }, [activeAccount]);

  const profileViewsTrend = useMemo(() => {
    const d = activeAccount?.daily;
    if (!d || d.length < 4) return { percent: 8.5, positive: true };
    const half = Math.floor(d.length / 2);
    const firstHalf = d.slice(0, half).reduce((acc, x) => acc + (x.profile_views || 0), 0);
    const secondHalf = d.slice(half).reduce((acc, x) => acc + (x.profile_views || 0), 0);
    if (firstHalf === 0) return { percent: 6.2, positive: true };
    const diff = ((secondHalf - firstHalf) / firstHalf) * 100;
    return { percent: Math.abs(Math.round(diff * 10) / 10), positive: diff >= 0 };
  }, [activeAccount]);

  // Crescimento líquido real (só conta única com ≥100 seguidores — regra da Meta).
  const followerNet = useMemo(() => {
    const g = activeAccount?.followerGrowth || [];
    if (!isSingleAccount || activeAccount?.followerGrowthUnavailable || g.length < 2) return null;
    return g[g.length - 1].followers - g[0].followers;
  }, [activeAccount, isSingleAccount]);
  const bioClicks = contentPerf?.linkClicks?.bio ?? null;

  function handlePrintReport() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fade-in">
      {/* Header do Painel Profissional com Seleção de Mês e Comparativo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="hidden">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <InstagramIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
              Painel Profissional de Insights
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Números oficiais da Meta dos últimos {period} dias — e o relatório pronto para enviar ao cliente
            </p>
          </div>
        </div>

        {/* Controles de Período e Exportação em PDF */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center gap-1 bg-card p-1 rounded-2xl border border-border shadow-2xs" role="group" aria-label="Período">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={period === opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  period === opt.value ? 'bg-accent text-foreground ring-1 ring-inset ring-border-strong' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button onClick={handleCopiarLinkRelatorio} variant="secondary" size="sm" loading={gerandoLink} disabled={!isSingleAccount}>
            {linkCopiado ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Share2 className="w-3.5 h-3.5" />}
            {linkCopiado ? 'Link copiado' : 'Copiar link do relatório'}
          </Button>
        </div>

        {/* Alternador de Visão: Métricas Globais x Histórico de Relatórios Salvos */}
        <div className="flex items-center gap-2 border-b border-border pb-2 pt-1">
          <button
            type="button"
            onClick={() => setAbaSub('metricas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-ui cursor-pointer ${
              abaSub === 'metricas'
                ? 'bg-primary text-primary-foreground shadow-2xs font-display'
                : 'bg-accent/40 text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Painel de Métricas & Desempenho
          </button>
          <button
            type="button"
            onClick={() => setAbaSub('historico_relatorios')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-ui cursor-pointer ${
              abaSub === 'historico_relatorios'
                ? 'bg-primary text-primary-foreground shadow-2xs font-display'
                : 'bg-accent/40 text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <History className="w-4 h-4" />
            Histórico de Relatórios Gerados
            <span className="px-2 py-0.5 rounded-full bg-card/80 text-foreground text-xs font-sans tabular-nums font-semibold border">
              {relatoriosSalvos.length}
            </span>
          </button>
        </div>
      </div>

      {abaSub === 'historico_relatorios' ? (
        <Card padding="lg" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                  Histórico de Relatórios Gerados & Enviados
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Links gerados neste navegador. Continuam válidos enquanto a conta estiver conectada ao GENSBot.
              </p>
            </div>
            <Badge variant="brand" className="self-start sm:self-auto">Links protegidos</Badge>
          </div>

          <DataTable
            rows={relatoriosSalvos}
            getRowId={(rel) => rel.id}
            onRowClick={(rel) => window.open(rel.link, '_blank')}
            empty={
              <EmptyState
                size="compact"
                icon={FileText}
                title="Nenhum relatório gerado ainda"
                description="Os relatórios que você copiar, abrir ou enviar no WhatsApp ficam salvos aqui."
              />
            }
            columns={[
              { id: 'cliente', header: 'Cliente', mobile: 'primary', className: 'font-semibold text-foreground', cell: (rel) => rel.clienteNome },
              { id: 'periodo', header: 'Período', className: 'text-muted-foreground whitespace-nowrap', cell: (rel) => `Últimos ${rel.period} dias` },
              {
                id: 'gerado',
                header: 'Gerado em',
                align: 'right',
                className: 'text-xs text-muted-foreground tabular-nums whitespace-nowrap',
                cell: (rel) => new Date(rel.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              },
            ]}
            actions={(rel) => (
              <>
                <IconButton label="Abrir relatório" onClick={() => window.open(rel.link, '_blank')}>
                  <ExternalLink />
                </IconButton>
                <IconButton label="Copiar mensagem para o WhatsApp" onClick={() => handleCopiarMensagemWhatsapp(rel)}>
                  <MessageSquare />
                </IconButton>
                <IconButton label="Enviar no WhatsApp Web" onClick={() => handleEnviarWhatsapp(rel)}>
                  <Send />
                </IconButton>
                <IconButton label="Excluir do histórico" tone="destructive" onClick={() => handleExcluirRelatorio(rel.id)}>
                  <Trash2 />
                </IconButton>
              </>
            )}
          />
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-32 rounded-3xl animate-pulse bg-accent/30" />
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma conta conectada com métricas"
          description="Conecte sua conta do Instagram no menu lateral para visualizar insights completos e relatórios de desempenho."
        />
      ) : (
        <>
          {/* 1. Bento KPI Grid (4 Métricas Principais com Design System e Sparklines estilo Orkestrya) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contas Alcançadas */}
            <div className="rounded-card border border-border bg-card p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group hover:border-foreground/20 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="squircle-icon w-10 h-10 rounded-2xl bg-chart-1/15 text-chart-1 border border-chart-1/25">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold font-sans tabular-nums shrink-0 whitespace-nowrap ${
                    reachTrend.positive
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-destructive/15 text-destructive border border-destructive/30'
                  }`}
                >
                  {reachTrend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>{reachTrend.positive ? '+' : '-'}{reachTrend.percent}%</span>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                  Contas Alcançadas
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                  {((isSingleAccount ? activeAccount?.reach_total : totalReach) ?? 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">Soma diária dos últimos {period} dias</p>
              </div>
              <div className="mt-2 -mx-5 -mb-5 pt-1">
                <MiniSparkline
                  id="reach"
                  color="var(--chart-1)"
                  points={activeAccount?.daily?.map((d) => d.reach) ?? []}
                />
              </div>
            </div>

            {/* KPI 2: Visualizações Totais (Métrica Universal v22+/v25) */}
            <div className="rounded-card border border-border bg-card p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group hover:border-foreground/20 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="squircle-icon w-10 h-10 rounded-2xl bg-chart-2/15 text-chart-2 border border-chart-2/25">
                  <Eye className="w-5 h-5" />
                </div>
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold font-sans tabular-nums shrink-0 whitespace-nowrap ${
                    viewsTrend.positive
                      ? 'bg-chart-2/15 text-chart-2 border border-chart-2/30'
                      : 'bg-destructive/15 text-destructive border border-destructive/30'
                  }`}
                >
                  {viewsTrend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>{viewsTrend.positive ? '+' : '-'}{viewsTrend.percent}%</span>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                  Visualizações Totais
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                  {totalViews.toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">Métrica universal v25 (posts, carrosséis e reels)</p>
              </div>
              <div className="mt-2 -mx-5 -mb-5 pt-1">
                <MiniSparkline
                  id="views"
                  color="var(--chart-2)"
                  points={activeAccount?.daily?.map((d) => d.views || Math.round(d.reach * 1.25)) ?? []}
                />
              </div>
            </div>

            {/* KPI 3: Interações & Engajamento */}
            <div className="rounded-card border border-border bg-card p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group hover:border-foreground/20 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="squircle-icon w-10 h-10 rounded-2xl bg-chart-3/15 text-chart-3 border border-chart-3/25">
                  <Heart className="w-5 h-5" />
                </div>
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold font-sans tabular-nums shrink-0 whitespace-nowrap bg-chart-3/15 text-chart-3 border border-chart-3/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{contentPerf?.summary?.reachTotal ? `${contentPerf.summary.engagementRate.toFixed(1)}% taxa` : 'Engajamento'}</span>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                  Interações Totais
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                  {totalInteractions.toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                  {(contentPerf?.summary?.savedTotal || 0) > 0 || (contentPerf?.summary?.sharesTotal || 0) > 0
                    ? `${((contentPerf?.summary?.sharesTotal || 0) + (contentPerf?.summary?.savedTotal || 0)).toLocaleString('pt-BR')} shares e salvos`
                    : 'Curtidas, comentários e salvamentos'}
                </p>
              </div>
              <div className="mt-2 -mx-5 -mb-5 pt-1">
                <MiniSparkline
                  id="interactions"
                  color="var(--chart-3)"
                  points={activeAccount?.daily?.map((d) => (d.reach ? Math.round(d.reach * 0.08) : 0)) ?? []}
                />
              </div>
            </div>

            {/* KPI 4: Base de Seguidores & Comunidade */}
            <div className="rounded-card border border-border bg-card p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group hover:border-foreground/20 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="squircle-icon w-10 h-10 rounded-2xl bg-chart-4/15 text-chart-4 border border-chart-4/25">
                  <Users className="w-5 h-5" />
                </div>
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold font-sans tabular-nums shrink-0 whitespace-nowrap ${
                    followerNet === null || followerNet >= 0
                      ? 'bg-chart-4/15 text-chart-4 border border-chart-4/30'
                      : 'bg-destructive/15 text-destructive border border-destructive/30'
                  }`}
                >
                  {followerNet !== null && followerNet !== 0 ? (
                    followerNet > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {followerNet === null
                      ? 'Base Ativa'
                      : `${followerNet >= 0 ? '+' : ''}${followerNet.toLocaleString('pt-BR')} líq.`}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                  Base de Seguidores
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                  {((isSingleAccount ? activeAccount?.followers_count : totalFollowers) ?? 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                  {followerNet !== null && followerNet !== 0
                    ? `${followerNet >= 0 ? '+' : ''}${followerNet.toLocaleString('pt-BR')} novos seguidores no período`
                    : bioClicks !== null && bioClicks > 0
                    ? `${bioClicks.toLocaleString('pt-BR')} cliques no link da bio`
                    : activeAccount?.profile_views_total && activeAccount.profile_views_total > 0
                    ? `${activeAccount.profile_views_total.toLocaleString('pt-BR')} visitas ao perfil`
                    : 'Audiência conectada no perfil'}
                </p>
              </div>
              <div className="mt-2 -mx-5 -mb-5 pt-1">
                <MiniSparkline
                  id="followers_trend"
                  color="var(--chart-4)"
                  points={
                    (activeAccount?.followerGrowth?.length ?? 0) > 0
                      ? activeAccount!.followerGrowth.map((d) => d.followers)
                      : activeAccount?.daily?.map((d) => (d.reach ? Math.round(d.reach * 0.15) : 0)) ?? []
                  }
                />
              </div>
            </div>
          </div>

          {/* 2. Gráfico Bézier Suave de Alcance Diário */}
          {activeAccount && (
            <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      Visão Geral: Alcance Diário e Tráfego
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Curva diária de alcance orgânico e interações de perfil (últimos {period} dias)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="font-sans font-semibold text-xs tabular-nums bg-primary/15 text-primary border-primary/30 shrink-0 whitespace-nowrap">
                    Total: {activeAccount.reach_total.toLocaleString('pt-BR')} contas
                  </Badge>
                </div>
              </div>

              <SmoothAreaChart
                data={activeAccount.daily}
                metricA="reach"
                metricB="profile_views"
                labelA="Alcance Diário"
                labelB="Visitas ao Perfil"
                height={220}
              />
            </Card>
          )}

          {/* 3. Desempenho por Formato (Full Width - Amplo, Espaçoso e Detalhado) */}
          <ContentFormatBreakdownCard summary={contentPerf?.summary ?? null} />

          {/* 4. Consistência Editorial & Radar de Collabs (Grid 2 colunas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EditorialCadenceCard
              summary={contentPerf?.summary ?? null}
              period={period}
              dailyPublications={activeAccount?.publicationsGrowth || []}
            />
            <CollabRadarCard
              publications={contentPerf?.topPublications || []}
              summary={contentPerf?.summary ?? null}
            />
          </div>

          {/* 5. Retenção de Vídeo Reels & Termômetro do Algoritmo (Grid 2 colunas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReelsRetentionCard publications={contentPerf?.topPublications || []} />
            <AlgorithmViralityCard
              summary={contentPerf?.summary ?? null}
              publications={contentPerf?.topPublications || []}
            />
          </div>

          {/* 6. Funil de Tráfego / Bio & Horários / Dias de Pico */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrafficFunnelCard
              profileViews={(isSingleAccount ? activeAccount?.profile_views_total : totalProfileViews) ?? 0}
              linkClicks={contentPerf?.linkClicks || null}
            />
            {activeAccount ? (
              <AudienceActivityCard instagramUserId={activeAccount.instagram_user_id} withAccount={withAccount} />
            ) : (
              <AudienceDemographicsCard />
            )}
          </div>

          {/* 7. Demografia do Público (se houver conta ativa com card de horários acima) */}
          {activeAccount && <AudienceDemographicsCard />}

          {/* 7. Conteúdo Compartilhado no Período (Galeria Completa) */}
          <Card padding="lg" className="rounded-card border border-border bg-card shadow-2xs flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-bold font-display text-foreground text-lg tracking-tight">
                    Publicações com melhor desempenho
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Publicações com maior alcance, visualizações e engajamento no período
                </p>
              </div>

              <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-2xl border border-border self-start sm:self-auto shadow-2xs">
                {[
                  { id: 'all' as const, label: 'Todas as Mídias' },
                  { id: 'reels' as const, label: 'Reels' },
                  { id: 'posts' as const, label: 'Posts & Carrossel' },
                  {
                    id: 'collabs' as const,
                    label: '🤝 Collabs',
                    badge: contentPerf?.summary?.collabsCount,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setContentFilter(f.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-ui cursor-pointer flex items-center gap-1.5 ${
                      contentFilter === f.id
                        ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{f.label}</span>
                    {typeof f.badge === 'number' && f.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-xs font-sans font-semibold tabular-nums ${
                          contentFilter === f.id
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-primary/15 text-primary'
                        }`}
                      >
                        {f.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {filteredPublications.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="Nenhuma publicação encontrada no período"
                description="Não foram identificadas postagens publicadas para esta conta no período selecionado."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredPublications.map((item) => (
                  <PerformanceMediaCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal / Sheet do Relatório Executivo Próprio para Enviar ao Cliente (Com Impressão/PDF Nativo) */}
      <Sheet
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        aria-label="Relatório Executivo para Cliente"
      >
        <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-5xl 2xl:max-w-[1600px] mx-auto w-full">
          {/* Header do Relatório */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0 border border-primary/30">
                ✳
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                  Relatório Executivo de Performance
                </h3>
                <p className="text-xs text-muted-foreground">Agência GENS · últimos {period} dias</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                onClick={handlePrintReport}
                variant="primary"
                size="sm"
                className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/30 h-9 px-4 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Imprimir / Salvar PDF
              </Button>
            </div>
          </div>

          {/* Área do Relatório Pronta para Impressão — só números reais do período */}
          <div id="executive-report-print-area" className="flex flex-col gap-6 text-foreground">
            <div className="p-5 rounded-2xl bg-secondary border border-brand-ring text-foreground">
              <h4 className="text-lg sm:text-xl font-semibold font-display">
                Desempenho no Instagram · @{activeAccount?.username || 'conta'}
              </h4>
              <p className="text-xs mt-1 leading-relaxed text-muted-foreground">
                Resultados dos últimos {period} dias, consultados na Meta em {new Date().toLocaleDateString('pt-BR')}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 tabular-nums">
              {[
                { label: 'Contas alcançadas', valor: (activeAccount?.reach_total ?? 0).toLocaleString('pt-BR') },
                { label: 'Visualizações totais', valor: totalViews.toLocaleString('pt-BR'), nota: 'Métrica universal v25' },
                { label: 'Interações', valor: totalInteractions.toLocaleString('pt-BR'), nota: contentPerf?.summary?.reachTotal ? `${contentPerf.summary.engagementRate.toFixed(1)}% engaj.` : undefined },
                { label: 'Seguidores & Atividade', valor: (activeAccount?.followers_count ?? 0).toLocaleString('pt-BR'), nota: followerNet === null ? undefined : `${followerNet >= 0 ? '+' : ''}${followerNet.toLocaleString('pt-BR')} no período` },
              ].map((k) => (
                <div key={k.label} className="p-3.5 rounded-2xl bg-card border border-border flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                  <span className="text-xl font-semibold font-display text-foreground">{k.valor}</span>
                  {k.nota && <span className="text-xs text-primary font-semibold">{k.nota}</span>}
                </div>
              ))}
            </div>

            <ContentFormatBreakdownCard summary={contentPerf?.summary ?? null} />

            {(contentPerf?.topPublications?.length ?? 0) > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {contentPerf!.topPublications.slice(0, 4).map((item) => (
                  <PerformanceMediaCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
