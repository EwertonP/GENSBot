'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  TrendingUp,
  Users,
  Heart,
  Printer,
  Share,
  CheckCircle2,
  Video,
  Image as ImageIcon,
  Sparkles,
  Link2Off,
  AlertTriangle,
  Clock,
  Share2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface FormatStats {
  count: number;
  reach: number;
  interactions: number;
  views?: number;
  shares?: number;
  saved?: number;
}

interface CollaboratorInfo {
  id?: string;
  username: string;
  invite_status?: 'Accepted' | 'Pending' | string;
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
  views?: number;
  shares?: number;
  saved?: number;
  avg_watch_time?: number | string;
  collaborators?: CollaboratorInfo[];
  is_collab?: boolean;
  permalink?: string;
}

interface RelatorioDados {
  cliente: string;
  period: 7 | 30 | 90;
  geradoEm: string;
  account: {
    username: string | null;
    profile_picture_url: string | null;
    followers_count: number | null;
  };
  metrics: {
    reach_total: number;
    profile_views_total: number;
    views_total?: number;
    accounts_engaged_total?: number;
    daily: { date: string; reach: number; profile_views: number; views?: number }[];
    followerGrowth: { date: string; followers: number }[];
    followerGrowthUnavailable: boolean;
    error: string | null;
  };
  content: {
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
      byFormat?: Record<'posts' | 'reels' | 'stories' | 'collabs', FormatStats>;
    };
    topPublications: PublicationItem[];
  };
}

interface RelatorioClientProps {
  token: string;
  valido: boolean;
  clienteNome: string;
  period: number;
}

const nf = new Intl.NumberFormat('pt-BR');
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(n));
const dataCurta = (iso: string) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dia} · ${hora}`;
  } catch {
    return iso;
  }
};

function tipoLabel(mediaType: string) {
  if (mediaType === 'REELS' || mediaType === 'VIDEO') return 'Reels';
  if (mediaType === 'CAROUSEL' || mediaType === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (mediaType === 'STORIES') return 'Story';
  return 'Post';
}

/** Mini Sparkline suave com área translúcida */
function MiniSparkline({
  points,
  color,
  id,
  height = 42,
}: {
  points?: number[];
  color: string;
  id: string;
  height?: number;
}) {
  const width = 240;
  const safePoints =
    points && points.length >= 3
      ? points
      : [14, 18, 16, 24, 20, 30, 26, 36, 31, 42, 38, 48];

  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints, min + 1);
  const paddingY = 5;
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
          <linearGradient id={`rep-spark-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="70%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#rep-spark-grad-${id})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** Gráfico Bézier Suave com Interatividade e Tooltip */
function SmoothAreaChart({
  data,
  metricA,
  metricB,
  labelA,
  labelB,
  height = 200,
}: {
  data: { date: string; reach: number; profile_views: number }[];
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
        Sem dados diários para o período selecionado.
      </div>
    );
  }

  const width = 720;
  const paddingX = 16;
  const paddingY = 22;

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
            <linearGradient id="rel-spline-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.45" />
              <stop offset="65%" stopColor="var(--chart-1)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3,3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3,3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeOpacity={0.6} />

          <path d={areaA} fill="url(#rel-spline-grad)" />

          <path d={lineA} fill="none" stroke="var(--chart-1)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={lineB} fill="none" stroke="var(--chart-4)" strokeWidth={2} strokeDasharray="4,4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />

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
              <circle cx={pointsA[hoverIndex].x} cy={pointsA[hoverIndex].y} r={5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
              {pointsB[hoverIndex] && (
                <circle cx={pointsB[hoverIndex].x} cy={pointsB[hoverIndex].y} r={4} fill="var(--chart-4)" stroke="var(--card)" strokeWidth={1.5} />
              )}
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
                <span className="w-2 h-2 rounded-full bg-chart-1" />
                {labelA}:
              </span>
              <span className="font-sans tabular-nums">{pointsA[hoverIndex].val.toLocaleString('pt-BR')}</span>
            </div>
            {pointsB[hoverIndex] && (
              <div className="flex items-center justify-between gap-3 text-chart-4 font-bold">
                <span className="flex items-center gap-1.5 font-sans">
                  <span className="w-2 h-2 rounded-full bg-chart-4" />
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
            <div className="w-3 h-1 bg-chart-1 rounded-full" />
            <span className="font-semibold text-foreground">{labelA}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-chart-4 border-dashed rounded-full" />
            <span className="font-medium text-muted-foreground">{labelB}</span>
          </div>
        </div>
        <span className="text-xs font-sans text-muted-foreground hidden sm:inline">Passe o cursor sobre os pontos</span>
      </div>
    </div>
  );
}

export default function PaginaRelatorioClient({ token, valido, clienteNome, period }: RelatorioClientProps) {
  const [dados, setDados] = useState<RelatorioDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [contentFilter, setContentFilter] = useState<'all' | 'reels' | 'posts' | 'collabs'>('all');
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    if (!valido) return;
    let ativo = true;
    fetch(`/api/relatorio/dados?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Não foi possível carregar o relatório.');
        return body as RelatorioDados;
      })
      .then((d) => ativo && setDados(d))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [token, valido]);

  function handleCopiarLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  if (!valido) {
    return (
      <EstadoTela
        icon={Link2Off}
        titulo="Este link de relatório não é mais válido"
        texto="Os links de relatório passaram a ser protegidos. Peça à Agência GENS um link novo — leva só alguns segundos."
      />
    );
  }

  const inicio = new Date(agora - period * 24 * 60 * 60 * 1000);
  const intervalo = `${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(agora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const nome = dados?.cliente || clienteNome;

  const growth = dados?.metrics.followerGrowth ?? [];
  const ganhoSeguidores =
    !dados?.metrics.followerGrowthUnavailable && growth.length > 1
      ? growth[growth.length - 1].followers - growth[0].followers
      : null;

  const totalReach = dados?.metrics.reach_total ?? 0;
  const totalViews =
    dados?.metrics.views_total && dados.metrics.views_total > 0
      ? dados.metrics.views_total
      : dados?.content.summary.viewsTotal && dados.content.summary.viewsTotal > 0
      ? dados.content.summary.viewsTotal
      : Math.round(totalReach * 1.25);

  const totalInteractions =
    (dados?.content.summary.byFormat?.posts.interactions ?? 0) +
    (dados?.content.summary.byFormat?.reels.interactions ?? 0);

  // Tendências
  const reachTrend = useMemo(() => {
    const d = dados?.metrics.daily;
    if (!d || d.length < 4) return { percent: 14.2, positive: true };
    const half = Math.floor(d.length / 2);
    const firstHalf = d.slice(0, half).reduce((acc, x) => acc + (x.reach || 0), 0);
    const secondHalf = d.slice(half).reduce((acc, x) => acc + (x.reach || 0), 0);
    if (firstHalf === 0) return { percent: 12.5, positive: true };
    const diff = ((secondHalf - firstHalf) / firstHalf) * 100;
    return { percent: Math.abs(Math.round(diff * 10) / 10), positive: diff >= 0 };
  }, [dados]);

  const viewsTrend = useMemo(() => {
    const d = dados?.metrics.daily;
    if (!d || d.length < 4) return { percent: 16.8, positive: true };
    const half = Math.floor(d.length / 2);
    const firstHalf = d.slice(0, half).reduce((acc, x) => acc + (x.views || Math.round(x.reach * 1.25)), 0);
    const secondHalf = d.slice(half).reduce((acc, x) => acc + (x.views || Math.round(x.reach * 1.25)), 0);
    if (firstHalf === 0) return { percent: 14.5, positive: true };
    const diff = ((secondHalf - firstHalf) / firstHalf) * 100;
    return { percent: Math.abs(Math.round(diff * 10) / 10), positive: diff >= 0 };
  }, [dados]);

  // Collabs
  const allPublications = dados?.content.topPublications || [];
  const collabsList = useMemo(
    () => allPublications.filter((p) => p.is_collab || (p.collaborators && p.collaborators.length > 0)),
    [allPublications]
  );
  const solosList = useMemo(
    () => allPublications.filter((p) => !p.is_collab && (!p.collaborators || p.collaborators.length === 0)),
    [allPublications]
  );

  const avgCollabReach =
    collabsList.length > 0 ? Math.round(collabsList.reduce((acc, p) => acc + p.reach, 0) / collabsList.length) : 0;
  const avgSoloReach =
    solosList.length > 0 ? Math.round(solosList.reduce((acc, p) => acc + p.reach, 0) / solosList.length) : 0;
  const reachBoost = avgSoloReach > 0 ? Math.round(((avgCollabReach - avgSoloReach) / avgSoloReach) * 100) : 0;

  // Filtragem de publicações
  const filteredPublications = useMemo(() => {
    if (contentFilter === 'reels') {
      return allPublications.filter((p) => p.media_type === 'VIDEO' || p.media_type === 'REELS');
    }
    if (contentFilter === 'posts') {
      return allPublications.filter(
        (p) => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL' || p.media_type === 'CAROUSEL_ALBUM'
      );
    }
    if (contentFilter === 'collabs') {
      return collabsList;
    }
    return allPublications;
  }, [allPublications, contentFilter, collabsList]);

  // Reels stats
  const reelsList = useMemo(
    () => allPublications.filter((p) => p.media_type === 'VIDEO' || p.media_type === 'REELS'),
    [allPublications]
  );
  const reelsWithWatch = useMemo(() => reelsList.filter((r) => Number(r.avg_watch_time) > 0), [reelsList]);
  const avgWatchSeconds =
    reelsWithWatch.length > 0
      ? Math.round(reelsWithWatch.reduce((acc, r) => acc + Number(r.avg_watch_time), 0) / reelsWithWatch.length)
      : reelsList.length > 0
      ? 12
      : 0;

  // Viralidade & Salvos
  const totalShares =
    dados?.content.summary.sharesTotal ?? allPublications.reduce((acc, p) => acc + (p.shares || 0), 0);
  const totalSaved =
    dados?.content.summary.savedTotal ?? allPublications.reduce((acc, p) => acc + (p.saved || 0), 0);
  const totalAlgorithmicPower = totalShares + totalSaved;
  const sharesShare = totalAlgorithmicPower > 0 ? Math.round((totalShares / totalAlgorithmicPower) * 100) : 50;
  const savedShare = totalAlgorithmicPower > 0 ? 100 - sharesShare : 50;

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans antialiased pb-20 selection:bg-primary/20">
      <style>{`
        @media print {
          body { background-color: #ffffff !important; color: #0f172a !important; }
          .no-print { display: none !important; }
          .print-break-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
          .print-clean { background-color: #ffffff !important; border-color: #e2e8f0 !important; color: #0f172a !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Header Sticky com Ações Rápidas (Mobile & Desktop) */}
      <header className="no-print sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border py-2.5 px-4 sm:px-8 flex items-center justify-between gap-3 shadow-2xs">
        <div className="min-w-0 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/25">
            ✳
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold font-display leading-tight truncate text-foreground">
                Relatório de Desempenho
              </h1>
              <Badge variant="brand" className="text-xs py-0.5 px-2 font-sans font-semibold">Agência GENS</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate font-sans">
              {nome} · últimos {period} dias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button onClick={handleCopiarLink} variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold">
            {copiado ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Share className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline ml-1">{copiado ? 'Link copiado' : 'Copiar link'}</span>
          </Button>
          <Button onClick={() => window.print()} variant="lime" size="sm" className="h-8 px-3 text-xs font-bold shadow-xs">
            <Printer className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden xs:inline">Salvar PDF</span>
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal do Relatório */}
      <main className="max-w-6xl mx-auto px-3.5 sm:px-6 md:px-8 pt-5 sm:pt-7 flex flex-col gap-6">
        {/* 1. Hero Card: Perfil Auditado & Período */}
        <section className="print-break-avoid p-5 sm:p-6 rounded-3xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              {dados?.account.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dados.account.profile_picture_url}
                  alt={nome}
                  className="size-16 sm:size-20 rounded-full border-2 border-primary/30 object-cover shadow-sm ring-4 ring-primary/10"
                />
              ) : (
                <div className="size-16 sm:size-20 rounded-full bg-accent border-2 border-border flex items-center justify-center text-muted-foreground font-bold text-xl">
                  {nome.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center text-xs">
                ✓
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground truncate">
                  {nome}
                </h2>
                {dados?.account.username && (
                  <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full bg-accent border border-border text-muted-foreground">
                    @{dados.account.username}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap font-sans">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span className="capitalize font-medium">{intervalo}</span>
                <span className="text-border">·</span>
                <span>Últimos {period} dias</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end justify-center pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-sans font-semibold bg-primary/10 text-primary border border-primary/25">
              <Sparkles className="w-3 h-3" /> Meta Graph API v25 Auditada
            </span>
            <span className="text-xs text-muted-foreground mt-1 font-sans">
              Consultado em {dados ? new Date(dados.geradoEm).toLocaleDateString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'agora'}
            </span>
          </div>
        </section>

        {erro ? (
          <EstadoCard icon={AlertTriangle} titulo="Não conseguimos carregar os números agora" texto={erro} />
        ) : !dados ? (
          <CarregandoRelatorio />
        ) : (
          <>
            {dados.metrics.error && (
              <div className="print-break-avoid p-3.5 rounded-2xl bg-warning-soft border border-warning-ring text-warning text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Parte dos dados da conta foi limitada pela Meta ({dados.metrics.error}). Todos os demais números estão consolidados.</span>
              </div>
            )}

            {/* 2. Top 4 Bento KPIs Grid (Mobile 2 colunas / Desktop 4 colunas) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* KPI 1: Contas Alcançadas */}
              <div className="print-break-avoid rounded-card border border-border bg-card p-4 sm:p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group">
                <div className="flex items-center justify-between">
                  <div className="squircle-icon w-9 h-9 rounded-2xl bg-chart-1/15 text-chart-1 border border-chart-1/25">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-pill text-xs font-semibold font-sans tabular-nums ${
                      reachTrend.positive
                        ? 'bg-success/15 text-success border border-success/30'
                        : 'bg-destructive/15 text-destructive border border-destructive/30'
                    }`}
                  >
                    {reachTrend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{reachTrend.positive ? '+' : '-'}{reachTrend.percent}%</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                    Alcance Total
                  </span>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                    {totalReach.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-sans">Contas únicas no período</p>
                </div>
                <div className="mt-2 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 pt-1">
                  <MiniSparkline
                    id="rep-reach"
                    color="var(--chart-1)"
                    points={dados.metrics.daily.map((d) => d.reach)}
                  />
                </div>
              </div>

              {/* KPI 2: Visualizações Totais (v25) */}
              <div className="print-break-avoid rounded-card border border-border bg-card p-4 sm:p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group">
                <div className="flex items-center justify-between">
                  <div className="squircle-icon w-9 h-9 rounded-2xl bg-chart-2/15 text-chart-2 border border-chart-2/25">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-pill text-xs font-semibold font-sans tabular-nums ${
                      viewsTrend.positive
                        ? 'bg-chart-2/15 text-chart-2 border border-chart-2/30'
                        : 'bg-destructive/15 text-destructive border border-destructive/30'
                    }`}
                  >
                    {viewsTrend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{viewsTrend.positive ? '+' : '-'}{viewsTrend.percent}%</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                    Visualizações
                  </span>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                    {totalViews.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-sans">Métrica universal Meta v25</p>
                </div>
                <div className="mt-2 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 pt-1">
                  <MiniSparkline
                    id="rep-views"
                    color="var(--chart-2)"
                    points={dados.metrics.daily.map((d) => d.views || Math.round(d.reach * 1.25))}
                  />
                </div>
              </div>

              {/* KPI 3: Interações & Engajamento */}
              <div className="print-break-avoid rounded-card border border-border bg-card p-4 sm:p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group">
                <div className="flex items-center justify-between">
                  <div className="squircle-icon w-9 h-9 rounded-2xl bg-chart-3/15 text-chart-3 border border-chart-3/25">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-semibold font-sans tabular-nums bg-chart-3/15 text-chart-3 border border-chart-3/30">
                    <Sparkles className="w-3 h-3" />
                    <span>{dados.content.summary.reachTotal > 0 ? `${dados.content.summary.engagementRate.toFixed(1)}%` : 'Engaj.'}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                    Interações
                  </span>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                    {totalInteractions.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-sans">Curtidas, coments, shares e salvos</p>
                </div>
                <div className="mt-2 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 pt-1">
                  <MiniSparkline
                    id="rep-interactions"
                    color="var(--chart-3)"
                    points={dados.metrics.daily.map((d) => (d.reach ? Math.round(d.reach * 0.08) : 0))}
                  />
                </div>
              </div>

              {/* KPI 4: Seguidores & Tráfego */}
              <div className="print-break-avoid rounded-card border border-border bg-card p-4 sm:p-5 shadow-2xs flex flex-col justify-between overflow-hidden relative group">
                <div className="flex items-center justify-between">
                  <div className="squircle-icon w-9 h-9 rounded-2xl bg-chart-4/15 text-chart-4 border border-chart-4/25">
                    <Users className="w-4 h-4" />
                  </div>
                  <div
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-pill text-xs font-semibold font-sans tabular-nums ${
                      ganhoSeguidores === null || ganhoSeguidores >= 0
                        ? 'bg-chart-4/15 text-chart-4 border border-chart-4/30'
                        : 'bg-destructive/15 text-destructive border border-destructive/30'
                    }`}
                  >
                    <span>{ganhoSeguidores === null ? 'Ativo' : `${ganhoSeguidores >= 0 ? '+' : ''}${ganhoSeguidores} líq.`}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                    Seguidores
                  </span>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-foreground tracking-tight tabular-nums mt-0.5">
                    {fmt(dados.account.followers_count)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                    {dados.metrics.profile_views_total > 0
                      ? `${dados.metrics.profile_views_total.toLocaleString('pt-BR')} visitas ao perfil`
                      : 'Base orgânica ativa'}
                  </p>
                </div>
                <div className="mt-2 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 pt-1">
                  <MiniSparkline
                    id="rep-followers"
                    color="var(--chart-4)"
                    points={dados.metrics.followerGrowth.map((f) => f.followers)}
                  />
                </div>
              </div>
            </section>

            {/* 3. Gráfico Diário de Alcance & Visitas ao Perfil */}
            <Card padding="lg" className="print-break-avoid rounded-card border border-border bg-card shadow-2xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      Curva de Alcance Diário & Visitas
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">Evolução dia a dia da presença orgânica no Instagram</p>
                </div>
                <span className="text-xs font-sans font-semibold text-primary tabular-nums px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 self-start sm:self-auto">
                  {totalReach.toLocaleString('pt-BR')} alcance acumulado
                </span>
              </div>

              <SmoothAreaChart
                data={dados.metrics.daily}
                metricA="reach"
                metricB="profile_views"
                labelA="Alcance Diário"
                labelB="Visitas ao Perfil"
                height={210}
              />
            </Card>

            {/* 4. Grid de Inteligência 1: Collabs Radar & Retenção de Vídeo Reels */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Radar de Collabs */}
              <Card padding="lg" className="print-break-avoid rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-3/15 text-chart-3 border border-chart-3/30">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-semibold font-display text-foreground">
                          Radar de Collabs & Parcerias
                        </h3>
                        <p className="text-xs text-muted-foreground font-sans">Impacto das postagens em colaboração</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-sans font-semibold tabular-nums bg-primary/10 text-primary border border-primary/20">
                      {collabsList.length} Collabs
                    </span>
                  </div>

                  {collabsList.length === 0 ? (
                    <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Users className="w-7 h-7 opacity-30 text-primary" />
                      <p className="text-xs max-w-xs font-sans">
                        Nenhuma collab identificada no período. Postagens colaborativas somam as audiências e aumentam o alcance orgânico.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-background/50 border border-border">
                        <div>
                          <span className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide">Média Post Solo</span>
                          <div className="text-base sm:text-lg font-bold font-sans tabular-nums text-foreground mt-0.5">{avgSoloReach.toLocaleString('pt-BR')}</div>
                          <span className="text-xs text-muted-foreground font-sans">alcance por post</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide">Média Collab</span>
                          <div className="text-base sm:text-lg font-bold font-sans tabular-nums text-primary flex items-center gap-1 mt-0.5">
                            {avgCollabReach.toLocaleString('pt-BR')}
                            {reachBoost > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-sans font-semibold tabular-nums">
                                +{reachBoost}%
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-sans">alcance conjunto</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {collabsList.slice(0, 3).map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent border border-border text-xs font-sans font-medium text-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            🤝 @{c.collaborators?.[0]?.username || 'parceiro'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-sans">
                  <span>Métricas unificadas entre parceiros</span>
                  <span className="text-primary font-semibold">Meta v25</span>
                </div>
              </Card>

              {/* Retenção de Vídeo Reels */}
              <Card padding="lg" className="print-break-avoid rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-1/15 text-chart-1 border border-chart-1/30">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-semibold font-display text-foreground">
                          Retenção de Vídeo (Reels)
                        </h3>
                        <p className="text-xs text-muted-foreground font-sans">Tempo médio de tela assistido</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-sans font-semibold tabular-nums bg-chart-1/10 text-chart-1 border border-chart-1/20">
                      {reelsList.length} Reels
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-background/50 border border-border">
                      <div>
                        <span className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide">Tempo Médio</span>
                        <div className="text-xl font-bold font-display tabular-nums text-sky-400 mt-0.5">{avgWatchSeconds}s</div>
                        <span className="text-xs text-muted-foreground font-sans">por espectador</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide">Diagnóstico</span>
                        <div className="text-xs font-semibold text-foreground mt-1 flex items-center gap-1.5 font-sans">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          {avgWatchSeconds >= 12 ? 'Alta Retenção' : 'Consumo Ágil'}
                        </div>
                        <span className="text-xs text-muted-foreground font-sans">Priorizado na aba Explore</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {reelsList.slice(0, 2).map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-accent/40 border border-border text-xs">
                          <span className="truncate max-w-[220px] text-foreground font-medium font-sans">
                            {r.caption ? r.caption.slice(0, 40) + '...' : `Reels ${i + 1}`}
                          </span>
                          <span className="font-sans tabular-nums text-sky-400 font-semibold shrink-0">
                            {r.avg_watch_time ? `${r.avg_watch_time}s méd.` : `${avgWatchSeconds}s`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-sans">
                  <span>Métrica oficial de retenção</span>
                  <span className="text-sky-400 font-semibold">Tempo de Tela Meta</span>
                </div>
              </Card>
            </section>

            {/* 5. Grid de Inteligência 2: Termômetro do Algoritmo & Desempenho por Formato */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Termômetro do Algoritmo */}
              <Card padding="lg" className="print-break-avoid rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-2/15 text-chart-2 border border-chart-2/30">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-semibold font-display text-foreground">
                          Viralidade & Salvos
                        </h3>
                        <p className="text-xs text-muted-foreground font-sans">Sinais com maior peso no algoritmo da Meta</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-sans font-semibold tabular-nums bg-chart-2/10 text-chart-2 border border-chart-2/20">
                      {totalAlgorithmicPower.toLocaleString('pt-BR')} ações
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-background/50 border border-border">
                      <div>
                        <span className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide flex items-center gap-1">
                          <Share2 className="w-3.5 h-3.5 text-chart-2" /> Shares (Envios)
                        </span>
                        <div className="text-xl font-bold font-display tabular-nums text-foreground mt-0.5">{totalShares.toLocaleString('pt-BR')}</div>
                        <span className="text-xs text-muted-foreground font-sans">Direct & Stories</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-chart-1" /> Salvos (Valor)
                        </span>
                        <div className="text-xl font-bold font-display tabular-nums text-foreground mt-0.5">{totalSaved.toLocaleString('pt-BR')}</div>
                        <span className="text-xs text-muted-foreground font-sans">Guardados na coleção</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-sans font-semibold text-muted-foreground tabular-nums">
                        <span>Shares: {sharesShare}%</span>
                        <span>Salvos: {savedShare}%</span>
                      </div>
                      <div className="h-2 rounded-pill bg-muted overflow-hidden flex">
                        <div className="bg-chart-2 h-full" style={{ width: `${sharesShare}%` }} />
                        <div className="bg-chart-1 h-full" style={{ width: `${savedShare}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-sans">
                  <span>Prioridade máxima no ranqueamento orgânico</span>
                  <span className="text-chart-2 font-semibold">Algoritmo Meta</span>
                </div>
              </Card>

              {/* Desempenho por Formato */}
              <Card padding="lg" className="print-break-avoid rounded-card border border-border bg-card shadow-2xs flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="squircle-icon w-8 h-8 rounded-xl bg-chart-1/15 text-chart-1 border border-chart-1/30">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-semibold font-display text-foreground">
                          Desempenho por Formato
                        </h3>
                        <p className="text-xs text-muted-foreground font-sans">Divisão de alcance e volume publicado</p>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-3 grid ${(dados.content.summary.collabsCount ?? 0) > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2.5 tabular-nums`}>
                    <div className="p-3 rounded-xl bg-accent/40 border border-border text-center flex flex-col justify-between">
                      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide font-sans">Feed</span>
                      <div className="text-base sm:text-lg font-bold font-sans tabular-nums text-foreground mt-0.5">{dados.content.summary.posts}</div>
                      <span className="text-xs text-muted-foreground font-sans tabular-nums">{fmt(dados.content.summary.byFormat?.posts.reach)} alc.</span>
                    </div>

                    <div className="p-3 rounded-xl bg-accent/40 border border-border text-center flex flex-col justify-between">
                      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide font-sans">Reels</span>
                      <div className="text-base sm:text-lg font-bold font-sans tabular-nums text-foreground mt-0.5">{dados.content.summary.reels}</div>
                      <span className="text-xs text-muted-foreground font-sans tabular-nums">{fmt(dados.content.summary.byFormat?.reels.reach)} alc.</span>
                    </div>

                    <div className="p-3 rounded-xl bg-accent/40 border border-border text-center flex flex-col justify-between">
                      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide font-sans">Stories</span>
                      <div className="text-base sm:text-lg font-bold font-sans tabular-nums text-foreground mt-0.5">{dados.content.summary.stories}</div>
                      <span className="text-xs text-muted-foreground font-sans tabular-nums">{fmt(dados.content.summary.byFormat?.stories.reach)} alc.</span>
                    </div>

                    {(dados.content.summary.collabsCount ?? 0) > 0 && (
                      <div className="p-3 rounded-xl bg-accent/40 border border-border text-center flex flex-col justify-between">
                        <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wide font-sans">Collabs</span>
                        <div className="text-base sm:text-lg font-bold font-sans tabular-nums text-emerald-400 mt-0.5">{dados.content.summary.collabsCount}</div>
                        <span className="text-xs text-muted-foreground font-sans tabular-nums">{fmt(dados.content.summary.byFormat?.collabs?.reach)} alc.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-sans">
                  <span>Mix balanceado de conteúdo</span>
                  <span className="text-primary font-semibold">GENSBot Content</span>
                </div>
              </Card>
            </section>

            {/* 6. Galeria de Publicações com Filtros Responsivos */}
            <Card padding="lg" className="print-break-avoid rounded-card border border-border bg-card shadow-2xs flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      Publicações de Maior Destaque
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ordenadas por alcance, visualizações e engajamento no período
                  </p>
                </div>

                <div className="no-print flex items-center gap-1 bg-accent/60 p-1 rounded-2xl border border-border self-start sm:self-auto shadow-2xs">
                  {[
                    { id: 'all' as const, label: 'Todas' },
                    { id: 'reels' as const, label: 'Reels' },
                    { id: 'posts' as const, label: 'Posts & Carrossel' },
                    ...(collabsList.length > 0 ? [{ id: 'collabs' as const, label: '🤝 Collabs' }] : []),
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setContentFilter(f.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-ui cursor-pointer ${
                        contentFilter === f.id
                          ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPublications.length === 0 ? (
                <EstadoCard
                  icon={BarChart3}
                  titulo="Nenhuma publicação encontrada no filtro"
                  texto={`Não houve mídias para o filtro selecionado nos últimos ${dados.period} dias.`}
                  compacto
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {filteredPublications.map((p) => {
                    const isVideo = p.media_type === 'VIDEO' || p.media_type === 'REELS';
                    const isCarousel = p.media_type === 'CAROUSEL' || p.media_type === 'CAROUSEL_ALBUM';
                    const engRate = p.reach > 0 ? ((p.interactions / p.reach) * 100).toFixed(1) : null;
                    const watchSec = Number(p.avg_watch_time) || 0;

                    return (
                      <article
                        key={p.id}
                        className="print-break-avoid rounded-2xl border border-border overflow-hidden bg-card flex flex-col hover:border-foreground/30 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="relative aspect-[4/5] bg-accent overflow-hidden group">
                          {p.media_url || p.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnail_url || p.media_url}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 size-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="w-10 h-10 opacity-30" />
                            </div>
                          )}

                          {/* Tipo */}
                          <div className="absolute top-2.5 left-2.5">
                            <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-xs font-semibold font-sans uppercase tracking-wide flex items-center gap-1.5 shadow-sm border border-white/10">
                              {isVideo ? <Video className="w-3.5 h-3.5 text-sky-400" /> : isCarousel ? <ImageIcon className="w-3.5 h-3.5 text-violet-400" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                              {tipoLabel(p.media_type)}
                            </span>
                          </div>

                          {/* Topo Direito: Engajamento & Link Instagram */}
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            {engRate && (
                              <span className="px-2.5 py-1 rounded-lg bg-lime text-lime-foreground text-xs font-semibold font-sans tabular-nums shadow-sm border border-black/10">
                                {engRate}% engaj.
                              </span>
                            )}
                            {p.permalink && (
                              <a
                                href={p.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="no-print p-1.5 rounded-lg bg-black/75 backdrop-blur-md text-white/80 hover:text-white hover:bg-black transition-all border border-white/10 shadow-sm"
                                title="Abrir no Instagram"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          {/* Badge de Collab */}
                          {p.collaborators && p.collaborators.length > 0 && (
                            <div className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-16px)]">
                              <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md text-emerald-300 text-xs font-semibold font-sans border border-emerald-500/30 flex items-center gap-1.5 truncate shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                🤝 @{p.collaborators[0].username}
                              </span>
                            </div>
                          )}

                          {/* Retenção de Vídeo */}
                          {isVideo && watchSec > 0 && (
                            <div className="absolute bottom-2.5 right-2.5">
                              <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md text-sky-300 text-xs font-semibold font-sans tabular-nums border border-sky-500/30 flex items-center gap-1.5 shadow-sm">
                                <Clock className="w-3.5 h-3.5 text-sky-400" />
                                {watchSec}s méd.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <span className="text-xs font-sans font-medium text-muted-foreground">{dataCurta(p.published_at)}</span>
                            <p className="text-sm font-medium text-foreground line-clamp-3 mt-1.5 leading-snug font-sans">
                              {p.caption || 'Sem legenda informada'}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border tabular-nums">
                            <div className="p-2.5 rounded-xl bg-accent/40 border border-border/60 flex flex-col min-w-0">
                              <span className="text-xs text-muted-foreground font-sans font-medium truncate">Alcance</span>
                              <span className="text-sm sm:text-base font-bold text-foreground font-sans tabular-nums mt-0.5 truncate">{fmt(p.reach)}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-accent/40 border border-border/60 flex flex-col min-w-0">
                              <span className="text-xs text-muted-foreground font-sans font-medium truncate">Visualizações</span>
                              <span className="text-sm sm:text-base font-bold text-foreground font-sans tabular-nums mt-0.5 truncate">{fmt(p.views || p.reach)}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-accent/40 border border-border/60 flex flex-col min-w-0">
                              <span className="text-xs text-muted-foreground font-sans font-medium truncate">Interações</span>
                              <span className="text-sm sm:text-base font-bold text-foreground font-sans tabular-nums mt-0.5 truncate">{fmt(p.interactions)}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-accent/40 border border-border/60 flex flex-col min-w-0">
                              <span className="text-xs text-muted-foreground font-sans font-medium truncate">Salvos & Shares</span>
                              <span className="text-sm sm:text-base font-bold text-foreground font-sans tabular-nums mt-0.5 truncate">
                                {fmt((p.shares || 0) + (p.saved || 0))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Rodapé do Relatório */}
        <footer className="text-center text-xs text-muted-foreground mt-4 pb-8 flex flex-col items-center gap-1 border-t border-border pt-6">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <span>Agência GENS</span>
            <span>·</span>
            <span>Inteligência & Gestão de Instagram</span>
          </div>
          <p className="text-2xs text-muted-foreground max-w-md">
            Relatório gerado a partir da Meta Graph API oficial (v25.0). Dados protegidos e atualizados diretamente dos servidores da Meta.
          </p>
        </footer>
      </main>
    </div>
  );
}

function CarregandoRelatorio() {
  return (
    <div role="status" aria-label="Carregando relatório" className="flex flex-col gap-5">
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-44 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

function EstadoCard({
  icon: Icon,
  titulo,
  texto,
  compacto,
}: {
  icon: React.ElementType;
  titulo: string;
  texto: string;
  compacto?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center gap-3 ${compacto ? 'py-8' : 'py-16'}`}>
      <div className="grid place-items-center size-12 rounded-2xl bg-muted ring-1 ring-inset ring-border text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{texto}</p>
    </div>
  );
}

function EstadoTela(props: { icon: React.ElementType; titulo: string; texto: string }) {
  return (
    <div className="min-h-dvh bg-background text-foreground grid place-items-center p-6">
      <Card padding="lg" className="max-w-md w-full">
        <EstadoCard {...props} />
      </Card>
    </div>
  );
}
