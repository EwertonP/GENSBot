'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
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

/** Aba "Dashboard" (home) — extraída de src/app/page.tsx (passo 2 da quebra do
 * monólito em componentes por aba, ver DESIGN.md §6). Corta-e-cola literal,
 * sem mudança de comportamento. */
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
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* 0. Alertas do Sistema */}
      {alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-xs font-medium ${
                alert.level === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-foreground'
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{alert.message}</span>
            </div>
          ))}
        </section>
      )}

      {/* 1. Hero KPI Cards Grid — card neutro, cor vira só indicador pontual */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {([
          { label: 'Leads Gerados', value: stats.leadsGenerated, change: trends.leadsGenerated, dot: 'bg-primary' },
          { label: 'Automações Ativas', value: stats.automations, change: trends.automations, dot: 'bg-success' },
          { label: 'Automações Disparadas', value: stats.automationsTriggered, change: trends.automationsTriggered, dot: 'bg-warning' },
          { label: 'Eventos Captados', value: stats.events, change: trends.events, dot: 'bg-muted-foreground' },
        ] as const).map(card => (
          <Card key={card.label} className="rounded-2xl flex flex-col justify-between shadow-sm h-40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{card.label}</span>
              <span className={`w-1.75 h-1.75 rounded-full flex-shrink-0 ${card.dot}`} />
            </div>

            <div className="flex flex-col mt-2">
              <span className="text-4xl font-bold text-foreground leading-none tabular-nums">{card.value}</span>
              <div className="flex items-center gap-2 mt-3">
                {card.change === null ? (
                  <span className="text-xs font-semibold text-muted-foreground">Novo</span>
                ) : (
                  <span className={`text-xs font-semibold tabular-nums ${card.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {card.change >= 0 ? '↑' : '↓'} {Math.abs(card.change)}%
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-medium">vs 30 dias anteriores</span>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* 2. Main Analytics & Meter Charts (Inspired by Donezo & ACRU) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 2A: Interactive 7-Day Bar Chart (lg:col-span-8) */}
        <Card padding="lg" className="lg:col-span-8 rounded-2xl shadow-sm flex flex-col justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-foreground text-base">Desempenho de Disparos & Interações</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Volume diário de comentários detectados e DMs entregues</p>
            </div>

            {/* Period selector buttons */}
            <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-accent self-start sm:self-auto">
              {(['7d', '30d', 'month'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartPeriod === p
                      ? 'bg-accent text-primary border border-primary/25 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Este Mês'}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Bar Chart Graphic — dados reais dos últimos 7 dias */}
          <div className="flex flex-col gap-3 pt-4">
            {weeklyChart.every(d => d.comments === 0 && d.dms === 0) ? (
              <div className="h-44 w-full flex items-center justify-center text-xs text-muted-foreground">
                Ainda sem comentários ou DMs registrados nos últimos 7 dias.
              </div>
            ) : (
              <div className="h-44 w-full flex items-end justify-between gap-3 px-2 relative border-b border-accent pb-2">
                {weeklyChart.map((item, i) => {
                  const isHovered = hoveredBarIndex === i;
                  const max = Math.max(weeklyChartMax, 1);
                  const commentsHeight = Math.max(4, Math.round((item.comments / max) * 100));
                  const dmsHeight = Math.round((item.dms / max) * 100);
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredBarIndex(i)}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer relative"
                    >
                      {/* Floating Tooltip on Hover */}
                      {isHovered && (
                        <div className="absolute -top-12 z-30 bg-card border border-border text-foreground text-xs py-1.5 px-3 rounded-lg text-center whitespace-nowrap flex flex-col items-center pointer-events-none font-mono">
                          <span className="font-bold">{item.day}f</span>
                          <span className="text-xs">💬 {item.comments} · 📥 {item.dms}</span>
                        </div>
                      )}

                      {/* Bar Pill */}
                      <div className="w-full max-w-[32px] bg-accent/40 rounded-sm overflow-hidden relative flex items-end" style={{ height: `${commentsHeight}%` }}>
                        <div
                          className="w-full rounded-sm bg-primary transition-opacity duration-200 group-hover:opacity-90"
                          style={{ height: `${dmsHeight}%` }}
                        ></div>
                      </div>

                      {/* Day Label */}
                      <span className={`text-xs font-bold transition-colors ${isHovered ? 'text-primary' : 'text-muted-foreground'}`}>
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span> DMs Entregues
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent border border-border"></span> Comentários Processados
                </span>
              </div>
              <span className="font-mono">
                Média: {Math.round(weeklyChart.reduce((sum, d) => sum + d.dms, 0) / Math.max(1, weeklyChart.length))} disparos/dia
              </span>
            </div>
          </div>
        </Card>

        {/* 2B: Semi-Donut Gauge Chart - Saúde do Bot (lg:col-span-4) */}
        <Card padding="lg" className="lg:col-span-4 rounded-2xl shadow-sm flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-bold text-foreground text-base">Saúde das Entregas</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Conformidade e taxa de sucesso da Meta API</p>
          </div>

          {/* 180° Semi-Donut SVG Gauge — arco proporcional à taxa de sucesso real */}
          <div className="flex flex-col items-center justify-center my-2 relative">
            <svg className="w-48 h-28" viewBox="0 0 100 55">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {health.hasData && (
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(health.sentPercent / 100) * 125.6} 125.6`}
                />
              )}
            </svg>

            <div className="absolute top-12 flex flex-col items-center text-center">
              <span className="text-3xl font-bold text-foreground leading-none tabular-nums">
                {health.hasData ? `${health.sentPercent}%` : '—'}
              </span>
              <span className="text-xs text-primary font-extrabold uppercase tracking-wider mt-1">Taxa de Sucesso</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-accent">
            {!health.hasData ? (
              <p className="text-xs text-muted-foreground text-center py-2">Ainda não há disparos suficientes pra calcular a saúde das entregas.</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary"></span> Disparos com Sucesso
                  </span>
                  <span className="font-bold text-foreground">{health.sentPercent}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-warning"></span> Na Fila / Aguardando
                  </span>
                  <span className="font-bold text-foreground">{health.pendingPercent}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-destructive"></span> Limites Meta / Falhas
                  </span>
                  <span className="font-bold text-foreground">{health.failedPercent}%</span>
                </div>
              </>
            )}
          </div>
        </Card>

      </div>

      {/* 3. Bottom Row (Funil + Activity Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 3A: Funil Reativo de Conversão (lg:col-span-4) */}
        <Card padding="lg" className="lg:col-span-4 rounded-2xl shadow-sm flex flex-col gap-5 justify-between">
          <div>
            <h4 className="font-bold text-foreground text-base">Funil de Conversão</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Retenção e conversão por etapa do fluxo</p>
          </div>

          {funnel.comments === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Ainda não há comentários registrados pra calcular o funil.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {[
                { label: '1. Comentários Detectados', val: funnel.comments, color: 'bg-primary' },
                { label: '2. DMs de Boas-Vindas', val: funnel.welcomeDms, color: 'bg-primary/75' },
                { label: '3. Cliques no Botão / Link', val: funnel.clicks, color: 'bg-primary/50' },
                { label: '4. Leads Qualificados', val: funnel.leads, color: 'bg-success' }
              ].map((step, idx) => {
                const percent = Math.round((step.val / funnel.comments) * 100);
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className="text-foreground font-bold">{step.val} <span className="text-muted-foreground font-normal">({percent}%)</span></span>
                    </div>
                    <div className="h-3 w-full bg-accent rounded-full overflow-hidden p-0.5 border border-border">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 3B: Histórico de Envios Recentes na Fila (lg:col-span-8) */}
        <Card padding="lg" className="lg:col-span-8 rounded-2xl shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-accent pb-3">
            <div>
              <h4 className="font-bold text-foreground text-base">Envios Pendentes & Recentes na Fila</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Histórico do pipeline de entregas em tempo real</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onViewLogs} className="text-primary hover:text-primary/90 hover:bg-transparent px-0">
              Ver todos os logs →
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase text-muted-foreground font-bold border-b border-accent">
                <tr>
                  <th className="py-2.5 px-3">Contato</th>
                  <th className="py-2.5 px-3">Tipo de Ação</th>
                  <th className="py-2.5 px-3">Horário</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent">
                {recentQueue.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum disparo na fila recentemente.</td>
                  </tr>
                ) : (
                  recentQueue.slice(0, 5).map(item => (
                    <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-foreground font-bold flex items-center gap-2">
                        {item.contacts?.profile_picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL da Meta
                          <img
                            src={item.contacts.profile_picture_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover border border-border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-accent border border-border flex items-center justify-center text-xs text-primary flex-shrink-0">
                            @
                          </div>
                        )}
                        <span>
                          {item.contacts?.username
                            ? `@${item.contacts.username}`
                            : `@${item.contact_id.substring(0, 10)}...`}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-foreground text-xs">
                        {item.type === 'private_reply' && 'DM de Boas-Vindas'}
                        {item.type === 'link_dm' && 'DM com Link'}
                        {item.type === 'reminder_dm' && 'DM de Lembrete'}
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleTimeString('pt-BR')}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={item.status === 'sent' ? 'success' : item.status === 'pending' ? 'warning' : 'destructive'}
                          className="text-xs font-extrabold"
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
        <Card padding="lg" className="lg:col-span-6 rounded-2xl shadow-sm flex flex-col gap-4">
          <div>
            <h4 className="font-bold text-foreground text-base">Diagnóstico de Falhas</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Motivos mais comuns de falha nos últimos 90 dias</p>
          </div>
          {failureDiagnostics.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma falha registrada. 🎉</p>
          ) : (
            <div className="flex flex-col gap-3">
              {failureDiagnostics.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground flex-1">{f.reason}</span>
                  <span className="font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex-shrink-0">{f.count}x</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="lg" className="lg:col-span-6 rounded-2xl shadow-sm flex flex-col gap-4">
          <div>
            <h4 className="font-bold text-foreground text-base">Ranking de Automações</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Quais automações mais convertem leads</p>
          </div>
          {automationRanking.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma automação com interações ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {automationRanking.map((auto, i) => (
                <div key={auto.id} className="flex items-center gap-3 text-xs">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-foreground font-semibold flex-1 truncate">{auto.name}</span>
                  <span className="text-muted-foreground flex-shrink-0">{auto.comments} com. · {auto.clicks} cliques</span>
                  <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">{auto.leads} leads</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. Desempenho de Conteúdo (Dashboard 2.0 — PLANO_REDESIGN_2.0.md Parte 3) */}
      <DashboardContentPanel selectedAccountId={selectedAccountId} withAccount={withAccount} />

    </div>
  );
}
