'use client';

import React from 'react';
import { AlertCircle, TrendingUp, Zap, Users, MessageSquare, BarChart2, CheckCircle2, Clock, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardContentPanel from '@/components/dashboard-content-panel';

interface DashboardHomeProps {
  alerts: { level: 'critical' | 'warning'; message: string }[];
  stats: { leadsGenerated: number; automations: number; automationsTriggered: number; events: number };
  trends: { leadsGenerated: number | null; automations: number | null; automationsTriggered: number | null; events: number | null };
  chartPeriod: '7d' | '30d' | 'month';
  setChartPeriod: (period: '7d' | '30d' | 'month') => void;
  weeklyChart: { day: string; comments: number; dms: number }[];
  weeklyChartMax: number;
  hoveredBarIndex: number | null;
  setHoveredBarIndex: (index: number | null) => void;
  health: { sentPercent: number; pendingPercent: number; failedPercent: number; hasData: boolean };
  funnel: { comments: number; welcomeDms: number; clicks: number; leads: number };
  recentQueue: any[];
  failureDiagnostics: { reason: string; count: number }[];
  automationRanking: { id: string; name: string; comments: number; welcomeDms: number; clicks: number; leads: number }[];
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
  onViewLogs: () => void;
}

export default function DashboardHome({
  alerts,
  stats,
  trends,
  chartPeriod,
  setChartPeriod,
  weeklyChart,
  weeklyChartMax,
  hoveredBarIndex,
  setHoveredBarIndex,
  health,
  funnel,
  recentQueue,
  failureDiagnostics,
  automationRanking,
  selectedAccountId,
  withAccount,
  onViewLogs,
}: DashboardHomeProps) {
  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* 0. Alertas do Sistema */}
      {alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-xs font-medium border ${
                alert.level === 'critical' 
                  ? 'bg-destructive/10 text-destructive border-destructive/20' 
                  : 'bg-warning/15 text-warning-foreground border-warning/20'
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{alert.message}</span>
            </div>
          ))}
        </section>
      )}

      {/* 1. Hero KPI Cards Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Leads Qualificados', value: stats.leadsGenerated, change: trends.leadsGenerated, icon: Users, accent: 'bg-lime text-foreground', tag: 'Captura' },
          { label: 'Automações Ativas', value: stats.automations, change: trends.automations, icon: Zap, accent: 'bg-primary text-primary-foreground', tag: 'Ativo' },
          { label: 'Disparos no Período', value: stats.automationsTriggered, change: trends.automationsTriggered, icon: MessageSquare, accent: 'bg-secondary text-foreground', tag: 'Volume' },
          { label: 'Eventos Captados', value: stats.events, change: trends.events, icon: BarChart2, accent: 'bg-muted text-muted-foreground', tag: 'Total' },
        ] as const).map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5 flex flex-col justify-between rounded-2xl border border-border/80 hover:border-foreground/20 shadow-2xs hover:shadow-xs transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{card.label}</span>
                </div>
                <div className={`w-7 h-7 rounded-lg ${card.accent} flex items-center justify-center shadow-2xs`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex flex-col mt-4">
                <span className="text-3xl font-bold font-display text-foreground leading-none tabular-nums tracking-tight">{card.value}</span>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  {card.change === null ? (
                    <span className="font-semibold text-muted-foreground bg-accent/60 px-2 py-0.5 rounded-md text-[10px]">Primeiro registro</span>
                  ) : (
                    <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums text-[11px] px-1.5 py-0.5 rounded-md ${
                      card.change >= 0 ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
                    }`}>
                      {card.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(card.change)}%
                    </span>
                  )}
                  <span className="text-muted-foreground text-[11px] font-medium">vs 30d anteriores</span>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      {/* 2. Main Analytics & Meter Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 2A: Interactive 7-Day Bar Chart (lg:col-span-8) */}
        <Card padding="lg" className="lg:col-span-8 rounded-2xl flex flex-col justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold font-display text-foreground text-base tracking-tight">Desempenho de Disparos & Interações</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Volume diário de comentários detectados e DMs entregues</p>
            </div>

            {/* Period selector buttons */}
            <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70 self-start sm:self-auto">
              {(['7d', '30d', 'month'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartPeriod === p
                      ? 'bg-card text-foreground shadow-2xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Este Mês'}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Bar Chart Graphic */}
          <div className="flex flex-col gap-4 pt-2">
            {weeklyChart.every(d => d.comments === 0 && d.dms === 0) ? (
              <div className="h-44 w-full flex items-center justify-center text-xs text-muted-foreground bg-accent/20 rounded-xl border border-dashed border-border/80">
                Ainda sem comentários ou DMs registrados no período.
              </div>
            ) : (
              <div className="h-44 w-full flex items-end justify-between gap-3 px-2 relative border-b border-border/60 pb-3">
                {weeklyChart.map((item, i) => {
                  const isHovered = hoveredBarIndex === i;
                  const max = Math.max(weeklyChartMax, 1);
                  const commentsHeight = Math.max(6, Math.round((item.comments / max) * 100));
                  const dmsHeight = Math.round((item.dms / max) * 100);
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredBarIndex(i)}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer relative"
                    >
                      {/* Floating Tooltip on Hover */}
                      {isHovered && (
                        <div className="absolute -top-12 z-30 bg-foreground text-background text-xs py-1 px-2.5 rounded-lg text-center whitespace-nowrap flex flex-col items-center pointer-events-none font-mono shadow-lg animate-in fade-in zoom-in-95 duration-150">
                          <span className="font-bold text-[10px] uppercase text-muted">{item.day}</span>
                          <span className="text-[11px] font-semibold text-lime">💬 {item.comments} · 📥 {item.dms}</span>
                        </div>
                      )}

                      {/* Bar Pill */}
                      <div className="w-full max-w-[32px] bg-accent rounded-lg overflow-hidden relative flex items-end border border-border/40" style={{ height: `${commentsHeight}%` }}>
                        <div
                          className="w-full rounded-b-md bg-primary transition-all duration-200 group-hover:bg-primary/90"
                          style={{ height: `${dmsHeight}%` }}
                        />
                      </div>

                      {/* Day Label */}
                      <span className={`text-[11px] font-semibold transition-colors ${isHovered ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-2 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" /> DMs Entregues
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent border border-border" /> Comentários Processados
                </span>
              </div>
              <span className="font-mono text-[11px] bg-accent/40 px-2 py-0.5 rounded-md border border-border/50">
                Média: {Math.round(weeklyChart.reduce((sum, d) => sum + d.dms, 0) / Math.max(1, weeklyChart.length))} disparos/dia
              </span>
            </div>
          </div>
        </Card>

        {/* 2B: Semi-Donut Gauge Chart - Saúde do Bot (lg:col-span-4) */}
        <Card padding="lg" className="lg:col-span-4 rounded-2xl flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-bold font-display text-foreground text-base tracking-tight">Saúde das Entregas</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Conformidade e taxa de sucesso da Meta API</p>
          </div>

          {/* 180° Semi-Donut SVG Gauge */}
          <div className="flex flex-col items-center justify-center my-2 relative">
            <svg className="w-48 h-28" viewBox="0 0 100 55">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="9"
                strokeLinecap="round"
              />
              {health.hasData && (
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${(health.sentPercent / 100) * 125.6} 125.6`}
                />
              )}
            </svg>

            <div className="absolute top-11 flex flex-col items-center text-center">
              <span className="text-3xl font-bold font-display text-foreground leading-none tabular-nums tracking-tight">
                {health.hasData ? `${health.sentPercent}%` : '—'}
              </span>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider mt-1 bg-lime/30 px-2 py-0.5 rounded-full border border-primary/20">
                Taxa de Sucesso
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            {!health.hasData ? (
              <p className="text-xs text-muted-foreground text-center py-2">Aguardando volume de disparos.</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Disparos com Sucesso
                  </span>
                  <span className="font-bold text-foreground tabular-nums">{health.sentPercent}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-warning" /> Na Fila / Aguardando
                  </span>
                  <span className="font-bold text-foreground tabular-nums">{health.pendingPercent}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-destructive" /> Limites Meta / Falhas
                  </span>
                  <span className="font-bold text-foreground tabular-nums">{health.failedPercent}%</span>
                </div>
              </>
            )}
          </div>
        </Card>

      </div>

      {/* 3. Bottom Row (Funil + Activity Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 3A: Funil Reativo de Conversão (lg:col-span-4) */}
        <Card padding="lg" className="lg:col-span-4 rounded-2xl flex flex-col gap-5 justify-between">
          <div>
            <h4 className="font-bold font-display text-foreground text-base tracking-tight">Funil de Conversão</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Retenção e conversão por etapa do fluxo</p>
          </div>

          {funnel.comments === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 bg-accent/20 rounded-xl border border-dashed border-border/80">
              Ainda não há comentários registrados pra calcular o funil.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {[
                { label: '1. Comentários Detectados', val: funnel.comments, color: 'bg-primary' },
                { label: '2. DMs de Boas-Vindas', val: funnel.welcomeDms, color: 'bg-primary/75' },
                { label: '3. Cliques no Link', val: funnel.clicks, color: 'bg-primary/50' },
                { label: '4. Leads Qualificados', val: funnel.leads, color: 'bg-lime text-foreground' }
              ].map((step, idx) => {
                const percent = Math.round((step.val / funnel.comments) * 100);
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className="text-foreground font-bold tabular-nums">{step.val} <span className="text-muted-foreground font-normal text-[11px]">({percent}%)</span></span>
                    </div>
                    <div className="h-2.5 w-full bg-accent rounded-full overflow-hidden p-0.5 border border-border/60">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 3B: Histórico de Envios Recentes na Fila (lg:col-span-8) */}
        <Card padding="lg" className="lg:col-span-8 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h4 className="font-bold font-display text-foreground text-base tracking-tight">Envios Recentes na Fila</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Pipeline de entregas em tempo real</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onViewLogs} className="text-xs font-bold text-primary hover:text-primary/80">
              Ver todos os logs →
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-[11px] uppercase text-muted-foreground font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Contato</th>
                  <th className="py-2.5 px-3">Tipo de Ação</th>
                  <th className="py-2.5 px-3">Horário</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentQueue.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">Nenhum disparo na fila recentemente.</td>
                  </tr>
                ) : (
                  recentQueue.slice(0, 5).map(item => (
                    <tr key={item.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-xs text-foreground font-bold flex items-center gap-2">
                        {item.contacts?.profile_picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL da Meta
                          <img
                            src={item.contacts.profile_picture_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover border border-border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-accent border border-border flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                            @
                          </div>
                        )}
                        <span className="truncate max-w-[150px]">
                          {item.contacts?.username
                            ? `@${item.contacts.username}`
                            : `@${item.contact_id.substring(0, 10)}...`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground text-xs">
                        {item.type === 'private_reply' && 'DM de Boas-Vindas'}
                        {item.type === 'link_dm' && 'DM com Link'}
                        {item.type === 'reminder_dm' && 'DM de Lembrete'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">{new Date(item.created_at).toLocaleTimeString('pt-BR')}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={item.status === 'sent' ? 'success' : item.status === 'pending' ? 'warning' : 'destructive'}
                          className="text-[10px] font-bold"
                        >
                          {item.status === 'sent' && 'Enviado'}
                          {item.status === 'pending' && 'Pendente'}
                          {item.status === 'failed' && 'Falhou'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

      {/* 4. Diagnóstico de Falhas + Ranking de Automações */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card padding="lg" className="lg:col-span-6 rounded-2xl flex flex-col gap-4">
          <div>
            <h4 className="font-bold font-display text-foreground text-base tracking-tight">Diagnóstico de Falhas</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Motivos mais comuns de falha nos últimos 90 dias</p>
          </div>
          {failureDiagnostics.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 bg-accent/20 rounded-xl border border-dashed border-border/80">
              Nenhuma falha registrada. 🎉
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {failureDiagnostics.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-xl bg-accent/40 border border-border/50">
                  <span className="text-muted-foreground flex-1">{f.reason}</span>
                  <span className="font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md flex-shrink-0 tabular-nums">{f.count}x</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="lg" className="lg:col-span-6 rounded-2xl flex flex-col gap-4">
          <div>
            <h4 className="font-bold font-display text-foreground text-base tracking-tight">Ranking de Automações</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Automações com maior conversão de leads</p>
          </div>
          {automationRanking.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 bg-accent/20 rounded-xl border border-dashed border-border/80">
              Nenhuma automação com interações ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {automationRanking.map((auto, i) => (
                <div key={auto.id} className="flex items-center gap-3 text-xs p-2.5 rounded-xl bg-accent/40 border border-border/50 hover:border-foreground/20 transition-all">
                  <span className="w-5 h-5 rounded-md bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-foreground font-semibold flex-1 truncate">{auto.name}</span>
                  <span className="text-muted-foreground text-[11px] flex-shrink-0 tabular-nums">{auto.comments} com. · {auto.clicks} cliques</span>
                  <span className="font-bold text-foreground bg-lime px-2 py-0.5 rounded-md flex-shrink-0 text-[11px] tabular-nums border border-foreground/10">{auto.leads} leads</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. Desempenho de Conteúdo */}
      <DashboardContentPanel selectedAccountId={selectedAccountId} withAccount={withAccount} />

    </div>
  );
}
