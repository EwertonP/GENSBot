'use client';

import React, { useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { ArquivoConteudo } from '@/lib/conteudo';
import {
  formatarUsernameInstagram,
  formatarTempoRelativoInstagram,
  calcularEscalaDotCarrossel,
} from './instagram-format';
import {
  InstagramVerifiedBadge,
  InstagramHeartIcon,
  InstagramCommentIcon,
  InstagramShareIcon,
  InstagramSaveIcon,
  InstagramOptionsIcon,
  InstagramRepostIcon,
  InstagramAudioWaveIcon,
  InstagramStoryGradientRing,
} from './instagram-icons';

interface InstagramCarrosselPreviewProps {
  clienteNome: string;
  clienteCor?: string | null;
  clienteFotoUrl?: string | null;
  clienteInstagramUsername?: string | null;
  audioNome?: string | null;
  arquivos: ArquivoConteudo[];
  titulo?: string | null;
  legenda?: string | null;
  dataCriacao?: string | Date | null;
  slideAtual: number;
  onMudarSlide: (novoSlide: number) => void;
  onPedirAjuste?: (slideIndex?: number) => void;
  className?: string;
}

export function InstagramCarrosselPreview({
  clienteNome,
  clienteCor,
  clienteFotoUrl,
  clienteInstagramUsername,
  audioNome,
  arquivos,
  legenda,
  dataCriacao,
  slideAtual,
  onMudarSlide,
  onPedirAjuste,
  className,
}: InstagramCarrosselPreviewProps) {
  const [curtido, setCurtido] = useState(false);
  const [curtidasCount, setCurtidasCount] = useState(73);
  const [salvo, setSalvo] = useState(false);
  const [mutado, setMutado] = useState(true);
  const [expandido, setExpandido] = useState(false);
  const [animandoCoracao, setAnimandoCoracao] = useState(false);

  // Controle de Gestos de Arraste e Toque (Swipe Mobile + Desktop Drag)
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const currentDeltaRef = useRef(0);
  const lastTapRef = useRef<number>(0);
  const coracaoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalSlides = arquivos.length;
  const slideValido = Math.min(Math.max(0, slideAtual), Math.max(0, totalSlides - 1));

  // Username oficial sem o caractere '@' (ex: byvickmachado, ph__cursos)
  const usernameLimpo = formatarUsernameInstagram(clienteNome, clienteInstagramUsername);
  const tempoRelativo = formatarTempoRelativoInstagram(dataCriacao);

  function proximoSlide() {
    if (slideValido < totalSlides - 1) onMudarSlide(slideValido + 1);
  }

  function slideAnterior() {
    if (slideValido > 0) onMudarSlide(slideValido - 1);
  }

  function handleToggleCurtir() {
    if (curtido) {
      setCurtido(false);
      setCurtidasCount((prev) => Math.max(0, prev - 1));
    } else {
      setCurtido(true);
      setCurtidasCount((prev) => prev + 1);
    }
  }

  // Double-tap ou Duplo Clique para Curtir com explosão de coração animado
  function handleMediaTap() {
    const agora = Date.now();
    if (agora - lastTapRef.current < 320) {
      if (!curtido) {
        setCurtido(true);
        setCurtidasCount((prev) => prev + 1);
      }
      setAnimandoCoracao(true);
      if (coracaoTimeoutRef.current) clearTimeout(coracaoTimeoutRef.current);
      coracaoTimeoutRef.current = setTimeout(() => {
        setAnimandoCoracao(false);
      }, 900);
    }
    lastTapRef.current = agora;
  }

  // Gestos de Deslize por Toque no Celular (Touch)
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (totalSlides <= 1) return;
    startXRef.current = e.touches[0].clientX;
    currentDeltaRef.current = 0;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const delta = e.touches[0].clientX - startXRef.current;
    let damping = 1;
    if ((slideValido === 0 && delta > 0) || (slideValido === totalSlides - 1 && delta < 0)) {
      damping = 0.25;
    }
    const finalDelta = delta * damping;
    currentDeltaRef.current = finalDelta;
    setDragDeltaX(finalDelta);
  }

  function handleTouchEnd() {
    if (!isDragging) {
      handleMediaTap();
      return;
    }
    const delta = currentDeltaRef.current;
    setIsDragging(false);
    setDragDeltaX(0);

    if (Math.abs(delta) > 40) {
      if (delta < 0 && slideValido < totalSlides - 1) {
        proximoSlide();
      } else if (delta > 0 && slideValido > 0) {
        slideAnterior();
      }
    } else if (Math.abs(delta) < 5) {
      handleMediaTap();
    }
  }

  // Gestos de Deslize por Mouse no Desktop (Drag)
  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (totalSlides <= 1) return;
    isMouseDownRef.current = true;
    startXRef.current = e.clientX;
    currentDeltaRef.current = 0;
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isMouseDownRef.current || !isDragging) return;
    const delta = e.clientX - startXRef.current;
    let damping = 1;
    if ((slideValido === 0 && delta > 0) || (slideValido === totalSlides - 1 && delta < 0)) {
      damping = 0.25;
    }
    const finalDelta = delta * damping;
    currentDeltaRef.current = finalDelta;
    setDragDeltaX(finalDelta);
  }

  function handleMouseUp() {
    if (!isMouseDownRef.current && !isDragging) return;
    const delta = currentDeltaRef.current;
    isMouseDownRef.current = false;
    setIsDragging(false);
    setDragDeltaX(0);

    if (Math.abs(delta) > 40) {
      if (delta < 0 && slideValido < totalSlides - 1) {
        proximoSlide();
      } else if (delta > 0 && slideValido > 0) {
        slideAnterior();
      }
    } else if (Math.abs(delta) < 5) {
      handleMediaTap();
    }
  }

  function handleMouseLeave() {
    if (isMouseDownRef.current || isDragging) {
      handleMouseUp();
    }
  }

  return (
    <div className={`w-full ${className || 'max-w-[420px]'} mx-auto bg-white dark:bg-black rounded-none sm:rounded-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white select-none border-0 sm:border border-[#dbdfe4] dark:border-neutral-800 shadow-2xl transition-all`}>
      {/* 1. Header Oficial do Instagram (Idêntico ao print real: username sem @, selo azul oficial, áudio embaixo) */}
      <div className="px-3.5 py-2.5 flex items-center justify-between bg-white dark:bg-black text-neutral-900 dark:text-white border-b border-neutral-100 dark:border-neutral-900/60">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar com anel colorido oficial de stories do Instagram */}
          <InstagramStoryGradientRing size={36}>
            <ClienteAvatar
              nome={clienteNome}
              cor={clienteCor}
              fotoUrl={clienteFotoUrl}
              tamanho="xs"
              className="ring-2 ring-white dark:ring-black"
            />
          </InstagramStoryGradientRing>

          <div className="min-w-0 flex flex-col justify-center">
            {/* Nome do usuário em negrito sem @ + selo de verificado oficial */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[13px] font-semibold text-neutral-900 dark:text-white tracking-tight leading-tight truncate">
                {usernameLimpo}
              </span>
              <InstagramVerifiedBadge size={14} className="ml-0.5 shrink-0" />
            </div>

            {/* Linha de Áudio: Ícone de música oficial + faixa de áudio */}
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-white/80 leading-none mt-0.5 truncate">
              <InstagramAudioWaveIcon size={12} className="text-neutral-700 dark:text-white shrink-0" />
              <span className="truncate">
                {audioNome || `Áudio original · ${usernameLimpo}`}
              </span>
            </div>
          </div>
        </div>

        {/* Menu de Três Pontinhos do Instagram à direita (Figma SVG) */}
        <button
          type="button"
          className="p-1 text-neutral-700 dark:text-white/90 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
          aria-label="Mais opções"
        >
          <InstagramOptionsIcon size={20} className="text-neutral-900 dark:text-white" />
        </button>
      </div>

      {/* 2. Área Visual 4:5 da Mídia com Efeito de Deslize Fluído de Carrossel */}
      <div
        className={`relative w-full aspect-[4/5] bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center overflow-hidden select-none group touch-pan-y ${
          totalSlides > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {totalSlides === 0 ? (
          <div className="text-center p-6 text-neutral-400 text-xs">
            <p>Mídia em processamento pela equipe.</p>
          </div>
        ) : (
          <div className="relative w-full h-full overflow-hidden">
            {/* Trilho de Slides com Transição Deslizante por Cima da Imagem Atual */}
            <div
              className="flex w-full h-full will-change-transform"
              style={{
                transform: `translateX(calc(-${slideValido * 100}% + ${dragDeltaX}px))`,
                transition: isDragging
                  ? 'none'
                  : 'transform 360ms cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            >
              {arquivos.map((arquivo, idx) => (
                <div
                  key={arquivo.id || idx}
                  className="w-full h-full shrink-0 relative overflow-hidden bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center select-none shadow-[-16px_0_32px_rgba(0,0,0,0.5)]"
                  style={{ zIndex: idx }}
                >
                  {arquivo.tipo === 'video' ? (
                    <video
                      src={arquivo.url}
                      controls={false}
                      autoPlay={idx === slideValido}
                      loop
                      muted={mutado}
                      playsInline
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={arquivo.url}
                      alt={`Slide ${idx + 1}`}
                      className="w-full h-full object-cover pointer-events-none select-none"
                      draggable={false}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Contador de Slides Flutuante no Topo Direito (1/3) Estilo Oficial Instagram */}
            {totalSlides > 1 && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 dark:bg-black/70 backdrop-blur-md text-[11px] font-sans font-semibold text-white shadow-md border border-white/10 pointer-events-none z-20">
                {slideValido + 1}/{totalSlides}
              </div>
            )}

            {/* Explosão de Coração no Duplo Toque */}
            {animandoCoracao && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 animate-in zoom-in-50 fade-in duration-200">
                <InstagramHeartIcon size={96} filled className="text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)] animate-pulse" />
              </div>
            )}

            {/* Botão de Som / Mute no Canto Inferior Direito (como no print real) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMutado(!mutado);
              }}
              className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-md border border-white/10 hover:bg-black/80 transition-ui cursor-pointer z-20"
              aria-label={mutado ? 'Ativar som' : 'Desativar som'}
            >
              {mutado ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

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
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 dark:bg-black/50 text-neutral-900 dark:text-white hover:bg-white dark:hover:bg-black/80 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-0 group-hover:opacity-100 z-20 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 dark:bg-black/50 text-neutral-900 dark:text-white hover:bg-white dark:hover:bg-black/80 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-0 group-hover:opacity-100 z-20 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Bolinhas de Paginação Oficiais do Instagram (Posicionadas na base da foto) */}
      {totalSlides > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2 pb-1 bg-white dark:bg-black">
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
                    ? '!w-1.5 !h-1.5 bg-[#0095F6]'
                    : '!w-1.5 !h-1.5 bg-neutral-300 dark:bg-neutral-600/80 hover:bg-neutral-400 dark:hover:bg-neutral-500'
                }`}
                aria-label={`Ir para slide ${i + 1}`}
              />
            );
          })}
        </div>
      )}

      {/* 4. Nova Barra de Ações Oficial do Instagram com Ícones Vetoriais Figma */}
      <div className="px-3.5 py-2 flex items-center justify-between bg-white dark:bg-black text-neutral-900 dark:text-white">
        <div className="flex items-center gap-4">
          {/* Curtir + Contagem */}
          <button
            type="button"
            onClick={handleToggleCurtir}
            className="flex items-center gap-1.5 hover:opacity-80 active:scale-110 transition-transform cursor-pointer"
            aria-label="Curtir"
          >
            <InstagramHeartIcon
              size={24}
              filled={curtido}
              className={`transition-colors ${curtido ? 'text-[#FF0034]' : 'text-neutral-900 dark:text-white'}`}
            />
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-white tracking-tight">
              {curtidasCount}
            </span>
          </button>

          {/* Comentários / Solicitar Ajuste + Contagem */}
          <button
            type="button"
            onClick={() => onPedirAjuste?.(slideValido + 1)}
            className="flex items-center gap-1.5 hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-neutral-900 dark:text-white"
            aria-label="Comentar ou solicitar ajuste"
          >
            <InstagramCommentIcon size={24} className="text-neutral-900 dark:text-white" />
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-white tracking-tight">2</span>
          </button>

          {/* Repost Oficial + Contagem */}
          <button
            type="button"
            className="flex items-center gap-1.5 hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-neutral-900 dark:text-white"
            aria-label="Repostar"
          >
            <InstagramRepostIcon size={22} className="text-neutral-900 dark:text-white" />
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-white tracking-tight">1</span>
          </button>

          {/* Compartilhar / Direct (Figma 2026 Glyph) */}
          <button
            type="button"
            className="hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-neutral-900 dark:text-white p-0.5"
            aria-label="Compartilhar"
          >
            <InstagramShareIcon size={24} className="text-neutral-900 dark:text-white" />
          </button>
        </div>

        {/* Salvar na Extrema Direita */}
        <button
          type="button"
          onClick={() => setSalvo(!salvo)}
          className="hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-neutral-900 dark:text-white p-0.5"
          aria-label="Salvar publicação"
        >
          <InstagramSaveIcon size={24} filled={salvo} className="text-neutral-900 dark:text-white" />
        </button>
      </div>

      {/* 5. Bloco de Legenda Oficial (Idêntico ao print real: username em negrito colado no texto + '... mais' inline) */}
      <div className="px-3.5 pt-1.5 pb-3 flex flex-col gap-1 text-[13px] bg-white dark:bg-black text-neutral-900 dark:text-white">
        {legenda ? (
          <div className="leading-snug text-neutral-900 dark:text-white/95">
            <span className="font-bold mr-1.5 text-neutral-900 dark:text-white">{usernameLimpo}</span>
            <span className={expandido ? 'whitespace-pre-line' : 'line-clamp-2'}>
              {legenda}
            </span>
            {legenda.length > 50 && (
              <button
                type="button"
                onClick={() => setExpandido(!expandido)}
                className="text-[13px] text-neutral-500 dark:text-neutral-400 ml-1 font-normal hover:text-neutral-900 dark:hover:text-white cursor-pointer inline"
              >
                {expandido ? ' menos' : '... mais'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">Sem legenda definida.</p>
        )}

        {/* Timestamp Oficial em Minúsculas ("há 3 horas") */}
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-normal mt-0.5 uppercase">
          {tempoRelativo}
        </p>
      </div>
    </div>
  );
}
