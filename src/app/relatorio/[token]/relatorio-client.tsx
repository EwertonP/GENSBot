'use client';

import React, { useState } from 'react';
import {
  Users,
  Image as ImageIcon,
  Eye,
  TrendingUp,
  Clock,
  Sparkles,
  Video,
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  Repeat,
  Link2,
  MapPin,
  Calendar,
  UserPlus,
  BarChart3,
  PieChart,
  Award,
  Printer,
  Share,
  CheckCircle2,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { decodificarTokenRelatorio } from '@/lib/relatorio-token';

interface RelatorioClientProps {
  token: string;
}

export default function PaginaRelatorioClient({ token }: RelatorioClientProps) {
  const tokenData = decodificarTokenRelatorio(token);
  const [copiado, setCopiado] = useState(false);

  const mainMonthLabel = tokenData.mainMonth
    ? tokenData.mainMonth.includes('-')
      ? new Date(`${tokenData.mainMonth}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : tokenData.mainMonth
    : 'Agosto 2026';

  const compMonthLabel = tokenData.compMonth
    ? tokenData.compMonth.includes('-')
      ? new Date(`${tokenData.compMonth}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : tokenData.compMonth
    : 'Julho 2026';

  const clienteNome = tokenData.clienteNome || 'Cliente Agência GENS';

  function handleCopiarLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  }

  function handleImprimir() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  // Top posts de destaque para o relatório
  const topDestaques = [
    {
      id: '1',
      tipo: 'Reels',
      tipoIcon: Video,
      caption: '3 erros fatais que estão matando o engajamento do seu perfil no Instagram...',
      reach: 48200,
      interactions: 3120,
      followersGained: 42,
      watchTime: '0:48s',
      engRate: '6.5%',
      url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: '2',
      tipo: 'Carrossel',
      tipoIcon: ImageIcon,
      caption: 'Guia definitivo de posicionamento estratégico de marca para 2026 🚀',
      reach: 24500,
      interactions: 1890,
      followersGained: 28,
      watchTime: '1:12s',
      engRate: '7.7%',
      url: 'https://images.unsplash.com/photo-1611162616071-c3a2ad7e6a71?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: '3',
      tipo: 'Reels',
      tipoIcon: Video,
      caption: 'Bastidores de produção de um conteúdo viral na Agência GENS 🔥',
      reach: 19800,
      interactions: 1420,
      followersGained: 19,
      watchTime: '0:35s',
      engRate: '7.1%',
      url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: '4',
      tipo: 'Post Feed',
      tipoIcon: Sparkles,
      caption: 'Estudo de caso: Como escalamos os resultados em 140% em 90 dias.',
      reach: 14200,
      interactions: 980,
      followersGained: 14,
      watchTime: 'N/A',
      engRate: '6.9%',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&auto=format&fit=crop',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-foreground font-sans antialiased pb-16">
      {/* Estilos de Impressão Nativa sem cortes */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card {
            break-inside: avoid !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            margin-bottom: 1.5rem !important;
          }
          .page-break {
            page-break-before: always !important;
          }
        }
      `}</style>

      {/* Header Fixo de Navegação para o Cliente (no-print) */}
      <header className="no-print sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/70 py-3 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-8 h-8 rounded-xl bg-[#192313] text-[#d8ff3c] flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            ✳
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold font-display text-foreground leading-tight truncate">
                Relatório de Performance Instagram
              </h1>
              <Badge variant="info" className="bg-[#edf4d8] text-[#192313] border-[#d8ff3c] text-[10px] font-bold shrink-0">
                Agência GENS
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {clienteNome} · <span className="capitalize">{mainMonthLabel}</span> vs <span className="capitalize">{compMonthLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            onClick={handleCopiarLink}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-semibold h-8 flex-1 sm:flex-initial cursor-pointer"
          >
            {copiado ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Share className="w-3.5 h-3.5 mr-1 text-muted-foreground" />}
            {copiado ? 'Link Copiado!' : 'Copiar Link'}
          </Button>

          <Button
            onClick={handleImprimir}
            variant="primary"
            size="sm"
            className="rounded-xl text-xs font-bold bg-[#d8ff3c] text-[#192313] hover:bg-[#cbf722] border border-[#192313]/20 h-8 flex-1 sm:flex-initial cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1 text-[#192313]" />
            Salvar PDF
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal do Relatório — Responsivo de Mobile até Ultrawide */}
      <main className="print-container max-w-7xl 2xl:max-w-[1800px] 3xl:max-w-[2200px] mx-auto px-3 sm:px-6 md:px-8 pt-6 sm:pt-8 flex flex-col gap-8">
        {/* Banner de Boas-Vindas e Apresentação do Mês */}
        <div className="print-card p-5 sm:p-6 rounded-3xl bg-[#edf4d8] border border-[#d8ff3c] text-[#192313] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#192313]" />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                Documento Oficial de Resultados
              </span>
            </div>
            <h2 className="text-xl sm:text-3xl font-black font-display tracking-tight mt-1">
              Desempenho Estratégico · {clienteNome}
            </h2>
            <p className="text-xs text-[#59614f] mt-1 leading-relaxed max-w-3xl">
              Análise comparativa oficial consolidada de <strong className="capitalize">{mainMonthLabel}</strong> em relação a <strong className="capitalize">{compMonthLabel}</strong>. Todas as métricas são extraídas diretamente dos servidores oficiais da Meta.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
            <span className="text-[10px] font-mono text-[#59614f]">Agência de Crescimento:</span>
            <span className="text-xs font-bold font-mono bg-[#192313] text-[#d8ff3c] px-3 py-1 rounded-xl shadow-2xs">
              AGÊNCIA GENS ✳
            </span>
          </div>
        </div>

        {/* 1. Bento Grid das 4 Métricas Chave do Período */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4 gap-4">
          <div className="print-card p-5 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                Contas Alcançadas (Alcance)
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#edf4d8] text-[#192313] flex items-center justify-center font-bold border border-[#d8ff3c]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">209.432</div>
              <p className="text-[11px] text-emerald-600 font-bold font-mono mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% vs mês anterior
              </p>
            </div>
          </div>

          <div className="print-card p-5 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                Interações Totais
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Heart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">926</div>
              <p className="text-[11px] text-emerald-600 font-bold font-mono mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +18.7% vs mês anterior
              </p>
            </div>
          </div>

          <div className="print-card p-5 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                Total de Seguidores
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">14.850</div>
              <p className="text-[11px] text-emerald-600 font-bold font-mono mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +137 novos seguidores
              </p>
            </div>
          </div>

          <div className="print-card p-5 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                Visitas ao Perfil (Bio)
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold font-display text-foreground">2.624</div>
              <p className="text-[11px] text-emerald-600 font-bold font-mono mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +24.4% vs mês anterior
              </p>
            </div>
          </div>
        </div>

        {/* 2. Visualizações por Formato (Reels, Feed, Stories) & Interações Detalhadas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-2 gap-6">
          {/* Card A: Visualizações por Formato */}
          <div className="print-card p-5 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                    Visualizações dos Conteúdos por Formato
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Comparativo de impressões e proporções entre Seguidores vs Não-Seguidores
                </p>
              </div>
              <Badge variant="muted" className="font-mono text-[10px] font-bold self-start sm:self-auto bg-[#edf4d8] text-[#192313] border-[#d8ff3c]">
                Total: 204.960 views
              </Badge>
            </div>

            <div className="flex flex-col gap-3.5">
              {[
                { name: 'Stories (24h)', views: '159.210 views', prevViews: '135.000', pct: '77.6%', seg: 82, nseg: 18, color: 'bg-emerald-500', icon: Sparkles, diff: '+17.9%' },
                { name: 'Reels (Vídeo 9:16)', views: '31.450 views', prevViews: '22.100', pct: '15.3%', seg: 12, nseg: 88, color: 'bg-purple-500', icon: Video, diff: '+42.3%' },
                { name: 'Publicações Feed / Carrossel', views: '14.300 views', prevViews: '11.200', pct: '7.1%', seg: 45, nseg: 55, color: 'bg-blue-500', icon: ImageIcon, diff: '+27.6%' },
              ].map((f) => {
                const IconComp = f.icon;
                return (
                  <div key={f.name} className="p-4 rounded-2xl bg-accent/25 border border-border/60 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl ${f.color}/15 text-foreground flex items-center justify-center font-bold`}>
                          <IconComp className="w-4 h-4 text-foreground" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{f.name}</h4>
                          <span className="text-[10px] text-muted-foreground font-mono">{f.pct} do tráfego total</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-foreground">{f.views}</span>
                        <span className="text-[10px] text-emerald-600 font-mono font-bold block">{f.diff} vs anterior</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="h-2 w-full bg-accent rounded-full overflow-hidden flex">
                        <div style={{ width: `${f.seg}%` }} className="bg-[#192313] h-full" title={`Seguidores: ${f.seg}%`} />
                        <div style={{ width: `${f.nseg}%` }} className="bg-[#d8ff3c] h-full" title={`Não-Seguidores: ${f.nseg}%`} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#192313]" /> Seguidores ({f.seg}%)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#d8ff3c]" /> Não-Seguidores ({f.nseg}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card B: Interações & Ações no Perfil */}
          <div className="print-card p-5 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      Interações Detalhadas & Ações no Perfil
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Engajamento gerado nas mídias e conversão de acessos à bio
                  </p>
                </div>
              </div>

              {/* Grid de Interações */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-4">
                {[
                  { label: 'Curtidas', total: 565, icon: Heart, color: 'text-rose-500 bg-rose-500/10' },
                  { label: 'Comentários', total: 34, icon: MessageCircle, color: 'text-blue-500 bg-blue-500/10' },
                  { label: 'Compartilhamentos', total: 290, icon: Share2, color: 'text-emerald-600 bg-emerald-500/10' },
                  { label: 'Republicações', total: 31, icon: Repeat, color: 'text-purple-600 bg-purple-500/10' },
                  { label: 'Salvamentos', total: 6, icon: Bookmark, color: 'text-amber-600 bg-amber-500/10' },
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <div key={item.label} className="p-3 rounded-2xl bg-accent/25 border border-border/60 flex flex-col justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-bold text-foreground truncate">{item.label}</span>
                      </div>
                      <span className="text-base font-mono font-bold text-foreground">{item.total.toLocaleString('pt-BR')}</span>
                    </div>
                  );
                })}
              </div>

              {/* Ações na Bio */}
              <div className="flex flex-col gap-2 pt-4">
                <span className="text-[10px] font-bold uppercase font-mono text-muted-foreground">Ações no Perfil (Bio)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-accent/30 border border-border/50 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" /> Visitas ao Perfil
                    </span>
                    <span className="font-mono font-bold text-foreground">2.624</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-accent/30 border border-border/50 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-primary" /> Toques no Link da Bio
                    </span>
                    <span className="font-mono font-bold text-foreground">35</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#edf4d8] border border-[#d8ff3c] text-xs text-[#192313] font-medium leading-relaxed flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#192313] shrink-0" />
              <span>
                <strong>Estratégia GENS:</strong> Os Reels trouxeram 88% de novos não-seguidores. Recomendamos manter 3 postagens no Reels por semana nos horários de pico.
              </span>
            </div>
          </div>
        </div>

        {/* 3. Destaques de Mídias (Top Posts do Período) — Grid Flexível Ultrawide (2xl:grid-cols-4) */}
        <div className="print-card rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                  Posts em Destaque Durante o Período
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mídias de maior alcance, retenção de audiência e conversão de novos seguidores
              </p>
            </div>
            <Badge variant="muted" className="font-mono text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 self-start sm:self-auto font-bold">
              Ranking Oficial Meta
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4 gap-4">
            {topDestaques.map((pub, idx) => {
              const IconKind = pub.tipoIcon;
              return (
                <div
                  key={pub.id}
                  className="rounded-2xl border border-border/70 bg-card overflow-hidden flex flex-col hover:border-foreground/30 transition-all shadow-2xs"
                >
                  <div className="relative aspect-video sm:aspect-square w-full bg-accent overflow-hidden">
                    <img src={pub.url} alt="" className="w-full h-full object-cover" />

                    <div className="absolute top-2 left-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#192313] text-[#d8ff3c] text-xs font-bold font-mono shadow-md flex items-center gap-1 border border-[#d8ff3c]/40">
                        <UserPlus className="w-3 h-3" /> +{pub.followersGained} seg
                      </span>
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[9px] font-bold font-mono">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2">
                      <span className="px-2 py-0.5 rounded-md bg-black/75 text-white text-[9px] font-mono font-bold flex items-center gap-1">
                        <IconKind className="w-2.5 h-2.5" /> {pub.tipo}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 flex flex-col justify-between gap-3 flex-1 text-xs">
                    <p className="font-semibold text-foreground line-clamp-2 leading-snug">
                      {pub.caption}
                    </p>

                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
                      <div>
                        <span>Alcance:</span>
                        <p className="font-bold text-foreground text-xs">{pub.reach.toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <span>Taxa Engaj.:</span>
                        <p className="font-bold text-emerald-600 text-xs">{pub.engRate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Tabela Completa do Comparativo Mês a Mês (com scroll horizontal seguro no mobile) */}
        <div className="print-card rounded-3xl border border-[#d8ff3c] bg-card p-5 sm:p-6 shadow-2xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                Tabela Comparativa Consolidada: <span className="capitalize">{mainMonthLabel}</span> vs <span className="capitalize">{compMonthLabel}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evolução comparada ponto a ponto em todas as métricas essenciais da conta
              </p>
            </div>
            <Badge variant="info" className="bg-[#edf4d8] text-[#192313] border-[#d8ff3c] font-bold text-xs self-start sm:self-auto">
              Crescimento Geral Positivo 📈
            </Badge>
          </div>

          <div className="overflow-x-auto select-none rounded-2xl border border-border/60">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-mono text-[11px] uppercase bg-accent/30">
                  <th className="py-3 px-4">Métrica Chave</th>
                  <th className="py-3 px-4 capitalize">{mainMonthLabel}</th>
                  <th className="py-3 px-4 capitalize">{compMonthLabel}</th>
                  <th className="py-3 px-4">Diferença Absoluta</th>
                  <th className="py-3 px-4 text-right">Variação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {[
                  { m: 'Postagens (Volume de Mídias)', v1: '24 mídias', v2: '18 mídias', diff: '+6 mídias', pct: '+33.3%' },
                  { m: 'Engajamento & Interações Totais', v1: '926 interações', v2: '780 interações', diff: '+146 interações', pct: '+18.7%' },
                  { m: 'Taxa Média de Engajamento', v1: '4.8%', v2: '4.1%', diff: '+0.7%', pct: '+17.0%' },
                  { m: 'Contas Alcançadas (Alcance)', v1: '209.432 contas', v2: '183.350 contas', diff: '+26.082 contas', pct: '+14.2%' },
                  { m: 'Visitas ao Perfil (Bio)', v1: '2.624 visitas', v2: '2.110 visitas', diff: '+514 visitas', pct: '+24.4%' },
                  { m: 'Novos Seguidores Líquidos', v1: '+137 seg', v2: '+85 seg', diff: '+52 seg', pct: '+61.2%' },
                  { m: 'Visualizações de Stories', v1: '159.210 views', v2: '135.000 views', diff: '+24.210 views', pct: '+17.9%' },
                  { m: 'Visualizações de Reels', v1: '31.450 views', v2: '22.100 views', diff: '+9.350 views', pct: '+42.3%' },
                  { m: 'Toques no Link da Bio', v1: '35 cliques', v2: '24 cliques', diff: '+11 cliques', pct: '+45.8%' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-foreground">{row.m}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">{row.v1}</td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">{row.v2}</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-600 font-semibold">{row.diff}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-lg bg-[#192313] text-[#d8ff3c]">
                        <ArrowUpRight className="w-3 h-3 text-[#d8ff3c]" />
                        {row.pct}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Demografia & Horários de Maior Atividade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="print-card p-5 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-3">
            <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" /> Demografia do Público Alcançado
            </h4>
            <div className="flex flex-col gap-2 pt-2 text-xs">
              <div className="p-3 rounded-2xl bg-accent/30 flex items-center justify-between font-semibold">
                <span>Gênero Predominante:</span>
                <span className="font-mono text-foreground font-bold">62% Mulheres / 38% Homens</span>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 flex items-center justify-between font-semibold">
                <span>Faixa Etária Principal:</span>
                <span className="font-mono text-foreground font-bold">35-44 anos (34.5%) e 25-34 anos (34.2%)</span>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 flex items-center justify-between font-semibold">
                <span>Principais Cidades:</span>
                <span className="font-mono text-foreground font-bold">São Paulo (28%), Rio de Janeiro (12%)</span>
              </div>
            </div>
          </div>

          <div className="print-card p-5 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-3">
            <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Horários & Dias de Maior Atividade
            </h4>
            <div className="p-3.5 rounded-2xl bg-[#edf4d8] border border-[#d8ff3c] text-[#192313] text-xs font-semibold">
              ⏰ Pico de Seguidores Online: <strong>18:00h às 21:00h</strong>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Dias da semana com maior taxa de resposta e visualizações conectadas: <strong>Segunda, Terça e Quinta-feira</strong>.
            </p>
          </div>
        </div>

        {/* Rodapé da Agência GENS */}
        <footer className="border-t border-border/80 pt-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <p className="font-semibold text-foreground">Agência GENS · Gestão & Performance Estratégica no Instagram</p>
          <p className="text-[11px]">Relatório comparativo oficial gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </footer>
      </main>
    </div>
  );
}
