'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Globe,
  Sparkles,
  ArrowRight,
  Eye,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export interface ShowcaseItem {
  id: string;
  type: 'instagram_reels' | 'instagram_carousel' | 'blog_post';
  title: string;
  subtitle?: string;
  imageUrl: string;
  date: string;
  metrics: {
    views?: string;
    likes?: string;
    comments?: string;
    saves?: string;
  };
  linkUrl?: string;
  badge?: string;
}

interface VisualSystemShowcaseProps {
  items?: ShowcaseItem[];
  title?: string;
  subtitle?: string;
}

export function VisualSystemShowcase({
  items,
  title = 'Vitrine Visual de Entregáveis & Ativos no Ar',
  subtitle = 'Peças produzidas, publicadas nas redes sociais e indexadas no blog do cliente',
}: VisualSystemShowcaseProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const defaultItems: ShowcaseItem[] = [
    {
      id: 'item-1',
      type: 'instagram_carousel',
      title: '5 Hábitos que Aceleram o Crescimento da Sua Empresa',
      subtitle: 'Carrossel educativo estratégico focado em autoridade e salvamentos.',
      imageUrl: '/api/placeholder/400/500',
      date: 'Publicado ontem',
      badge: 'Instagram Feed',
      metrics: {
        views: '14.2k',
        likes: '640',
        comments: '88',
        saves: '210',
      },
    },
    {
      id: 'item-2',
      type: 'blog_post',
      title: 'Como Reduzir Custos de Aquisição com Conteúdo Orgânico',
      subtitle: 'Artigo longo otimizado para SEO no novo Cloudflare CMS da marca.',
      imageUrl: '/api/placeholder/400/500',
      date: 'Publicado em 05/11',
      badge: 'Blog & Google SEO',
      metrics: {
        views: '3.8k',
        likes: '120',
        comments: '19',
        saves: '85',
      },
      linkUrl: 'https://gensbot-cms.ewertonphillipe18.workers.dev',
    },
    {
      id: 'item-3',
      type: 'instagram_reels',
      title: 'Bastidores: A Verdade sobre Escala no Digital',
      subtitle: 'Reels dinâmico com cortes rápidos e identidade visual v7.',
      imageUrl: '/api/placeholder/400/500',
      date: 'Publicado em 02/11',
      badge: 'Reels / Vídeo',
      metrics: {
        views: '28.9k',
        likes: '1.240',
        comments: '142',
        saves: '390',
      },
    },
  ];

  const showcaseItems = items && items.length > 0 ? items : defaultItems;
  const activeItem = showcaseItems[selectedIdx] || showcaseItems[0];

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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Multi-canal: Redes Sociais + Blog</span>
        </div>
      </div>

      {/* Grid Principal: Mockup Visual à esquerda + Lista de Peças à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Mockup de Celular / Tablet (5 colunas) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[320px] rounded-[2.5rem] p-3.5 bg-neutral-900 shadow-2xl border-4 border-neutral-800 relative">
            {/* Notch / Speaker */}
            <div className="w-24 h-4 bg-neutral-800 rounded-full mx-auto mb-3" />

            {/* Tela Interna do Mockup */}
            <div className="rounded-2xl overflow-hidden bg-card border border-border flex flex-col">
              {/* Header do App */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs font-semibold">
                <span className="text-brand-text truncate">
                  {activeItem.badge}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {activeItem.date}
                </span>
              </div>

              {/* Imagem / Capa simulada */}
              <div className="relative aspect-square bg-gradient-to-br from-primary/20 via-secondary to-muted flex items-center justify-center p-4 text-center overflow-hidden">
                <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px]" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                    {activeItem.type === 'blog_post' ? (
                      <Globe className="w-6 h-6" />
                    ) : (
                      <Sparkles className="w-6 h-6" />
                    )}
                  </div>
                  <h5 className="text-xs font-bold font-display text-foreground line-clamp-3">
                    {activeItem.title}
                  </h5>
                </div>
              </div>

              {/* Barra de Ações Sociais */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-destructive fill-destructive/20" />
                    <span className="text-[11px]">{activeItem.metrics.likes || '450'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{activeItem.metrics.comments || '32'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px]">{activeItem.metrics.saves || '85'}</span>
                </div>
              </div>
            </div>

            {/* Botão de Home Bar */}
            <div className="w-28 h-1 bg-neutral-700 rounded-full mx-auto mt-3" />
          </div>
        </div>

        {/* Lista de Ativos Interativos (7 colunas) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1">
            Selecione uma peça para inspecionar
          </div>

          {showcaseItems.map((item, idx) => {
            const isSelected = selectedIdx === idx;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedIdx(idx)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30'
                    : 'bg-card border-border hover:border-border-strong hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === 'blog_post'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    {item.type === 'blog_post' ? (
                      <Globe className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-brand-text">
                        {item.badge}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.date}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground line-clamp-1 mt-0.5">
                      {item.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Métricas da Peça */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <div className="text-right">
                    <div className="text-xs font-bold text-foreground">
                      {item.metrics.views || '10k+'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Visualizações
                    </div>
                  </div>
                  {item.linkUrl && (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors"
                      title="Abrir no Blog"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
