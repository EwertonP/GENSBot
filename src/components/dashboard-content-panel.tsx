'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Clapperboard,
  Video,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ExternalLink,
  Filter,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

interface PublicationItem {
  id: string;
  media_type: string;
  media_url: string;
  media_count?: number;
  caption: string | null;
  published_at: string;
  reach: number;
  interactions: number;
  likes?: number;
  comments?: number;
  saves?: number;
}

interface ContentPerformance {
  summary: {
    posts: number;
    reels: number;
    stories: number;
    reachTotal: number;
    engagementRate: number;
  };
  topPublications: PublicationItem[];
  topStories: {
    id: string;
    media_url: string;
    published_at: string;
    reach: number;
  }[];
}

interface DashboardContentPanelProps {
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}

export default function DashboardContentPanel({ selectedAccountId, withAccount }: DashboardContentPanelProps) {
  const [activeFormat, setActiveFormat] = useState<'all' | 'reels' | 'posts' | 'stories'>('all');
  const [data, setData] = useState<ContentPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(withAccount(`/api/dashboard/content-performance?period=30`))
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok || !result?.summary) throw new Error();
        setData(result);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  const publications = data?.topPublications || [];
  const stories = data?.topStories || [];

  const filteredPublications = publications.filter((p) => {
    if (activeFormat === 'reels') return p.media_type === 'VIDEO' || p.media_type === 'REELS';
    if (activeFormat === 'posts') return p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL' || p.media_type === 'CAROUSEL_ALBUM';
    return true;
  });

  return (
    <Card padding="lg" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col gap-6">
      {/* Header com Filtros de Formato (Padrão Instagram Professional) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h4 className="font-bold font-display text-foreground text-lg tracking-tight">
              Conteúdo que Você Compartilhou
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publicações recentes no Instagram com alcance e engajamento oficial
          </p>
        </div>

        {/* Abas por Formato: Todos, Reels, Posts, Stories */}
        <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-2xl border border-border/80 self-start sm:self-auto shadow-2xs">
          {[
            { id: 'all' as const, label: 'Todos' },
            { id: 'reels' as const, label: 'Reels', icon: Clapperboard },
            { id: 'posts' as const, label: 'Posts & Carrosséis', icon: ImageIcon },
            { id: 'stories' as const, label: 'Stories', icon: Video },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeFormat === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFormat(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-card text-foreground shadow-2xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade Visual Fiel ao Instagram */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-accent/40 animate-pulse border border-border/60" />
          ))}
        </div>
      ) : activeFormat === 'stories' ? (
        /* Aba de Stories (Proporção 9:16) */
        stories.length === 0 ? (
          <EmptyState
            icon={Video}
            title="Nenhum story ativo nas últimas 24h"
            description="Os stories aparecem aqui assim que forem publicados no Instagram."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {stories.map((story) => (
              <div
                key={story.id}
                className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-border/80 shadow-2xs hover:shadow-xs transition-all"
              >
                <img src={story.media_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 flex flex-col justify-between p-3 pointer-events-none">
                  <span className="self-start text-[9px] font-mono font-bold bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full">
                    Story
                  </span>
                  <div className="flex items-center gap-1.5 text-white text-xs font-bold font-mono">
                    <Eye className="w-3.5 h-3.5 text-lime" />
                    <span>{story.reach.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredPublications.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhuma publicação encontrada"
          description="Publique posts ou reels para visualizar as métricas detalhadas de alcance e interação."
        />
      ) : (
        /* Grade de Publicações (Feed 4:5 e Reels 9:16) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredPublications.map((pub) => {
            const isReel = pub.media_type === 'VIDEO' || pub.media_type === 'REELS';
            const isCarousel = pub.media_type === 'CAROUSEL' || pub.media_type === 'CAROUSEL_ALBUM' || (pub.media_count && pub.media_count > 1);

            return (
              <div
                key={pub.id}
                className={`group relative rounded-2xl overflow-hidden bg-accent/60 border border-border/80 hover:border-foreground/30 shadow-2xs hover:shadow-xs transition-all flex flex-col ${
                  isReel ? 'aspect-[9/16]' : 'aspect-[4/5]'
                }`}
              >
                {/* Imagem de Capa */}
                {pub.media_url ? (
                  <img
                    src={pub.media_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent text-muted-foreground">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                  </div>
                )}

                {/* Badges Superiores (Formato) */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                  <span className="text-[10px] font-bold font-mono bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    {isReel ? (
                      <>
                        <Clapperboard className="w-3 h-3 text-lime" />
                        Reels
                      </>
                    ) : isCarousel ? (
                      <>
                        <ImageIcon className="w-3 h-3 text-lime" />
                        {pub.media_count ? `Carrossel (${pub.media_count})` : 'Carrossel'}
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3 h-3" />
                        Post
                      </>
                    )}
                  </span>
                </div>

                {/* Overlay Inferior com Métricas do Instagram */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 flex flex-col gap-1 text-white pointer-events-none z-10">
                  {pub.caption && (
                    <p className="text-[11px] font-medium line-clamp-1 text-white/90 drop-shadow-xs">
                      {pub.caption}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono font-bold pt-1 border-t border-white/20">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-lime" />
                      {pub.reach.toLocaleString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1 text-white/90">
                      <Heart className="w-3 h-3 fill-white/20" />
                      {pub.interactions}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
