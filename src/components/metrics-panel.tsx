'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Image as ImageIcon,
  Eye,
  TrendingUp,
  AlertCircle,
  Info,
  Clock,
  ExternalLink,
  Sparkles,
  ArrowUpRight,
  Video,
  Clapperboard,
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Instagram as InstagramIcon } from '@/components/instagram-icon';

// --- Interfaces de Tipagem ---
interface DailyPoint {
  date: string;
  reach: number;
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
}

interface ContentPerformance {
  summary: {
    posts: number;
    reels: number;
    stories: number;
    reachTotal: number;
    engagementRate: number;
  };
  topPublications: PublicationItem[];
  topStories: {
    id: string;
    media_url: string;
    published_at: string;
    reach: number;
  }[];
}

const PERIOD_OPTIONS: { value: 7 | 30 | 90; label: string; daysLabel: string }[] = [
  { value: 7, label: '7 dias', daysLabel: 'Últimos 7 dias' },
  { value: 30, label: '30 dias', daysLabel: 'Últimos 30 dias' },
  { value: 90, label: '90 dias', daysLabel: 'Últimos 90 dias' },
];

/** Gráfico de Curva Suave Bézier (Spline) com Gradiente e Hover Tooltip */
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
      <div className="h-44 w-full flex items-center justify-center text-xs text-muted-foreground bg-accent/20 rounded-2xl border border-dashed border-border/80">
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
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="metrics-spline-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8ff3c" stopOpacity="0.45" />
              <stop offset="65%" stopColor="#d8ff3c" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#d8ff3c" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Sutis */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="var(--border)"
            strokeOpacity={0.4}
            strokeDasharray="3,3"
          />
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="var(--border)"
            strokeOpacity={0.4}
            strokeDasharray="3,3"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="var(--border)"
            strokeOpacity={0.6}
          />

          {/* Área Gradiente */}
          <path d={areaA} fill="url(#metrics-spline-grad)" />

          {/* Curva Principal (Alcance) */}
          <path
            d={lineA}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />

          {/* Curva Secundária (Visitas) */}
          <path
            d={lineB}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="4,4"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />

          {/* Ponto e Guia no Hover */}
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
              <circle
                cx={pointsA[hoverIndex].x}
                cy={pointsA[hoverIndex].y}
                r={4.5}
                fill="var(--foreground)"
                stroke="#d8ff3c"
                strokeWidth={2}
              />
              {pointsB[hoverIndex] && (
                <circle
                  cx={pointsB[hoverIndex].x}
                  cy={pointsB[hoverIndex].y}
                  r={3.5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              )}
            </>
          )}

          {/* Captura de mouse invisível */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            className="cursor-crosshair"
          />
        </svg>

        {/* Tooltip Flutuante */}
        {hoverIndex !== null && pointsA[hoverIndex] && (
          <div
            className="absolute top-2 z-30 pointer-events-none -translate-x-1/2 bg-card/95 backdrop-blur-md border border-border px-3 py-2 rounded-xl shadow-xl text-xs flex flex-col gap-1 min-w-[150px]"
            style={{
              left: `${(pointsA[hoverIndex].x / width) * 100}%`,
            }}
          >
            <span className="text-[10px] text-muted-foreground font-mono font-bold">
              {new Date(pointsA[hoverIndex].date + 'T00:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
            <div className="flex items-center justify-between gap-3 text-foreground font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground" />
                {labelA}:
              </span>
              <span className="font-mono">{pointsA[hoverIndex].val.toLocaleString('pt-BR')}</span>
            </div>
            {pointsB[hoverIndex] && (
              <div className="flex items-center justify-between gap-3 text-emerald-500 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {labelB}:
                </span>
                <span className="font-mono">{pointsB[hoverIndex].val.toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legenda do Gráfico */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-foreground rounded-full" />
            <span className="font-semibold text-foreground">{labelA}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-emerald-500 border-dashed rounded-full" />
            <span className="font-medium text-muted-foreground">{labelB}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          Passe o mouse na linha para inspecionar o dia
        </span>
      </div>
    </div>
  );
}

/** Gráfico de Crescimento de Seguidores */
function FollowersGrowthChart({ points }: { points: FollowerPoint[] }) {
  if (!points || points.length === 0) {
    return (
      <div className="h-36 w-full flex items-center justify-center text-xs text-muted-foreground bg-accent/20 rounded-2xl border border-dashed border-border/80">
        Sem dados de seguidores suficientes da Meta no período.
      </div>
    );
  }

  const width = 720;
  const height = 150;
  const paddingX = 20;
  const paddingY = 20;

  const vals = points.map((p) => p.followers);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const diff = maxVal - minVal || 1;

  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: paddingX + i * stepX,
    y: height - paddingY - ((p.followers - minVal) / diff) * (height - paddingY * 2),
    followers: p.followers,
    date: p.date,
  }));

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative w-full select-none" style={{ height }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border)" strokeOpacity={0.3} strokeDasharray="3,3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeOpacity={0.5} />
          <path d={path} fill="none" stroke="#3b82f6" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={3} fill="#3b82f6" stroke="var(--card)" strokeWidth={1.5} />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
        <span>Início: {points[0]?.followers.toLocaleString('pt-BR')} seg</span>
        <span className="font-bold text-foreground">Atual: {points[points.length - 1]?.followers.toLocaleString('pt-BR')} seg</span>
      </div>
    </div>
  );
}

/** Card de Quando seu público está mais ativo (Heatmap 24h) */
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
    reason?: string;
  }>({
    loading: true,
    available: false,
    byHour: [],
  });

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetch(withAccount(`/api/instagram/audience-activity?account=${instagramUserId}`, instagramUserId))
      .then((res) => res.json())
      .then((data) =>
        setState({
          loading: false,
          available: !!data.available,
          byHour: data.byHour || [],
          reason: data.reason,
        })
      )
      .catch(() => setState({ loading: false, available: false, byHour: [] }));
  }, [instagramUserId]);

  if (state.loading) {
    return (
      <Card padding="md" className="rounded-3xl border border-border/70 animate-pulse">
        <div className="h-24 bg-accent/40 rounded-2xl" />
      </Card>
    );
  }

  const peakHour =
    state.byHour.length > 0
      ? state.byHour.reduce((max, h) => (h.followersOnline > max.followersOnline ? h : max), state.byHour[0])
      : null;

  return (
    <Card padding="lg" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold font-display text-foreground">
              Quando Seu Público Está Mais Ativo
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Métrica oficial da Meta (seguidores conectados por hora do dia de 0h às 23h)
          </p>
        </div>

        {peakHour && state.available && (
          <Badge variant="info" className="text-[10px] font-bold self-start sm:self-auto py-1 px-2.5">
            Horário de Pico: {peakHour.hour}:00h ({peakHour.followersOnline.toLocaleString('pt-BR')} online)
          </Badge>
        )}
      </div>

      {!state.available ? (
        <div className="p-4 rounded-2xl bg-accent/30 border border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p>{state.reason || 'A Meta exige um volume mínimo de seguidores para liberar este mapa de atividade.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-end gap-1 sm:gap-1.5 h-28 w-full pt-4">
            {state.byHour.map((h) => {
              const max = Math.max(1, ...state.byHour.map((x) => x.followersOnline));
              const heightPercent = Math.max(8, (h.followersOnline / max) * 100);
              const isPeak = peakHour && h.hour === peakHour.hour;

              return (
                <div
                  key={h.hour}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  title={`${h.hour}h: ${h.followersOnline.toLocaleString('pt-BR')} seguidores online`}
                >
                  <div
                    className={`w-full rounded-t-md transition-all duration-200 ${
                      isPeak
                        ? 'bg-primary shadow-xs ring-1 ring-primary'
                        : 'bg-accent-foreground/20 hover:bg-accent-foreground/40'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  {h.hour % 3 === 0 && (
                    <span className="text-[9px] text-muted-foreground font-mono mt-1.5">
                      {h.hour}h
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground mt-1">
            Recomendação da Agência: programe publicações cerca de 45 a 60 minutos antes do horário de pico para maximizar a entrega orgânica do algoritmo.
          </p>
        </div>
      )}
    </Card>
  );
}

/** Card de Publicação Compartilhada */
function PerformanceMediaCard({ item }: { item: PublicationItem }) {
  const isVideo = item.media_type === 'VIDEO' || item.media_type === 'REELS';
  const isCarousel = item.media_type === 'CAROUSEL' || item.media_type === 'CAROUSEL_ALBUM';

  const engRate = item.reach > 0 ? ((item.interactions / item.reach) * 100).toFixed(1) : null;

  return (
    <div className="group rounded-2xl border border-border/70 bg-card overflow-hidden flex flex-col hover:border-foreground/30 hover:shadow-md transition-all duration-200">
      {/* Mídia Thumbnail */}
      <div className="relative aspect-square w-full bg-accent overflow-hidden">
        {item.media_url || item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url || item.media_url}
            alt={item.caption || 'Publicação'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-8 h-8 opacity-40" />
          </div>
        )}

        {/* Formato Badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
            {isVideo ? <Video className="w-2.5 h-2.5" /> : isCarousel ? <ImageIcon className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
            {isVideo ? 'Reels' : isCarousel ? 'Carrossel' : 'Post'}
          </span>
        </div>

        {/* Taxa de Engajamento Badge */}
        {engRate && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-bold font-mono">
              {engRate}% engaj.
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo & Métricas */}
      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground font-mono">
            {new Date(item.published_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="text-xs font-semibold text-foreground line-clamp-2 mt-1 leading-snug">
            {item.caption || 'Sem legenda'}
          </p>
        </div>

        {/* Métricas do Post */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[11px]">
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground font-medium uppercase">Alcance</span>
            <span className="font-bold text-foreground font-mono">
              {item.reach.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground font-medium uppercase">Interações</span>
            <span className="font-bold text-foreground font-mono">
              {item.interactions.toLocaleString('pt-BR')}
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

/** Painel Profissional de Métricas do Instagram */
export default function MetricsPanel({ selectedAccountId, withAccount }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<AccountMetrics[]>([]);
  const [contentPerf, setContentPerf] = useState<ContentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [contentFilter, setContentFilter] = useState<'all' | 'reels' | 'posts'>('all');

  const isSingleAccount = selectedAccountId && selectedAccountId !== 'all';

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

  // Conta principal em foco
  const activeAccount = metrics[0] || null;

  // Publicações filtradas por formato
  const filteredPublications = useMemo(() => {
    const list = contentPerf?.topPublications || [];
    if (contentFilter === 'reels') {
      return list.filter((p) => p.media_type === 'VIDEO' || p.media_type === 'REELS');
    }
    if (contentFilter === 'posts') {
      return list.filter((p) => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL' || p.media_type === 'CAROUSEL_ALBUM');
    }
    return list;
  }, [contentPerf, contentFilter]);

  // Totais agregados (se multi-contas)
  const totalReach = useMemo(() => metrics.reduce((acc, m) => acc + (m.reach_total || 0), 0), [metrics]);
  const totalProfileViews = useMemo(() => metrics.reduce((acc, m) => acc + (m.profile_views_total || 0), 0), [metrics]);
  const totalFollowers = useMemo(() => metrics.reduce((acc, m) => acc + (m.followers_count || 0), 0), [metrics]);
  const totalInteractions = useMemo(() => {
    return (contentPerf?.topPublications || []).reduce((acc, p) => acc + (p.interactions || 0), 0);
  }, [contentPerf]);

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fade-in">
      {/* Header do Painel Profissional com Filtros 7d / 30d / 90d */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-2xs">
              <InstagramIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
                Painel Profissional
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Métricas oficiais do Instagram: alcance, retenção de público e desempenho de mídia
              </p>
            </div>
          </div>
        </div>

        {/* Switcher de Período Oficial Meta: 7, 30 e 90 dias */}
        <div className="flex items-center gap-1.5 bg-accent/40 p-1.5 rounded-2xl border border-border/80 self-start sm:self-auto shadow-2xs">
          {PERIOD_OPTIONS.map((opt) => {
            const isSelected = period === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
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
          {/* 1. Bento KPI Grid (4 Métricas Principais do Instagram) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contas Alcançadas */}
            <Card padding="md" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Contas Alcançadas
                </span>
                <div className="w-8 h-8 rounded-xl bg-lime/15 text-primary flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {(isSingleAccount ? activeAccount?.reach_total : totalReach)?.toLocaleString('pt-BR') || 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                  <span className="text-emerald-500 font-bold font-mono">+{period}d</span>
                  <span>visibilidade única no período</span>
                </p>
              </div>
            </Card>

            {/* KPI 2: Contas com Engajamento */}
            <Card padding="md" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Interações Totais
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {totalInteractions.toLocaleString('pt-BR')}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                  <span className="text-foreground font-semibold">
                    {contentPerf?.summary?.engagementRate ? `${contentPerf.summary.engagementRate.toFixed(1)}%` : '—'}
                  </span>
                  <span>taxa média de engajamento</span>
                </p>
              </div>
            </Card>

            {/* KPI 3: Total de Seguidores */}
            <Card padding="md" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Total de Seguidores
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {(isSingleAccount ? activeAccount?.followers_count : totalFollowers)?.toLocaleString('pt-BR') || '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                  <span className="text-blue-500 font-bold">Oficial</span>
                  <span>base conectada ao perfil</span>
                </p>
              </div>
            </Card>

            {/* KPI 4: Visitas ao Perfil */}
            <Card padding="md" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Visitas ao Perfil
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {(isSingleAccount ? activeAccount?.profile_views_total : totalProfileViews)?.toLocaleString('pt-BR') || 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                  <span>Toques para ver a bio e links</span>
                </p>
              </div>
            </Card>
          </div>

          {/* 2. Gráfico Bézier Suave de Alcance e Visitas ao Perfil */}
          {activeAccount && (
            <Card padding="lg" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      Visão Geral: Alcance e Visitas ao Perfil
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Curva diária de alcance orgânico e tráfego direcionado à bio ({period} dias)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="font-mono text-[10px]">
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

          {/* 3. Crescimento de Seguidores & Horários Mais Ativos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Seguidores */}
            {activeAccount && (
              <Card padding="lg" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-bold font-display text-foreground">
                        Crescimento de Seguidores
                      </h4>
                    </div>
                    {activeAccount.followers_count && (
                      <span className="text-xs font-mono font-bold text-foreground">
                        {activeAccount.followers_count.toLocaleString('pt-BR')} seg
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evolução líquida da base de seguidores no Instagram
                  </p>
                </div>

                {activeAccount.followerGrowthUnavailable ? (
                  <div className="p-4 rounded-2xl bg-accent/30 border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p>
                      A Meta exige no mínimo 100 seguidores na conta profissional para fornecer o histórico diário de crescimento.
                    </p>
                  </div>
                ) : (
                  <FollowersGrowthChart points={activeAccount.followerGrowth} />
                )}
              </Card>
            )}

            {/* Horários Mais Ativos (Heatmap 24h) */}
            {activeAccount && (
              <AudienceActivityCard
                instagramUserId={activeAccount.instagram_user_id}
                withAccount={withAccount}
              />
            )}
          </div>

          {/* 4. Conteúdo Compartilhado no Período (Posts, Reels e Stories com Métricas) */}
          <Card padding="lg" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-bold font-display text-foreground text-lg tracking-tight">
                    Conteúdo que Você Compartilhou
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Publicações recentes no Instagram com alcance e engajamento oficial da Meta
                </p>
              </div>

              {/* Filtro por Formato */}
              <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-2xl border border-border/80 self-start sm:self-auto shadow-2xs">
                {[
                  { id: 'all' as const, label: 'Todas as Mídias' },
                  { id: 'reels' as const, label: 'Reels' },
                  { id: 'posts' as const, label: 'Posts & Carrossel' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setContentFilter(f.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      contentFilter === f.id
                        ? 'bg-card text-foreground font-bold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredPublications.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="Nenhuma publicação encontrada no período"
                description={`Não foram identificadas postagens publicadas nos últimos ${period} dias para esta conta.`}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredPublications.map((item) => (
                  <PerformanceMediaCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
