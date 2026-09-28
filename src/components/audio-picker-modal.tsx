'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  Music,
  Search,
  Play,
  Pause,
  ExternalLink,
  Sparkles,
  Check,
  X,
  Loader2,
  Volume2,
  Flame,
  Coffee,
  Briefcase,
  Zap,
} from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram } from '@/components/instagram-icon';
import type { TrendingTrack } from '@/app/api/instagram/trending-audios/route';
import { cn } from '@/lib/utils';

export interface AudioPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTrack: (track: TrendingTrack) => void;
  currentAudioName?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Todos em Alta', icon: Sparkles },
  { id: 'viral', label: 'Viral Reels', icon: Flame },
  { id: 'aesthetic', label: 'Aesthetic & Lofi', icon: Coffee },
  { id: 'business', label: 'Business & Inspiração', icon: Briefcase },
  { id: 'pop', label: 'Pop & Eletrônica', icon: Zap },
] as const;

export function AudioPickerModal({
  open,
  onClose,
  onSelectTrack,
  currentAudioName,
}: AudioPickerModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tracks, setTracks] = useState<TrendingTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Debounce do campo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Carrega faixas quando categoria ou busca mudam
  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoading(true);

    const params = new URLSearchParams();
    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    } else if (selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    }

    fetch(`/api/instagram/trending-audios?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao buscar faixas');
        return res.json();
      })
      .then((data) => {
        if (active) {
          setTracks(data.tracks || []);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar músicas em alta:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, debouncedQuery, selectedCategory]);

  // Limpa áudio se fechar o modal
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingTrackId(null);
  };

  useEffect(() => {
    if (!open) {
      stopAudio();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const handleTogglePlay = (track: TrendingTrack) => {
    if (!track.preview_url) return;

    // Se já estiver tocando esta mesma música, pausa
    if (playingTrackId === track.id) {
      stopAudio();
      return;
    }

    // Interrompe qualquer áudio anterior
    stopAudio();

    try {
      const audio = new Audio(track.preview_url);
      audioRef.current = audio;
      setPlayingTrackId(track.id);

      audio.onended = () => {
        setPlayingTrackId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingTrackId(null);
        audioRef.current = null;
      };

      audio.play().catch((err) => {
        console.warn('Erro ao reproduzir áudio:', err);
        setPlayingTrackId(null);
      });
    } catch (err) {
      console.warn('Falha ao inicializar áudio:', err);
      setPlayingTrackId(null);
    }
  };

  const handleSelect = (track: TrendingTrack) => {
    stopAudio();
    onSelectTrack(track);
    onClose();
  };

  const isCurrentSelection = (track: TrendingTrack) => {
    if (!currentAudioName) return false;
    const cleanCurrent = currentAudioName.trim().toLowerCase();
    const cleanTrack = track.display_name.trim().toLowerCase();
    return cleanCurrent === cleanTrack || cleanCurrent.includes(track.title.toLowerCase());
  };

  return (
    <DialogShell
      open={open}
      onRequestClose={() => {
        stopAudio();
        onClose();
      }}
      aria-label="Explorar Músicas em Alta no Instagram"
      className="w-full max-w-2xl bg-card border-border shadow-2xl flex flex-col max-h-[85vh] rounded-3xl overflow-hidden"
    >
      {/* Header com Título & Fechar */}
      <div className="p-5 pb-3 border-b border-border flex items-start justify-between gap-3 bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-2xs">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Músicas & Áudios em Alta no Instagram
              </h2>
              <Badge variant="info" className="text-[10px] gap-1 px-1.5 py-0">
                <Volume2 className="w-3 h-3" />
                Prévia 30s
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descubra tendências sonoras para Reels e Carrosséis, ouça o trecho e vincule ao seu post.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            stopAudio();
            onClose();
          }}
          className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="p-4 border-b border-border/80 flex flex-col gap-3 bg-accent/5">
        {/* Input de Busca */}
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por nome da música, cantor ou estilo (ex: Alok, Billie Eilish, Lofi)..."
            className="h-10 pl-10 pr-9 w-full rounded-2xl bg-accent/25 border border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categorias (Desabilitadas temporariamente durante busca ativa por texto) */}
        {!searchQuery.trim() && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border hover:bg-accent/30'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de Músicas com Scroll */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 divide-y divide-border/30">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs font-medium">Buscando áudios e prévias sonoras...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Music className="w-10 h-10 opacity-30 stroke-[1.5]" />
            <p className="text-sm font-semibold text-foreground">Nenhuma música encontrada</p>
            <p className="text-xs max-w-sm">
              Tente buscar por outro artista ou termo, ou explore uma das categorias em alta acima.
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs rounded-xl"
              >
                Limpar pesquisa
              </Button>
            )}
          </div>
        ) : (
          tracks.map((track) => {
            const isPlaying = playingTrackId === track.id;
            const isSelected = isCurrentSelection(track);

            return (
              <div
                key={track.id}
                className={cn(
                  'pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-2xl transition-all border border-transparent',
                  isPlaying && 'bg-primary/5 border-primary/20 shadow-2xs',
                  isSelected && 'bg-primary/10 border-primary/30',
                  !isPlaying && !isSelected && 'hover:bg-accent/20 hover:border-border/60'
                )}
              >
                {/* Artwork & Informações da Faixa */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Capa do Álbum com Botão Play sobreposto */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-accent/40 shrink-0 border border-border group">
                    {track.artwork_url ? (
                      <img
                        src={track.artwork_url}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Music className="w-5 h-5" />
                      </div>
                    )}

                    {/* Botão Play / Pause overlay */}
                    {track.preview_url && (
                      <button
                        type="button"
                        onClick={() => handleTogglePlay(track)}
                        className={cn(
                          'absolute inset-0 flex items-center justify-center transition-all bg-black/40 text-white cursor-pointer',
                          isPlaying ? 'opacity-100 bg-black/60' : 'opacity-0 group-hover:opacity-100'
                        )}
                        title={isPlaying ? 'Pausar prévia' : 'Ouvir prévia (30s)'}
                        aria-label={isPlaying ? 'Pausar prévia' : 'Ouvir prévia'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-primary fill-primary" />
                        ) : (
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Detalhes da Música */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate max-w-[260px] sm:max-w-[340px]">
                        {track.title}
                      </span>
                      {isPlaying && (
                        <div className="flex items-center gap-0.5 h-3 ml-1" title="Reproduzindo">
                          <span className="w-0.5 bg-primary h-3 animate-pulse" />
                          <span className="w-0.5 bg-primary h-2 animate-pulse [animation-delay:150ms]" />
                          <span className="w-0.5 bg-primary h-3.5 animate-pulse [animation-delay:300ms]" />
                          <span className="w-0.5 bg-primary h-1.5 animate-pulse [animation-delay:450ms]" />
                        </div>
                      )}
                    </div>

                    <span className="text-[11px] text-muted-foreground truncate">
                      {track.artist}
                    </span>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-semibold text-muted-foreground/80 bg-accent/40 px-1.5 py-0.5 rounded-md">
                        {track.category_label || track.genre || 'Música'}
                      </span>

                      {/* Link direto para o Instagram */}
                      <a
                        href={track.instagram_search_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 inline-flex"
                        title="Ver no Instagram"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Instagram className="w-2.5 h-2.5" />
                        Instagram
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Ações (Play / Selecionar) */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {/* Botão Play rápido para mobile */}
                  {track.preview_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isPlaying ? 'primary' : 'secondary'}
                      onClick={() => handleTogglePlay(track)}
                      className={cn(
                        'w-8 h-8 p-0 rounded-xl sm:hidden',
                        isPlaying && 'animate-pulse'
                      )}
                      aria-label={isPlaying ? 'Pausar áudio' : 'Tocar áudio'}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </Button>
                  )}

                  {/* Botão Selecionar */}
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'secondary' : 'primary'}
                    onClick={() => handleSelect(track)}
                    className={cn(
                      'text-xs rounded-xl px-3 py-1.5 gap-1.5 font-bold transition-all',
                      isSelected
                        ? 'border border-primary/30 text-primary bg-primary/10'
                        : 'shadow-xs hover:shadow-sm'
                    )}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-primary" />
                        Selecionado
                      </>
                    ) : (
                      'Usar no Post'
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé Informativo */}
      <div className="p-3.5 px-5 border-t border-border bg-accent/10 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Músicas em alta aumentam o alcance orgânico em até 40% no Reels e Carrosséis.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            stopAudio();
            onClose();
          }}
          className="text-xs font-semibold text-foreground hover:underline ml-2"
        >
          Concluir
        </button>
      </div>
    </DialogShell>
  );
}
