'use client';

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
} from 'lucide-react';
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
  shares?: number;
  reposts?: number;
  new_followers?: number;
  avg_watch_time?: string;
  unique_viewers?: number;
}

interface ContentPerformance {
  summary: {
    posts: number;
    reels: number;
    stories: number;
    reachTotal: number;
    engagementRate: number;
    byFormat?: Record<'posts' | 'reels' | 'stories', { count: number; reach: number; interactions: number }>;
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
          className="w-full h-full overflow-visible"
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
            <span className="text-xs text-muted-foreground font-mono font-bold">
              {new Date(pointsA[hoverIndex].date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
            <div className="flex items-center justify-between gap-3 text-foreground font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground" />
                {labelA}:
              </span>
              <span className="font-mono">{pointsA[hoverIndex].val.toLocaleString('pt-BR')}</span>
            </div>
            {pointsB[hoverIndex] && (
              <div className="flex items-center justify-between gap-3 text-success font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  {labelB}:
                </span>
                <span className="font-mono">{pointsB[hoverIndex].val.toLocaleString('pt-BR')}</span>
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
        <span className="text-xs font-mono text-muted-foreground">Passe o cursor sobre os pontos para detalhar o dia</span>
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
  ];
  const totalReach = formats.reduce((acc, f) => acc + (summary?.byFormat?.[f.key]?.reach ?? 0), 0);

  return (
    <Card padding="lg" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col gap-5">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-base sm:text-lg font-semibold font-display text-foreground">Desempenho por formato</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quantidade publicada, alcance e interações de cada tipo de conteúdo no período.
        </p>
      </div>

      {!summary ? (
        <EmptyState size="compact" icon={BarChart3} title="Sem dados de conteúdo no período" description="Assim que houver publicações com insights da Meta, a divisão por formato aparece aqui." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {formats.map((f) => {
            const stats = summary.byFormat?.[f.key];
            const share = totalReach > 0 && stats ? Math.round((stats.reach / totalReach) * 100) : 0;
            return (
              <div key={f.key} className="p-4 rounded-2xl border border-border bg-background flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <f.icon aria-hidden className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{f.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 tabular-nums">
                  <div>
                    <div className="text-title font-semibold text-foreground">{f.count.toLocaleString('pt-BR')}</div>
                    <div className="text-xs text-muted-foreground">publicados</div>
                  </div>
                  <div>
                    <div className="text-title font-semibold text-foreground">{(stats?.reach ?? 0).toLocaleString('pt-BR')}</div>
                    <div className="text-xs text-muted-foreground">alcance</div>
                  </div>
                  <div>
                    <div className="text-title font-semibold text-foreground">{(stats?.interactions ?? 0).toLocaleString('pt-BR')}</div>
                    <div className="text-xs text-muted-foreground">interações</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${share}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{share}% do alcance do período</span>
                </div>
                {f.key === 'stories' && (
                  <p className="text-xs text-muted-foreground">Só stories publicados pelo GENSBot — a Meta não guarda histórico de stories.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
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
    <Card padding="lg" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
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
    <Card padding="lg" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold font-display text-foreground">
              Horários de maior atividade
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seguidores online por hora do dia (média da Meta, sem divisão por dia da semana).
          </p>
        </div>

        {peakHour && (
          <Badge variant="info" className="text-xs font-bold self-start sm:self-auto py-1 px-3 bg-primary/15 text-primary border-primary/30">
            Pico: {peakHour.hour}:00h ({peakHour.followersOnline.toLocaleString('pt-BR')} online)
          </Badge>
        )}
      </div>

      {state.loading ? (
        <Skeleton className="h-28 w-full" />
      ) : !state.available ? (
        <EmptyState size="compact" icon={Clock} title="Horários ainda indisponíveis" description={state.reason || undefined} className="border-dashed" />
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
                  className={`w-full rounded-t-md transition-ui duration-200 ${
                    isPeak ? 'bg-primary shadow-xs border border-primary-foreground/30' : 'bg-primary/20 hover:bg-primary/35'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                {h.hour % 3 === 0 && <span className="text-xs text-muted-foreground font-mono mt-1.5">{h.hour}h</span>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Dias de Pico: Seg, Ter e Qui
          </span>
          <span className="font-mono text-xs">Janela recomendada: 18h às 21h</span>
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

  return (
    <div className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-foreground/30 hover:shadow-md transition-ui duration-200">
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

        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1">
            {isVideo ? <Video className="w-3 h-3" /> : isCarousel ? <ImageIcon className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {isVideo ? 'Reels' : isCarousel ? 'Carrossel' : 'Post'}
          </span>
        </div>

        {engRate && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-md bg-lime text-lime-foreground text-xs font-bold font-mono shadow-xs border border-black/10">
              {engRate}% engaj.
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground font-mono">
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

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase">Alcance</span>
            <span className="font-bold text-foreground font-mono">{item.reach.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase">Interações</span>
            <span className="font-bold text-foreground font-mono">{item.interactions.toLocaleString('pt-BR')}</span>
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

  const [contentFilter, setContentFilter] = useState<'all' | 'reels' | 'posts'>('all');
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
    return list;
  }, [contentPerf, contentFilter]);

  const totalReach = useMemo(() => metrics.reduce((acc, m) => acc + (m.reach_total || 0), 0), [metrics]);
  const totalProfileViews = useMemo(() => metrics.reduce((acc, m) => acc + (m.profile_views_total || 0), 0), [metrics]);
  const totalFollowers = useMemo(() => metrics.reduce((acc, m) => acc + (m.followers_count || 0), 0), [metrics]);
  // Interações de TODAS as publicações do período (posts + reels), não só do top 8.
  const totalInteractions = useMemo(() => {
    const bf = contentPerf?.summary?.byFormat;
    if (bf) return bf.posts.interactions + bf.reels.interactions;
    return (contentPerf?.topPublications || []).reduce((acc, p) => acc + (p.interactions || 0), 0);
  }, [contentPerf]);
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
        <div className="flex items-center gap-3">
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
            <span className="px-2 py-0.5 rounded-full bg-card/80 text-foreground text-xs font-mono border">
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

          {relatoriosSalvos.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum relatório gerado ainda"
              description="Ao clicar em 'Copiar Link', 'Ver Relatório' ou 'Enviar no WhatsApp', os relatórios gerados aparecerão salvos nesta lista para consulta a qualquer momento."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-mono text-xs uppercase">
                    <th className="py-2.5 px-3">Cliente / Perfil</th>
                    <th className="py-2.5 px-3">Período</th>
                    <th className="py-2.5 px-3">Data de Geração</th>
                    <th className="py-2.5 px-3">Status de Validade</th>
                    <th className="py-2.5 px-3 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {relatoriosSalvos.map((rel) => (
                    <tr key={rel.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-foreground">
                        {rel.clienteNome}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground capitalize">
                        Últimos {rel.period} dias
                      </td>
                      <td className="py-3 px-3 text-muted-foreground font-mono text-xs">
                        {new Date(rel.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-success-soft text-success border border-success-ring">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => window.open(rel.link, '_blank')}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                            title="Abrir Relatório público"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopiarMensagemWhatsapp(rel)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-success hover:bg-success-soft cursor-pointer transition-colors"
                            title="Copiar mensagem para WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnviarWhatsapp(rel)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-success hover:bg-success-soft cursor-pointer transition-colors"
                            title="Enviar diretamente no WhatsApp Web"
                          >
                            <Send className="w-4 h-4 text-success" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirRelatorio(rel.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                            title="Excluir do histórico"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          {/* 1. Bento KPI Grid (4 Métricas Principais do Instagram) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contas Alcançadas */}
            <Card padding="md" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Contas Alcançadas
                </span>
                <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold border border-primary/30">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {((isSingleAccount ? activeAccount?.reach_total : totalReach) ?? 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Soma diária dos últimos {period} dias</p>
              </div>
            </Card>

            {/* KPI 2: Interações Totais */}
            <Card padding="md" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Interações Totais
                </span>
                <div className="w-8 h-8 rounded-xl bg-destructive-soft text-destructive flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {totalInteractions.toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                  <span className="text-foreground font-semibold">
                    {contentPerf?.summary?.reachTotal ? `${contentPerf.summary.engagementRate.toFixed(1)}%` : '—'}
                  </span>
                  <span>taxa média de engajamento</span>
                </p>
              </div>
            </Card>

            {/* KPI 3: Total de Seguidores */}
            <Card padding="md" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Total de Seguidores
                </span>
                <div className="w-8 h-8 rounded-xl bg-info-soft text-info flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {((isSingleAccount ? activeAccount?.followers_count : totalFollowers) ?? 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs mt-1">
                  {followerNet === null ? (
                    <span className="text-muted-foreground">{isSingleAccount ? 'Evolução indisponível para esta conta' : 'Soma das contas conectadas'}</span>
                  ) : (
                    <span className={followerNet >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                      {followerNet >= 0 ? '+' : ''}
                      {followerNet.toLocaleString('pt-BR')} no período
                    </span>
                  )}
                </p>
              </div>
            </Card>

            {/* KPI 4: Visitas ao Perfil */}
            <Card padding="md" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase font-mono tracking-wider">
                  Visitas ao Perfil
                </span>
                <div className="w-8 h-8 rounded-xl bg-chart-4/10 text-chart-4 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {((isSingleAccount ? activeAccount?.profile_views_total : totalProfileViews) ?? 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bioClicks === null ? 'Visualizações do perfil' : `${bioClicks.toLocaleString('pt-BR')} cliques no link da bio (UTM)`}
                </p>
              </div>
            </Card>
          </div>

          {/* 2. Gráfico Bézier Suave de Alcance e Visitas ao Perfil */}
          {activeAccount && (
            <Card padding="lg" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      Visão Geral: Alcance e Visitas ao Perfil
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Curva diária de alcance orgânico e tráfego direcionado à bio (últimos {period} dias)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="font-mono text-xs bg-primary/15 text-primary border-primary/30">
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

          {/* 3. Desempenho por formato (real) */}
          <ContentFormatBreakdownCard summary={contentPerf?.summary ?? null} />

          {/* 6. Demografia do Público & Horários / Dias de Pico */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AudienceDemographicsCard />
            {activeAccount && (
              <AudienceActivityCard instagramUserId={activeAccount.instagram_user_id} withAccount={withAccount} />
            )}
          </div>

          {/* 7. Conteúdo Compartilhado no Período (Galeria Completa) */}
          <Card padding="lg" className="rounded-3xl border border-border bg-card shadow-2xs flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-bold font-display text-foreground text-lg tracking-tight">
                    Publicações com melhor desempenho
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  As 8 publicações com mais alcance + interações no período
                </p>
              </div>

              <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-2xl border border-border self-start sm:self-auto shadow-2xs">
                {[
                  { id: 'all' as const, label: 'Todas as Mídias' },
                  { id: 'reels' as const, label: 'Reels' },
                  { id: 'posts' as const, label: 'Posts & Carrossel' },
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
              <EmptyState
                icon={ImageIcon}
                title="Nenhuma publicação encontrada no período"
                description="Não foram identificadas postagens publicadas para esta conta no período selecionado."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
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
                { label: 'Interações', valor: totalInteractions.toLocaleString('pt-BR') },
                { label: 'Seguidores', valor: (activeAccount?.followers_count ?? 0).toLocaleString('pt-BR'), nota: followerNet === null ? undefined : `${followerNet >= 0 ? '+' : ''}${followerNet.toLocaleString('pt-BR')} no período` },
                { label: 'Visitas ao perfil', valor: (activeAccount?.profile_views_total ?? 0).toLocaleString('pt-BR') },
              ].map((k) => (
                <div key={k.label} className="p-3.5 rounded-2xl bg-card border border-border flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                  <span className="text-xl font-semibold font-display text-foreground">{k.valor}</span>
                  {k.nota && <span className="text-xs text-success font-semibold">{k.nota}</span>}
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
