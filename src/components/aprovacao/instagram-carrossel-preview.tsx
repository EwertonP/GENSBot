'use client';

import React, { useState, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { ArquivoConteudo } from '@/lib/conteudo';
import { formatarHandleInstagram, calcularEscalaDotCarrossel } from './instagram-format';

interface InstagramCarrosselPreviewProps {
  clienteNome: string;
  clienteCor?: string | null;
  clienteFotoUrl?: string | null;
  arquivos: ArquivoConteudo[];
  titulo?: string | null;
  legenda?: string | null;
  slideAtual: number;
  onMudarSlide: (novoSlide: number) => void;
  onPedirAjuste?: (slideIndex?: number) => void;
}

export function InstagramCarrosselPreview({
  clienteNome,
  clienteCor,
  clienteFotoUrl,
  arquivos,
  titulo,
  legenda,
  slideAtual,
  onMudarSlide,
  onPedirAjuste,
}: InstagramCarrosselPreviewProps) {
  const [curtido, setCurtido] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [animandoCoracao, setAnimandoCoracao] = useState(false);

  // Controle de Gestos de Toque (Swipe Mobile)
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const coracaoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalSlides = arquivos.length;
  const slideValido = Math.min(Math.max(0, slideAtual), Math.max(0, totalSlides - 1));
  const arquivoAtual = arquivos[slideValido] || null;

  // Formata o username estilo handle oficial do Instagram (@username)
  const handleInstagram = formatarHandleInstagram(clienteNome);

  function proximoSlide() {
    if (slideValido < totalSlides - 1) onMudarSlide(slideValido + 1);
  }

  function slideAnterior() {
    if (slideValido > 0) onMudarSlide(slideValido - 1);
  }

  // Gestos de Deslize por Toque no Celular (Swipe)
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Apenas considera swipe horizontal predominante com distância mínima de 40px
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        proximoSlide();
      } else {
        slideAnterior();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }

  // Double-tap ou Duplo Clique para Curtir com explosão de coração animado
  function handleMediaTap() {
    const agora = Date.now();
    if (agora - lastTapRef.current < 320) {
      // Duplo toque detectado!
      setCurtido(true);
      setAnimandoCoracao(true);
      if (coracaoTimeoutRef.current) clearTimeout(coracaoTimeoutRef.current);
      coracaoTimeoutRef.current = setTimeout(() => {
        setAnimandoCoracao(false);
      }, 900);
    }
    lastTapRef.current = agora;
  }

  return (
    <div className="w-full max-w-[420px] mx-auto bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xl overflow-hidden flex flex-col transition-all">
      {/* 1. Header Oficial do Post Estilo Instagram */}
      <div className="px-3.5 py-3 flex items-center justify-between border-b border-border/70 bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar com anel gradiente de Stories do Instagram */}
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shrink-0">
            <ClienteAvatar
              nome={clienteNome}
              cor={clienteCor}
              fotoUrl={clienteFotoUrl}
              tamanho="sm"
              className="ring-2 ring-card"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-foreground leading-none truncate">
                {handleInstagram}
              </span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
              <span className="text-[11px] font-semibold text-primary shrink-0">Seguindo</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none truncate">
              {totalSlides > 1 ? `Carrossel (${totalSlides} itens)` : 'Publicação no Feed'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
          <button
            type="button"
            className="p-1.5 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
            aria-label="Mais opções"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Área Visual 4:5 com Suporte a Swipe Touch e Double-Tap */}
      <div
        className="relative w-full aspect-[4/5] bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center overflow-hidden select-none group touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleMediaTap}
      >
        {totalSlides === 0 ? (
          <div className="text-center p-6 text-muted-foreground text-xs">
            <p>Mídia em processamento pela equipe.</p>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {arquivoAtual?.tipo === 'video' ? (
              <video
                src={arquivoAtual.url}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={arquivoAtual?.url}
                alt={`Slide ${slideValido + 1}`}
                className="w-full h-full object-cover transition-opacity duration-200"
              />
            )}

            {/* Explosão de Coração no Duplo Toque */}
            {animandoCoracao && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 animate-in zoom-in-50 fade-in duration-200">
                <Heart className="w-24 h-24 fill-white text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] animate-pulse" />
              </div>
            )}

            {/* Contador de Slides Flutuante no Topo Direito (1/4) */}
            {totalSlides > 1 && (
              <div className="absolute top-3 right-3 bg-black/70 text-white backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold shadow-md border border-white/15 pointer-events-none z-10">
                {slideValido + 1}/{totalSlides}
              </div>
            )}

            {/* Setas de Navegação (Desktop / Hover) */}
            {totalSlides > 1 && (
              <>
                {slideValido > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      slideAnterior();
                    }}
                    aria-label="Slide anterior"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 text-black hover:bg-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 z-10 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {slideValido < totalSlides - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      proximoSlide();
                    }}
                    aria-label="Próximo slide"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 text-black hover:bg-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 z-10 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            {/* Botão de Atalho Rápido para Ajuste */}
            {onPedirAjuste && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPedirAjuste(slideValido + 1);
                }}
                className="absolute bottom-3 right-3 bg-black/75 hover:bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/20 flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer z-10"
              >
                <Sparkles className="w-3.5 h-3.5 text-lime" />
                <span>Ajustar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Barra de Ações Oficiais do Instagram */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/70 bg-card text-foreground">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => setCurtido(!curtido)}
            className="hover:scale-110 active:scale-125 transition-transform cursor-pointer p-0.5"
            aria-label="Curtir"
          >
            <Heart
              strokeWidth={1.8}
              className={`w-6 h-6 transition-colors ${
                curtido ? 'fill-red-500 text-red-500' : 'text-foreground'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => onPedirAjuste?.(slideValido + 1)}
            className="hover:scale-110 active:scale-125 transition-transform cursor-pointer p-0.5 text-foreground"
            aria-label="Comentar / Solicitar Ajuste"
          >
            <MessageCircle strokeWidth={1.8} className="w-6 h-6 text-foreground" />
          </button>
          <button
            type="button"
            className="hover:scale-110 active:scale-125 transition-transform cursor-pointer p-0.5 text-foreground"
            aria-label="Compartilhar"
          >
            <Send strokeWidth={1.8} className="w-6 h-6 text-foreground -rotate-45" />
          </button>
        </div>

        {/* Paginação por Bolinhas Centrada (Estilo Oficial Instagram) */}
        {totalSlides > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-1">
            {arquivos.map((_, i) => {
              const estaAtivo = slideValido === i;
              const tamanhoEscala = calcularEscalaDotCarrossel(i, slideValido, totalSlides);

              return (
                <button
                  key={i}
                  type="button"
                  data-carousel-dot="true"
                  onClick={() => onMudarSlide(i)}
                  className={`rounded-full !min-w-0 !min-h-0 border-0 p-0 cursor-pointer transition-all duration-200 ${tamanhoEscala} ${
                    estaAtivo
                      ? '!w-2 !h-2 bg-[#0095F6] shadow-xs'
                      : '!w-1.5 !h-1.5 bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500'
                  }`}
                  aria-label={`Ir para slide ${i + 1}`}
                />
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setSalvo(!salvo)}
          className="hover:scale-110 active:scale-125 transition-transform cursor-pointer p-0.5"
          aria-label="Salvar"
        >
          <Bookmark
            strokeWidth={1.8}
            className={`w-6 h-6 transition-colors ${
              salvo ? 'fill-foreground text-foreground' : 'text-foreground'
            }`}
          />
        </button>
      </div>

      {/* 4. Bloco de Legenda Oficial do Instagram */}
      <div className="p-3.5 flex flex-col gap-1 text-xs text-foreground bg-card">
        {/* Linha de Curtidas */}
        <p className="font-semibold text-xs text-foreground mb-0.5">
          Curtido por <span className="font-bold">agenciagens</span> e{' '}
          <span className="font-bold">{curtido ? 'você e outras pessoas' : 'outras pessoas'}</span>
        </p>

        {titulo && (
          <h3 className="font-bold text-xs text-foreground font-display leading-tight">{titulo}</h3>
        )}

        {legenda ? (
          <div className="text-xs leading-relaxed text-foreground">
            <span className="font-bold mr-1.5 text-foreground">{handleInstagram}</span>
            <span className={expandido ? 'whitespace-pre-line' : 'line-clamp-2'}>
              {legenda}
            </span>
            {legenda.length > 70 && (
              <button
                type="button"
                onClick={() => setExpandido(!expandido)}
                className="text-xs text-muted-foreground ml-1 font-normal hover:text-foreground cursor-pointer"
              >
                {expandido ? ' menos' : '... mais'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Sem legenda definida.</p>
        )}

        {/* Timestamp Oficial em Caixa Alta */}
        <p className="text-[10px] uppercase text-muted-foreground/80 tracking-wider font-medium mt-1">
          HÁ 2 HORAS
        </p>
      </div>
    </div>
  );
}
