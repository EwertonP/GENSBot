'use client';

import React, { useState, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat,
  Send,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Volume2,
  VolumeX,
  Music2,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { ArquivoConteudo } from '@/lib/conteudo';
import {
  formatarUsernameInstagram,
  formatarTempoRelativoInstagram,
  calcularEscalaDotCarrossel,
} from './instagram-format';

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
}: InstagramCarrosselPreviewProps) {
  const [curtido, setCurtido] = useState(false);
  const [curtidasCount, setCurtidasCount] = useState(73);
  const [salvo, setSalvo] = useState(false);
  const [mutado, setMutado] = useState(true);
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

  return (
    <div className="w-full max-w-[420px] mx-auto bg-black rounded-none sm:rounded-2xl overflow-hidden flex flex-col text-white select-none border-0 sm:border sm:border-neutral-800 shadow-2xl transition-all">
      {/* 1. Header Oficial do Instagram (Idêntico ao print real: username sem @, selo azul, áudio embaixo) */}
      <div className="px-3 py-2.5 flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar com anel colorido de stories do Instagram */}
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shrink-0">
            <ClienteAvatar
              nome={clienteNome}
              cor={clienteCor}
              fotoUrl={clienteFotoUrl}
              tamanho="sm"
              className="ring-2 ring-black"
            />
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            {/* Nome do usuário em negrito sem @ + selo de verificado */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[13px] font-semibold text-white tracking-tight leading-tight truncate">
                {usernameLimpo}
              </span>
              <span
                className="w-3.5 h-3.5 bg-[#0095F6] rounded-full inline-flex items-center justify-center text-[9px] font-black text-white shrink-0 ml-0.5"
                title="Verificado"
              >
                ✓
              </span>
            </div>

            {/* Linha de Áudio: Ícone de música + faixa de áudio */}
            <div className="flex items-center gap-1 text-[11px] text-white/90 leading-none mt-0.5 truncate">
              <Music2 className="w-3 h-3 text-white shrink-0" />
              <span className="truncate">
                {audioNome || `Áudio original · ${usernameLimpo}`}
              </span>
            </div>
          </div>
        </div>

        {/* Menu de Três Pontinhos do Instagram à direita */}
        <button
          type="button"
          className="p-1 text-white/90 hover:text-white cursor-pointer"
          aria-label="Mais opções"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Área Visual 4:5 da Mídia com Suporte a Swipe Touch e Duplo Toque */}
      <div
        className="relative w-full aspect-[4/5] bg-neutral-950 flex items-center justify-center overflow-hidden select-none group touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleMediaTap}
      >
        {totalSlides === 0 ? (
          <div className="text-center p-6 text-neutral-400 text-xs">
            <p>Mídia em processamento pela equipe.</p>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {arquivoAtual?.tipo === 'video' ? (
              <video
                src={arquivoAtual.url}
                controls={false}
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
                alt={`Slide ${slideValido + 1}`}
                className="w-full h-full object-cover transition-opacity duration-200"
              />
            )}

            {/* Explosão de Coração no Duplo Toque */}
            {animandoCoracao && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 animate-in zoom-in-50 fade-in duration-200">
                <Heart className="w-24 h-24 fill-white text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)] animate-pulse" />
              </div>
            )}

            {/* Botão de Som / Mute no Canto Inferior Direito (como no print real) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMutado(!mutado);
              }}
              className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-md border border-white/10 hover:bg-black/80 transition-ui cursor-pointer z-10"
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
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
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
        <div className="flex items-center justify-center gap-1 pt-2 pb-1 bg-black">
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
                    : '!w-1.5 !h-1.5 bg-neutral-600/80 hover:bg-neutral-500'
                }`}
                aria-label={`Ir para slide ${i + 1}`}
              />
            );
          })}
        </div>
      )}

      {/* 4. Nova Barra de Ações Oficial do Instagram com Contadores em Linha */}
      <div className="px-3.5 py-1.5 flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-4">
          {/* Curtir + Contagem */}
          <button
            type="button"
            onClick={handleToggleCurtir}
            className="flex items-center gap-1.5 hover:opacity-80 active:scale-110 transition-transform cursor-pointer"
            aria-label="Curtir"
          >
            <Heart
              strokeWidth={1.8}
              className={`w-6 h-6 transition-colors ${
                curtido ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
            <span className="text-[13px] font-semibold text-white tracking-tight">
              {curtidasCount}
            </span>
          </button>

          {/* Comentários / Solicitar Ajuste + Contagem */}
          <button
            type="button"
            onClick={() => onPedirAjuste?.(slideValido + 1)}
            className="flex items-center gap-1.5 hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-white"
            aria-label="Comentar ou solicitar ajuste"
          >
            <MessageCircle strokeWidth={1.8} className="w-6 h-6 text-white" />
            <span className="text-[13px] font-semibold text-white tracking-tight">2</span>
          </button>

          {/* Repost Oficial + Contagem */}
          <button
            type="button"
            className="flex items-center gap-1.5 hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-white"
            aria-label="Repostar"
          >
            <Repeat strokeWidth={1.8} className="w-5 h-5 text-white" />
            <span className="text-[13px] font-semibold text-white tracking-tight">1</span>
          </button>

          {/* Compartilhar / Direct */}
          <button
            type="button"
            className="hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-white p-0.5"
            aria-label="Compartilhar"
          >
            <Send strokeWidth={1.8} className="w-6 h-6 text-white -rotate-45" />
          </button>
        </div>

        {/* Salvar na Extrema Direita */}
        <button
          type="button"
          onClick={() => setSalvo(!salvo)}
          className="hover:opacity-80 active:scale-110 transition-transform cursor-pointer text-white p-0.5"
          aria-label="Salvar publicação"
        >
          <Bookmark
            strokeWidth={1.8}
            className={`w-6 h-6 transition-colors ${
              salvo ? 'fill-white text-white' : 'text-white'
            }`}
          />
        </button>
      </div>

      {/* 5. Bloco de Legenda Oficial (Idêntico ao print real: username em negrito colado no texto + '... mais' inline) */}
      <div className="px-3.5 pt-1.5 pb-3 flex flex-col gap-1 text-[13px] bg-black text-white">
        {legenda ? (
          <div className="leading-snug text-white/95">
            <span className="font-bold mr-1.5 text-white">{usernameLimpo}</span>
            <span className={expandido ? 'whitespace-pre-line' : 'line-clamp-2'}>
              {legenda}
            </span>
            {legenda.length > 50 && (
              <button
                type="button"
                onClick={() => setExpandido(!expandido)}
                className="text-[13px] text-neutral-400 ml-1 font-normal hover:text-white cursor-pointer inline"
              >
                {expandido ? ' menos' : '... mais'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic">Sem legenda definida.</p>
        )}

        {/* Timestamp Oficial em Minúsculas ("há 3 horas") */}
        <p className="text-[11px] text-neutral-400 font-normal mt-0.5">
          {tempoRelativo}
        </p>
      </div>
    </div>
  );
}
