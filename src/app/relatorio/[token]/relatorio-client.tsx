'use client';

import React, { useEffect, useState } from 'react';
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
  BarChart3,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart } from '@/components/ui/line-chart';

interface FormatStats {
  count: number;
  reach: number;
  interactions: number;
}

interface RelatorioDados {
  cliente: string;
  period: number;
  geradoEm: string;
  account: { username: string | null; profile_picture_url: string | null; followers_count: number | null };
  metrics: {
    reach_total: number;
    profile_views_total: number;
    daily: { date: string; reach: number; profile_views: number }[];
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
      byFormat?: { posts: FormatStats; reels: FormatStats; stories: FormatStats };
    };
    topPublications: {
      id: string;
      media_type: string;
      media_url: string;
      caption: string | null;
      published_at: string;
      reach: number;
      interactions: number;
    }[];
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
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

function tipoLabel(mediaType: string) {
  if (mediaType === 'REELS' || mediaType === 'VIDEO') return 'Reels';
  if (mediaType === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (mediaType === 'STORIES') return 'Story';
  return 'Post';
}

export default function PaginaRelatorioClient({ token, valido, clienteNome, period }: RelatorioClientProps) {
  const [dados, setDados] = useState<RelatorioDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Momento de abertura da página — base do intervalo "últimos N dias".
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
    !dados?.metrics.followerGrowthUnavailable && growth.length > 1 ? growth[growth.length - 1].followers - growth[0].followers : null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased pb-16">
      <style>{`
        @media print {
          body { background-color: #ffffff !important; color: #000000 !important; }
          .no-print { display: none !important; }
          .print-card { break-inside: avoid !important; box-shadow: none !important; }
        }
      `}</style>

      <header className="no-print sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border py-3 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm sm:text-base font-semibold font-display leading-tight truncate">Relatório de desempenho no Instagram</h1>
            <Badge variant="brand">Agência GENS</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {nome} · últimos {period} dias
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button onClick={handleCopiarLink} variant="outline" size="sm">
            {copiado ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Share className="w-3.5 h-3.5" />}
            {copiado ? 'Link copiado' : 'Copiar link'}
          </Button>
          <Button onClick={() => window.print()} variant="lime" size="sm">
            <Printer className="w-3.5 h-3.5" />
            Salvar PDF
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 md:px-8 pt-6 sm:pt-8 flex flex-col gap-6">
        <section className="print-card p-5 sm:p-6 rounded-3xl bg-secondary border border-brand-ring flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {dados?.account.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dados.account.profile_picture_url} alt="" className="size-14 rounded-full border border-border object-cover shrink-0" />
            ) : (
              <div className="size-14 rounded-full bg-card border border-border shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight">{nome}</h2>
              <p className="text-sm text-muted-foreground">
                {dados?.account.username ? `@${dados.account.username} · ` : ''}
                <span className="capitalize">{intervalo}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:text-right max-w-xs">
            Números consultados na Meta (Instagram) {dados ? `em ${new Date(dados.geradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'agora'}.
          </p>
        </section>

        {erro ? (
          <EstadoCard icon={AlertTriangle} titulo="Não conseguimos carregar os números agora" texto={erro} />
        ) : !dados ? (
          <CarregandoRelatorio />
        ) : (
          <>
            {dados.metrics.error && (
              <div className="print-card p-3.5 rounded-2xl bg-warning-soft border border-warning-ring text-warning text-sm flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Parte dos insights da conta não foi devolvida pela Meta ({dados.metrics.error}). Os demais números estão completos.</span>
              </div>
            )}

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Kpi icon={TrendingUp} label="Contas alcançadas" valor={fmt(dados.metrics.reach_total)} nota={`Soma diária dos últimos ${dados.period} dias`} />
              <Kpi icon={Eye} label="Visitas ao perfil" valor={fmt(dados.metrics.profile_views_total)} nota="Visualizações da página do perfil" />
              <Kpi
                icon={Users}
                label="Seguidores"
                valor={fmt(dados.account.followers_count)}
                nota={
                  ganhoSeguidores === null
                    ? 'Evolução indisponível para esta conta'
                    : `${ganhoSeguidores >= 0 ? '+' : ''}${nf.format(ganhoSeguidores)} no período`
                }
                notaTom={ganhoSeguidores === null ? undefined : ganhoSeguidores >= 0 ? 'success' : 'destructive'}
              />
              <Kpi
                icon={Heart}
                label="Taxa de engajamento"
                valor={dados.content.summary.reachTotal > 0 ? `${dados.content.summary.engagementRate.toLocaleString('pt-BR')}%` : '—'}
                nota="Interações ÷ alcance de posts e reels"
              />
            </section>

            <Card padding="lg" className="print-card flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold font-display">Alcance diário</h3>
                <p className="text-xs text-muted-foreground">Contas alcançadas e visitas ao perfil, dia a dia.</p>
              </div>
              <LineChart
                height={200}
                emptyMessage="A Meta ainda não devolveu insights diários para esta conta no período."
                series={[
                  { name: 'Alcance', color: 'var(--chart-1)', points: dados.metrics.daily.map((d) => ({ date: d.date, value: d.reach })) },
                  { name: 'Visitas ao perfil', color: 'var(--chart-2)', points: dados.metrics.daily.map((d) => ({ date: d.date, value: d.profile_views })) },
                ]}
              />
            </Card>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Formato icon={ImageIcon} nome="Posts e carrosséis" stats={dados.content.summary.byFormat?.posts} count={dados.content.summary.posts} />
              <Formato icon={Video} nome="Reels" stats={dados.content.summary.byFormat?.reels} count={dados.content.summary.reels} />
              <Formato
                icon={Sparkles}
                nome="Stories"
                stats={dados.content.summary.byFormat?.stories}
                count={dados.content.summary.stories}
                nota="Só stories publicados pelo GENSBot — a Meta não guarda histórico de stories."
              />
            </section>

            <Card padding="lg" className="print-card flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold font-display">Publicações com melhor desempenho</h3>
                <p className="text-xs text-muted-foreground">Ordenadas por alcance + interações no período.</p>
              </div>
              {dados.content.topPublications.length === 0 ? (
                <EstadoCard icon={BarChart3} titulo="Nenhuma publicação no período" texto={`Não houve posts ou reels nos últimos ${dados.period} dias.`} compacto />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dados.content.topPublications.map((p) => (
                    <article key={p.id} className="print-card rounded-2xl border border-border overflow-hidden bg-card flex flex-col">
                      <div className="relative aspect-[4/5] bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.media_url && <img src={p.media_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
                        <span className="absolute top-2 left-2 text-xs font-semibold bg-black/60 text-white px-2 py-0.5 rounded-full">
                          {tipoLabel(p.media_type)}
                        </span>
                      </div>
                      <div className="p-3 flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground line-clamp-2 min-h-8">{p.caption || 'Sem legenda'}</p>
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span>
                            <strong className="text-foreground">{fmt(p.reach)}</strong> <span className="text-muted-foreground">alcance</span>
                          </span>
                          <span>
                            <strong className="text-foreground">{fmt(p.interactions)}</strong> <span className="text-muted-foreground">interações</span>
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{dataCurta(p.published_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        <footer className="text-center text-xs text-muted-foreground mt-4">
          Relatório gerado pela Agência GENS a partir dos dados oficiais da Meta. A Meta guarda insights de conta por até 90 dias.
        </footer>
      </main>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  valor,
  nota,
  notaTom,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
  nota: string;
  notaTom?: 'success' | 'destructive';
}) {
  return (
    <Card padding="md" className="print-card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon aria-hidden className="w-4 h-4 text-muted-foreground" />
      </div>
      <span className="text-display font-semibold font-display tabular-nums leading-none">{valor}</span>
      <span className={`text-xs ${notaTom === 'success' ? 'text-success' : notaTom === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`}>{nota}</span>
    </Card>
  );
}

function Formato({
  icon: Icon,
  nome,
  stats,
  count,
  nota,
}: {
  icon: React.ElementType;
  nome: string;
  stats?: FormatStats;
  count: number;
  nota?: string;
}) {
  return (
    <Card padding="md" className="print-card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{nome}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 tabular-nums">
        <div>
          <div className="text-title font-semibold">{fmt(count)}</div>
          <div className="text-xs text-muted-foreground">publicados</div>
        </div>
        <div>
          <div className="text-title font-semibold">{fmt(stats?.reach)}</div>
          <div className="text-xs text-muted-foreground">alcance</div>
        </div>
        <div>
          <div className="text-title font-semibold">{fmt(stats?.interactions)}</div>
          <div className="text-xs text-muted-foreground">interações</div>
        </div>
      </div>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </Card>
  );
}

function CarregandoRelatorio() {
  return (
    <div role="status" aria-label="Carregando relatório" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function EstadoCard({ icon: Icon, titulo, texto, compacto }: { icon: React.ElementType; titulo: string; texto: string; compacto?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center gap-3 ${compacto ? 'py-8' : 'py-16'}`}>
      <div className="grid place-items-center size-12 rounded-2xl bg-muted ring-1 ring-inset ring-border text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{texto}</p>
    </div>
  );
}

function EstadoTela(props: { icon: React.ElementType; titulo: string; texto: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center p-6">
      <Card padding="lg" className="max-w-md w-full">
        <EstadoCard {...props} />
      </Card>
    </div>
  );
}
