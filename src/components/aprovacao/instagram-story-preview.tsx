'use client';

import React, { useState, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { ArquivoConteudo } from '@/lib/conteudo';
import { formatarUsernameInstagram } from './instagram-format';
import {
  InstagramVerifiedBadge,
  InstagramHeartIcon,
  InstagramShareIcon,
  InstagramStoryGradientRing,
} from './instagram-icons';

interface InstagramStoryPreviewProps {
  clienteNome: string;
  clienteCor?: string | null;
  clienteFotoUrl?: string | null;
  clienteInstagramUsername?: string | null;
  arquivos: ArquivoConteudo[];
  slideAtual: number;
  onMudarSlide: (novoSlide: number) => void;
  onPedirAjuste?: (slideIndex?: number) => void;
  className?: string;
}

export function InstagramStoryPreview({
  clienteNome,
  clienteCor,
  clienteFotoUrl,
  clienteInstagramUsername,
  arquivos,
  slideAtual,
  onMudarSlide,
  onPedirAjuste,
  className,
}: InstagramStoryPreviewProps) {
  const [curtido, setCurtido] = useState(false);
  const [mutado, setMutado] = useState(true);
  const [animandoCoracao, setAnimandoCoracao] = useState(false);

  const lastTapRef = useRef<number>(0);
  const coracaoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalSlides = Math.max(1, arquivos.length);
  const slideValido = Math.min(Math.max(0, slideAtual), totalSlides - 1);
  const arquivoAtual = arquivos[slideValido] || null;

  // Username oficial sem o caractere '@'
  const usernameLimpo = formatarUsernameInstagram(clienteNome, clienteInstagramUsername);

  function handleStoryClick(e: React.MouseEvent<HTMLDivElement>) {
    const agora = Date.now();
    if (agora - lastTapRef.current < 320) {
      // Duplo clique detectado: curtir com animação do coração
      setCurtido(true);
      setAnimandoCoracao(true);
      if (coracaoTimeoutRef.current) clearTimeout(coracaoTimeoutRef.current);
      coracaoTimeoutRef.current = setTimeout(() => {
        setAnimandoCoracao(false);
      }, 900);
      lastTapRef.current = agora;
      return;
    }
    lastTapRef.current = agora;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const largura = rect.width;

    if (x < largura * 0.35) {
      // Clique à esquerda (35%): volta slide anterior
      if (slideValido > 0) onMudarSlide(slideValido - 1);
    } else {
      // Clique à direita (65%): avança próximo slide
      if (slideValido < totalSlides - 1) onMudarSlide(slideValido + 1);
    }
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Moldura de Smartphone do Instagram Story (9:16) */}
      <div className={`relative w-full ${className || 'max-w-[340px] sm:max-w-[360px]'} aspect-[9/16] rounded-[32px] sm:rounded-[38px] overflow-hidden shadow-2xl bg-black border-4 border-neutral-300 dark:border-neutral-800 flex flex-col select-none`}>
        
        {/* Camada de Mídia (100% 9:16 Full Bleed sem bordas pretas) */}
        <div
          className="absolute inset-0 w-full h-full cursor-pointer"
          onClick={handleStoryClick}
        >
          {arquivos.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-muted-foreground text-xs p-6 text-center">
              Story em produção pela equipe.
            </div>
          ) : arquivoAtual?.tipo === 'video' ? (
            <video
              src={arquivoAtual.url}
              autoPlay
              loop
              muted={mutado}
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={arquivoAtual?.url}
              alt={`Story ${slideValido + 1}`}
              className="w-full h-full object-cover"
            />
          )}

          {/* Explosão de Coração no Duplo Toque */}
          {animandoCoracao && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 animate-in zoom-in-50 fade-in duration-200">
              <InstagramHeartIcon size={96} filled className="text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] animate-pulse" />
            </div>
          )}
        </div>

        {/* Degradê Superior para Legibilidade do Header */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none z-10" />

        {/* Topo: Barra de Progresso Segmentada dos Stories */}
        <div className="relative z-20 px-3 pt-3 flex items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className={`h-full bg-white transition-all duration-300 ${
                  i <= slideValido ? 'w-full' : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Header Oficial do Instagram Stories */}
        <div className="relative z-20 px-3.5 pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <InstagramStoryGradientRing size={32}>
              <ClienteAvatar
                nome={clienteNome}
                cor={clienteCor}
                fotoUrl={clienteFotoUrl}
                tamanho="xs"
                className="ring-1 ring-black"
              />
            </InstagramStoryGradientRing>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-white drop-shadow-md truncate">
                {usernameLimpo}
              </span>
              <InstagramVerifiedBadge size={13} />
              <span className="text-[10px] text-white/75 drop-shadow-sm font-medium shrink-0 ml-0.5">
                2 h
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-white/90 shrink-0">
            {arquivoAtual?.tipo === 'video' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMutado(!mutado);
                }}
                className="p-1 hover:text-white cursor-pointer"
                aria-label="Alternar som"
              >
                {mutado ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <div className="p-1 text-white/80 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Indicador de Navegação nas Laterais (aparece no hover em desktop) */}
        {totalSlides > 1 && (
          <>
            {slideValido > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMudarSlide(slideValido - 1);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center z-20 backdrop-blur-xs border border-white/10 hover:bg-black/60 cursor-pointer"
                aria-label="Story anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {slideValido < totalSlides - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMudarSlide(slideValido + 1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center z-20 backdrop-blur-xs border border-white/10 hover:bg-black/60 cursor-pointer"
                aria-label="Próximo story"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Degradê Inferior para Legibilidade do Rodapé */}
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />

        {/* Rodapé Oficial do Instagram Stories */}
        <div className="relative z-20 mt-auto px-3.5 pb-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPedirAjuste?.(slideValido + 1);
            }}
            className="flex-1 py-2 px-3.5 rounded-full border border-white/35 bg-white/10 hover:bg-white/15 backdrop-blur-md text-white/85 text-xs flex items-center justify-between cursor-pointer transition-colors"
            aria-label="Responder story / Enviar ajuste"
          >
            <span>Enviar mensagem...</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurtido(!curtido);
            }}
            className="p-1.5 text-white hover:scale-110 active:scale-125 transition-transform cursor-pointer"
            aria-label="Curtir story"
          >
            <InstagramHeartIcon size={24} filled={curtido} className={curtido ? 'text-[#FF0034]' : 'text-white'} />
          </button>
          <button
            type="button"
            className="p-1.5 text-white hover:scale-110 active:scale-125 transition-transform cursor-pointer"
            aria-label="Compartilhar"
          >
            <InstagramShareIcon size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* Botão de Atalho para Ajuste neste Story */}
      {onPedirAjuste && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPedirAjuste(slideValido + 1)}
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-accent flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-ui"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Sugerir Ajuste no Story {slideValido + 1}</span>
          </button>
        </div>
      )}
    </div>
  );
}
