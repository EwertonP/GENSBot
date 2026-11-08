'use client';

import React from 'react';
import {
  Sparkles,
  Video,
  Palette,
  Send,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Globe,
  MessageCircle,
} from 'lucide-react';

export interface TransformationStep {
  id: string;
  stepNumber: string;
  title: string;
  description: string;
  count: number;
  unit: string;
  status: 'completed' | 'in_progress' | 'pending';
  icon: React.ReactNode;
  tags?: string[];
}

interface TransformationPipelineProps {
  steps?: TransformationStep[];
  title?: string;
  subtitle?: string;
}

export function TransformationPipeline({
  steps,
  title = 'Esteira de Transformação de Conteúdo & Negócios',
  subtitle = 'Como transformamos ideias brutas em autoridade, tráfego orgânico e novos clientes',
}: TransformationPipelineProps) {
  const defaultSteps: TransformationStep[] = [
    {
      id: 'estrategia',
      stepNumber: '01',
      title: 'Estratégia & Pautas',
      description: 'Mapeamento de dores do cliente, persona e roteiros validados.',
      count: 24,
      unit: 'temas definidos',
      status: 'completed',
      icon: <Sparkles className="w-5 h-5 text-brand-text" />,
      tags: ['Posicionamento', 'Pesquisa de Nicho'],
    },
    {
      id: 'captacao',
      stepNumber: '02',
      title: 'Captação & Gravação',
      description: 'Gravação orientada em estúdio ou presencial com direcionamento.',
      count: 18,
      unit: 'vídeos captados',
      status: 'completed',
      icon: <Video className="w-5 h-5 text-primary" />,
      tags: ['Direção de Cena', 'Áudio Profissional'],
    },
    {
      id: 'pos_producao',
      stepNumber: '03',
      title: 'Edição & Design',
      description: 'Cortes dinâmicos, identidade visual v7, capas e legendas otimizadas.',
      count: 22,
      unit: 'peças diagramadas',
      status: 'completed',
      icon: <Palette className="w-5 h-5 text-primary" />,
      tags: ['Motion & Legendas', 'Carrosséis'],
    },
    {
      id: 'publicacao',
      stepNumber: '04',
      title: 'Publicação & Blog SEO',
      description: 'Distribuição nas redes e transposição em artigos ricos no Cloudflare CMS.',
      count: 16,
      unit: 'posts & matérias',
      status: 'in_progress',
      icon: <Globe className="w-5 h-5 text-lime" />,
      tags: ['Instagram', 'Artigos de Blog', 'Google'],
    },
    {
      id: 'impacto',
      stepNumber: '05',
      title: 'Conversão & Resultados',
      description: 'Engajamento real transformado em leads no CRM e faturamento.',
      count: 384,
      unit: 'oportunidades geradas',
      status: 'in_progress',
      icon: <TrendingUp className="w-5 h-5 text-success" />,
      tags: ['DMs Convertidas', 'Pipeline Comercial'],
    },
  ];

  const items = steps && steps.length > 0 ? steps : defaultSteps;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-lg font-bold font-display text-foreground tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-xs font-semibold text-brand-text self-start sm:self-auto">
          <span>●</span> Ciclo Ativo de Produção
        </div>
      </div>

      {/* Grid de Etapas */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 relative">
        {items.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isInProgress = step.status === 'in_progress';

          return (
            <div
              key={step.id}
              className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 group ${
                isInProgress
                  ? 'bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20'
                  : isCompleted
                  ? 'bg-secondary/40 border-border hover:border-border-strong'
                  : 'bg-muted/40 border-dashed border-border'
              }`}
            >
              {/* Topo do Card de Etapa */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-secondary">
                  ETAPA {step.stepNumber}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isInProgress
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  {step.icon}
                </div>
              </div>

              {/* Informações da Etapa */}
              <div className="flex flex-col gap-1.5 flex-1">
                <h4 className="text-sm font-bold text-foreground tracking-tight">
                  {step.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Métrica da Etapa */}
              <div className="mt-4 pt-3 border-t border-border/50 flex flex-col gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-display text-foreground">
                    {step.count}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {step.unit}
                  </span>
                </div>

                {/* Tags da etapa */}
                {step.tags && (
                  <div className="flex flex-wrap gap-1">
                    {step.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
