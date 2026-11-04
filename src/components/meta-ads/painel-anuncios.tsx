'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  MousePointerClick,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  Megaphone,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { MetaAdAccount, MetaAdInsights, MetaCampaign } from '@/lib/meta-ads/types';

interface PainelAnunciosProps {
  adAccountId?: string | null;
  clienteNome?: string | null;
}

export function PainelAnuncios({ adAccountId: initialAdAccountId, clienteNome }: PainelAnunciosProps) {
  const [contas, setContas] = useState<MetaAdAccount[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState<string>(initialAdAccountId || '');
  const [campanhas, setCampanhas] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<MetaAdInsights | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [atualizandoCampanhaId, setAtualizandoCampanhaId] = useState<string | null>(null);

  // 1. Carrega contas disponíveis
  useEffect(() => {
    async function carregarContas() {
      try {
        const res = await fetch('/api/meta-ads/accounts');
        const data = await res.json();
        if (data.ok && Array.isArray(data.accounts)) {
          setContas(data.accounts);
          if (!contaSelecionada && data.accounts.length > 0) {
            setContaSelecionada(data.accounts[0].id);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar contas:', err);
      }
    }
    carregarContas();
  }, []);

  // 2. Carrega campanhas e insights da conta selecionada
  useEffect(() => {
    if (!contaSelecionada) return;

    async function carregarDadosConta() {
      setCarregando(true);
      try {
        const [resCampanhas, resInsights] = await Promise.all([
          fetch(`/api/meta-ads/campaigns?adAccountId=${encodeURIComponent(contaSelecionada)}`),
          fetch(`/api/meta-ads/insights?adAccountId=${encodeURIComponent(contaSelecionada)}&datePreset=this_month`),
        ]);

        const dataCamp = await resCampanhas.json();
        const dataIns = await resInsights.json();

        if (dataCamp.ok) setCampanhas(dataCamp.campanhas || []);
        if (dataIns.ok) setInsights(dataIns.insights || null);
      } catch (err: any) {
        console.error('Erro ao carregar dados da conta:', err);
      } finally {
        setCarregando(false);
      }
    }

    carregarDadosConta();
  }, [contaSelecionada]);

  // Alterna status da campanha (Ativo / Pausado)
  async function handleToggleStatus(campanha: MetaCampaign) {
    const novoStatus = campanha.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setAtualizandoCampanhaId(campanha.id);

    try {
      const res = await fetch('/api/meta-ads/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campanha.id,
          status: novoStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erro ao alterar campanha.');

      setCampanhas((antigas) =>
        antigas.map((c) => (c.id === campanha.id ? { ...c, status: novoStatus } : c))
      );

      toast.success(
        novoStatus === 'ACTIVE' ? 'Campanha ativada com sucesso!' : 'Campanha pausada com sucesso.'
      );
    } catch (err: any) {
      toast.error(err.message || 'Falha ao alterar status.');
    } finally {
      setAtualizandoCampanhaId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Seleção da Conta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {clienteNome ? `Meta Ads · ${clienteNome}` : 'Painel de Tráfego Pago & Anúncios'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Gerencie campanhas, orçamentos diários e acompanhe o investimento em tempo real.
            </p>
          </div>
        </div>

        {contas.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={contaSelecionada}
              onChange={(e) => setContaSelecionada(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cartões de Indicadores Chave (Métricas do Mês) */}
      {insights && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card padding="sm" className="rounded-2xl border-border shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Total Investido</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {insights.spend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <Badge variant="muted" className="mt-1.5 text-[10px]">
              Neste mês
            </Badge>
          </Card>

          <Card padding="sm" className="rounded-2xl border-border shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Leads & Conversões</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {insights.conversions.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              CPA: {insights.costPerConversion.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </Card>

          <Card padding="sm" className="rounded-2xl border-border shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Cliques no Anúncio</span>
              <MousePointerClick className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {insights.clicks.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              CPC: {insights.cpc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </Card>

          <Card padding="sm" className="rounded-2xl border-border shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Alcance & Impressões</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {insights.reach.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {insights.impressions.toLocaleString('pt-BR')} impressões
            </div>
          </Card>
        </div>
      )}

      {/* Tabela de Campanhas */}
      <div className="border border-border rounded-2xl overflow-hidden bg-background">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Campanhas do Gerenciador de Anúncios
            </h4>
            <Badge variant="muted" className="text-[10px]">
              {campanhas.length} {campanhas.length === 1 ? 'campanha' : 'campanhas'}
            </Badge>
          </div>
          {carregando && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        {campanhas.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {carregando
              ? 'Carregando campanhas do Meta Ads...'
              : 'Nenhuma campanha encontrada para esta conta de anúncios.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="py-2.5 px-4">Campanha</th>
                  <th className="py-2.5 px-4">Objetivo</th>
                  <th className="py-2.5 px-4">Orçamento Diário</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {campanhas.map((c) => {
                  const ativa = c.status === 'ACTIVE';
                  const atualizando = atualizandoCampanhaId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="truncate max-w-[260px]">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">ID: {c.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {c.objective.replace('OUTCOME_', '')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {c.dailyBudget
                          ? c.dailyBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/dia'
                          : c.lifetimeBudget
                          ? c.lifetimeBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' (total)'
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={ativa ? 'success' : 'muted'} className="text-[10px]">
                          {ativa ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={ativa ? 'secondary' : 'primary'}
                          disabled={atualizando}
                          onClick={() => handleToggleStatus(c)}
                          className="gap-1 text-[11px] h-7 cursor-pointer"
                        >
                          {atualizando ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : ativa ? (
                            <>
                              <Pause className="w-3 h-3 text-amber-500" />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 text-emerald-500" />
                              <span>Ativar</span>
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
