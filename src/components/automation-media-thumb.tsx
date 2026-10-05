'use client';

import { Tip } from '@/components/ui/tooltip';
import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Camera, MessageCircle, Play, Layers, ImageOff } from 'lucide-react';

interface MediaLookupResult {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
}

type LoadState = { status: 'loading' } | { status: 'ok'; data: MediaLookupResult } | { status: 'error' };

// Cache em escopo de módulo — evita refetch ao reordenar/filtrar a tabela na mesma sessão.
const cache = new Map<string, LoadState>();

async function fetchMedia(id: string): Promise<LoadState> {
  try {
    const res = await fetch(`/api/instagram/media/${id}`);
    if (!res.ok) return { status: 'error' };
    const data = await res.json();
    return { status: 'ok', data };
  } catch {
    return { status: 'error' };
  }
}

interface AutomationMediaThumbProps {
  mediaId: string | null;
  kind: 'post' | 'story' | null;
  /** Usado só quando não há mediaId específico, pra escolher o ícone genérico certo. */
  triggers: string[];
}

/** Miniatura visual (post/story/reels/carrossel) de uma automação na listagem — ver plano de UX. */
export default function AutomationMediaThumb({ mediaId, kind, triggers }: AutomationMediaThumbProps) {
  const [state, setState] = useState<LoadState | null>(mediaId ? cache.get(mediaId) ?? null : null);

  useEffect(() => {
    if (!mediaId) return;
    const cached = cache.get(mediaId);
    if (cached) {
      setState(cached);
      return;
    }
    setState({ status: 'loading' });
    fetchMedia(mediaId).then((result) => {
      cache.set(mediaId, result);
      setState(result);
    });
  }, [mediaId]);

  if (!mediaId) {
    const GenericIcon = triggers.includes('story') || triggers.includes('story_mention') ? Camera : triggers.includes('comment') ? ImageIcon : MessageCircle;
    const label = triggers.includes('story') || triggers.includes('story_mention') ? 'Qualquer story' : triggers.includes('comment') ? 'Qualquer publicação' : 'Só DM';
    return (
      <Tip label={label}><div
        className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0"
      >
        <GenericIcon className="w-4 h-4 text-muted-foreground" />
      </div></Tip>
    );
  }

  if (!state || state.status === 'loading') {
    return <div className="w-11 h-11 rounded-lg bg-muted animate-pulse shrink-0" />;
  }

  if (state.status === 'error') {
    return (
      <Tip label={"Mídia indisponível (pode ter expirado ou sido removida)"}><div
        className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0"
      >
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      </div></Tip>
    );
  }

  const { media_type, media_url, thumbnail_url, permalink } = state.data;
  const imageSrc = thumbnail_url || media_url;
  const BadgeIcon = media_type === 'VIDEO' || kind === 'story' ? Play : media_type === 'CAROUSEL_ALBUM' ? Layers : null;

  if (!imageSrc) {
    return (
      <Tip label={"Prévia indisponível"}><div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      </div></Tip>
    );
  }

  const content = (
    <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária da Meta, não cabe no otimizador de imagem do Next */}
      <img src={imageSrc} alt="" className="w-full h-full object-cover" />
      {BadgeIcon && (
        <span className="absolute bottom-0.5 right-0.5 bg-black/60 rounded p-0.5">
          <BadgeIcon className="w-2.5 h-2.5 text-white" fill={BadgeIcon === Play ? 'white' : 'none'} />
        </span>
      )}
    </div>
  );

  if (!permalink) return content;

  return (
    <Tip label={"Ver no Instagram"}><a
      href={permalink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </a></Tip>
  );
}
