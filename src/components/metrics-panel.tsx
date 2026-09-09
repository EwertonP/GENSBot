'use client';

import React, { useEffect, useState } from 'react';
import { Users, Image as ImageIcon, Eye, TrendingUp, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

interface DailyPoint {
  date: string;
  reach: number;
  profile_views: number;
}

interface AccountMetrics {
  instagram_user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  reach_total: number;
  profile_views_total: number;
  daily: DailyPoint[];
  error?: string;
}

function StatBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2.5 bg-muted/40 rounded-lg px-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function WeekBars({ daily }: { daily: DailyPoint[] }) {
  if (daily.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Sem dados de alcance nos últimos 7 dias.</p>;
  }
  const max = Math.max(1, ...daily.map((d) => d.reach));
  return (
    <div className="h-28 w-full flex items-end justify-between gap-2 px-1 border-b border-accent pb-2">
      {daily.map((d) => {
        const height = Math.max(4, Math.round((d.reach / max) * 100));
        const label = new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group" title={`${d.date}: ${d.reach} de alcance`}>
            <div className="w-full max-w-[24px] bg-primary rounded-sm transition-opacity group-hover:opacity-80" style={{ height: `${height}%` }} />
            <span className="text-[9px] font-bold text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AccountCard({ metrics, detailed }: { metrics: AccountMetrics; detailed: boolean }) {
  return (
    <Card padding="sm" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {metrics.profile_picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada/temporária da Meta
          <img src={metrics.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
            {metrics.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">@{metrics.username || metrics.instagram_user_id}</p>
          {metrics.error && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {metrics.error}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox icon={Users} label="Seguidores" value={metrics.followers_count ?? '—'} />
        <StatBox icon={ImageIcon} label="Publicações" value={metrics.media_count ?? '—'} />
        <StatBox icon={TrendingUp} label="Alcance (7d)" value={metrics.reach_total} />
        <StatBox icon={Eye} label="Visitas ao perfil (7d)" value={metrics.profile_views_total} />
      </div>

      {detailed && <WeekBars daily={metrics.daily} />}
    </Card>
  );
}

interface MetricsPanelProps {
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}

/** Tela "Métricas" — insights do Instagram separados por perfil conectado. */
export default function MetricsPanel({ selectedAccountId, withAccount }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<AccountMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(withAccount('/api/instagram/insights'))
      .then((res) => res.json())
      .then((data) => setMetrics(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  const isSingleAccount = selectedAccountId && selectedAccountId !== 'all';

  if (loading) {
    return <p className="text-xs text-muted-foreground">Carregando métricas...</p>;
  }

  if (metrics.length === 0) {
    return <EmptyState icon={TrendingUp} title="Nenhuma conta conectada com métricas disponíveis." />;
  }

  if (isSingleAccount) {
    return <AccountCard metrics={metrics[0]} detailed />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {metrics.map((m) => (
        <AccountCard key={m.instagram_user_id} metrics={m} detailed={false} />
      ))}
    </div>
  );
}
