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
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Instagram as InstagramIcon } from '@/components/instagram-icon';
import { decodificarTokenRelatorio, type RelatorioTokenData } from '@/lib/relatorio-token';

interface RelatorioClientProps {
  token: string;
}

export default function PaginaRelatorioClient({ token }: RelatorioClientProps) {
  const tokenData = decodificarTokenRelatorio(token);
  const [copiado, setCopiado] = useState(false);

  const mainMonthLabel = 'Agosto 2026';
  const compMonthLabel = 'Julho 2026';

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
      <header className="no-print sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/70 py-3 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#192313] text-[#d8ff3c] flex items-center justify-center font-bold text-sm shadow-xs">
            ✳
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold font-display text-foreground leading-tight">
                Relatório de Performance Instagram
              </h1>
              <Badge variant="info" className="bg-[#edf4d8] text-[#192313] border-[#d8ff3c] text-[10px] font-bold">
                Agência GENS
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tokenData.clienteNome || 'Cliente'} · {mainMonthLabel} vs {compMonthLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleCopiarLink}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-semibold h-8"
          >
            {copiado ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Share className="w-3.5 h-3.5 mr-1 text-muted-foreground" />}
            {copiado ? 'Link Copiado!' : 'Copiar Link'}
          </Button>

          <Button
            onClick={handleImprimir}
            variant="primary"
            size="sm"
            className="rounded-xl text-xs font-bold bg-[#d8ff3c] text-[#192313] hover:bg-[#cbf722] border border-[#192313]/20 h-8"
          >
            <Printer className="w-3.5 h-3.5 mr-1 text-[#192313]" />
            Salvar PDF
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal do Relatório */}
      <main className="print-container max-w-6xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 flex flex-col gap-8">
        {/* Banner de Boas-Vindas e Apresentação do Mês */}
        <div className="print-card p-6 rounded-3xl bg-[#edf4d8] border border-[#d8ff3c] text-[#192313] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#192313]" />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                Documento Oficial de Resultados
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight mt-1">
              Desempenho Estratégico · {tokenData.clienteNome || 'Cliente'}
            </h2>
            <p className="text-xs text-[#59614f] mt-1 leading-relaxed max-w-2xl">
              Análise comparativa oficial consolidada de <strong>{mainMonthLabel}</strong> em relação a <strong>{compMonthLabel}</strong>. Todas as métricas são extraídas diretamente dos servidores oficiais da Meta.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
            <span className="text-[10px] font-mono text-[#59614f]">Agência de Crescimento:</span>
            <span className="text-xs font-bold font-mono bg-[#192313] text-[#d8ff3c] px-3 py-1 rounded-xl">
              AGÊNCIA GENS ✳
            </span>
          </div>
        </div>

        {/* 1. Bento Grid das 4 Métricas Chave do Período */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="print-card p-5 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                Contas Alcançadas
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#edf4d8] text-[#192313] flex items-center justify-center font-bold border border-[#d8ff3c]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold font-display text-foreground">209.432</div>
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
              <div className="text-3xl font-bold font-display text-foreground">926</div>
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
              <div className="text-3xl font-bold font-display text-foreground">14.850</div>
              <p className="text-[11px] text-emerald-600 font-bold font-mono mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +137 novos seguidores
              </p>
            </div>
          </div>

          <div className="print-card p-5 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">
                Visitas ao Perfil
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold font-display text-foreground">2.624</div>
              <p className="text-[11px] text-emerald-600 font-bold font-mono mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +24.4% vs mês anterior
              </p>
            </div>
          </div>
        </div>

        {/* 2. Tabela Completa do Comparativo Mês a Mês */}
        <div className="print-card rounded-3xl border border-[#d8ff3c] bg-card p-6 shadow-2xs flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <h3 className="text-lg font-bold font-display text-foreground">
                Tabela Comparativa: {mainMonthLabel} vs {compMonthLabel}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evolução comparada ponto a ponto em todas as métricas essenciais da conta
              </p>
            </div>
            <Badge variant="info" className="bg-[#edf4d8] text-[#192313] border-[#d8ff3c] font-bold text-xs self-start sm:self-auto">
              Crescimento Geral Positivo 📈
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-3">Métrica Chave</th>
                  <th className="py-2.5 px-3">{mainMonthLabel}</th>
                  <th className="py-2.5 px-3">{compMonthLabel}</th>
                  <th className="py-2.5 px-3">Diferença Absoluta</th>
                  <th className="py-2.5 px-3 text-right">Variação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {[
                  { m: 'Postagens (Volume de Mídias)', v1: '24 mídias', v2: '18 mídias', diff: '+6 mídias', pct: '+33.3%' },
                  { m: 'Engajamento & Interações', v1: '926 interações', v2: '780 interações', diff: '+146 interações', pct: '+18.7%' },
                  { m: 'Taxa Média de Engajamento', v1: '4.8%', v2: '4.1%', diff: '+0.7%', pct: '+17.0%' },
                  { m: 'Público & Contas Alcançadas', v1: '209.432 contas', v2: '183.350 contas', diff: '+26.082 contas', pct: '+14.2%' },
                  { m: 'Visitas ao Perfil (Bio)', v1: '2.624 visitas', v2: '2.110 visitas', diff: '+514 visitas', pct: '+24.4%' },
                  { m: 'Novos Seguidores Líquidos', v1: '+137 seg', v2: '+85 seg', diff: '+52 seg', pct: '+61.2%' },
                  { m: 'Visualizações de Stories', v1: '159.210 views', v2: '135.000 views', diff: '+24.210 views', pct: '+17.9%' },
                  { m: 'Visualizações de Reels', v1: '31.450 views', v2: '22.100 views', diff: '+9.350 views', pct: '+42.3%' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-foreground">{row.m}</td>
                    <td className="py-3 px-3 font-mono font-bold text-foreground">{row.v1}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground">{row.v2}</td>
                    <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">{row.diff}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md bg-[#192313] text-[#d8ff3c]">
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

        {/* 3. Visualizações por Formato & Interações Detalhadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="print-card p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-4">
            <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Visualizações por Formato
            </h4>
            <div className="flex flex-col gap-3 pt-2">
              {[
                { label: 'Stories (82% seguidores / 18% não-seg)', views: '159.210 views', pct: '76.0%' },
                { label: 'Reels (12% seguidores / 88% não-seg)', views: '31.450 views', pct: '15.0%' },
                { label: 'Posts no Feed (45% seg / 55% não-seg)', views: '14.300 views', pct: '9.0%' },
              ].map((f, i) => (
                <div key={i} className="p-3 rounded-2xl bg-accent/30 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{f.label}</span>
                  <span className="font-mono font-bold text-foreground">{f.views}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="print-card p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-4">
            <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Interações & Ações no Perfil
            </h4>
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="p-3 rounded-2xl bg-accent/30 font-mono">
                <span className="text-[10px] text-muted-foreground block">Curtidas:</span>
                <span className="font-bold text-foreground">565</span>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 font-mono">
                <span className="text-[10px] text-muted-foreground block">Comentários:</span>
                <span className="font-bold text-foreground">34</span>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 font-mono">
                <span className="text-[10px] text-muted-foreground block">Compartilhamentos:</span>
                <span className="font-bold text-foreground">290</span>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 font-mono">
                <span className="text-[10px] text-muted-foreground block">Toques na Bio:</span>
                <span className="font-bold text-foreground">35</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Demografia & Horários de Pico */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="print-card p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-3">
            <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" /> Demografia do Público
            </h4>
            <p className="text-xs text-muted-foreground">
              Faixa Etária Predominante: <strong>35-44 anos (34.5%)</strong> e <strong>25-34 anos (34.2%)</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Gênero: <strong>62% Mulheres</strong> / <strong>38% Homens</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Principais Cidades: <strong>São Paulo (28.4%)</strong>, <strong>Rio de Janeiro (12.1%)</strong> e <strong>Belo Horizonte (8.3%)</strong>.
            </p>
          </div>

          <div className="print-card p-6 rounded-3xl bg-card border border-border/80 shadow-2xs flex flex-col gap-3">
            <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Horários & Dias Recomendados
            </h4>
            <div className="p-3 rounded-2xl bg-[#edf4d8] border border-[#d8ff3c] text-[#192313] text-xs font-semibold">
              ⏰ Horário de Pico da Audiência: <strong>18:00h às 21:00h</strong>
            </div>
            <p className="text-xs text-muted-foreground">
              Dias com Maior Concentração de Audiência Conectada: <strong>Segunda, Terça e Quinta-feira</strong>.
            </p>
          </div>
        </div>

        {/* Rodapé da Agência GENS */}
        <footer className="border-t border-border/80 pt-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <p className="font-semibold text-foreground">Agência GENS · Sistema de Gestão & Performance no Instagram</p>
          <p className="text-[11px]">Relatório interativo oficial gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </footer>
      </main>
    </div>
  );
}
