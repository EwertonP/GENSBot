'use client';

import React, { useEffect, useState } from 'react';
import { Users, Image as ImageIcon, Eye, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/ui/line-chart';

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

const PERIOD_OPTIONS: { value: 7 | 30 | 90; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

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

function AccountCard({ metrics, detailed }: { metrics: AccountMetrics; detailed: boolean }) {
  const reachSeries = metrics.daily.map((d) => ({ date: d.date, value: d.reach }));
  const viewsSeries = metrics.daily.map((d) => ({ date: d.date, value: d.profile_views }));
  const followersSeries = metrics.followerGrowth.map((d) => ({ date: d.date, value: d.followers }));
  const publicationsSeries = metrics.publicationsGrowth.map((d) => ({ date: d.date, value: d.count }));

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
        <StatBox icon={TrendingUp} label={`Alcance (${metrics.period}d)`} value={metrics.reach_total} />
        <StatBox icon={Eye} label={`Visitas ao perfil (${metrics.period}d)`} value={metrics.profile_views_total} />
      </div>

      {detailed && (
        <>
          <div>
            <p className="text-xs font-bold text-foreground mb-2">Alcance e visitas ao perfil</p>
            <LineChart
              series={[
                { name: 'Alcance', color: 'var(--chart-1)', points: reachSeries },
                { name: 'Visitas ao perfil', color: 'var(--chart-2)', points: viewsSeries },
              ]}
            />
          </div>

          <div>
            <p className="text-xs font-bold text-foreground mb-2">Crescimento de seguidores</p>
            {metrics.followerGrowthUnavailable ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 py-4">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Contas com menos de 100 seguidores não recebem esse dado da própria Meta.
              </p>
            ) : (
              <LineChart series={[{ name: 'Seguidores', color: 'var(--chart-1)', points: followersSeries }]} />
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-foreground mb-2">Crescimento de publicações</p>
            <LineChart
              series={[{ name: 'Publicações', color: 'var(--chart-3)', points: publicationsSeries }]}
              emptyMessage="Nenhuma publicação feita pelo GENSBot neste período."
            />
          </div>
        </>
      )}
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
  const [period, setPeriod] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    setLoading(true);
    fetch(withAccount(`/api/instagram/insights?period=${period}`))
      .then((res) => res.json())
      .then((data) => setMetrics(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedAccountId, period]);

  const isSingleAccount = selectedAccountId && selectedAccountId !== 'all';

  const periodSelector = (
    <div className="flex gap-1.5 mb-4">
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
  );

  if (loading) {
    return (
      <div>
        {periodSelector}
        <p className="text-xs text-muted-foreground">Carregando métricas...</p>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div>
        {periodSelector}
        <EmptyState icon={TrendingUp} title="Nenhuma conta conectada com métricas disponíveis." />
      </div>
    );
  }

  if (isSingleAccount) {
    return (
      <div>
        {periodSelector}
        <AccountCard metrics={metrics[0]} detailed />
      </div>
    );
  }

  return (
    <div>
      {periodSelector}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((m) => (
          <AccountCard key={m.instagram_user_id} metrics={m} detailed={false} />
        ))}
      </div>
    </div>
  );
}
