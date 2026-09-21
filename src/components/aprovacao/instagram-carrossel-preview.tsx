'use client';

import React, { useState } from 'react';
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

interface InstagramCarrosselPreviewProps {
  clienteNome: string;
  clienteCor?: string | null;
  clienteFotoUrl?: string | null;
  arquivos: ArquivoConteudo[];
  titulo?: string | null;
  legenda?: string | null;
  slideAtual: number;
  onMudarSlide: (novoSlide: number) => void;
  onPedirAjuste?: (slideIndex: number) => void;
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

  const totalSlides = arquivos.length;
  const slideValido = Math.min(Math.max(0, slideAtual), Math.max(0, totalSlides - 1));
  const arquivoAtual = arquivos[slideValido] || null;

  function proximoSlide() {
    if (slideValido < totalSlides - 1) onMudarSlide(slideValido + 1);
  }

  function slideAnterior() {
    if (slideValido > 0) onMudarSlide(slideValido - 1);
  }

  return (
    <div className="w-full max-w-[420px] mx-auto bg-card rounded-3xl border border-border/80 shadow-xl overflow-hidden flex flex-col transition-all">
      {/* 1. Header do Post Estilo Instagram */}
      <div className="px-3.5 py-3 flex items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600">
            <ClienteAvatar
              nome={clienteNome}
              cor={clienteCor}
              fotoUrl={clienteFotoUrl}
              tamanho="sm"
              className="ring-2 ring-card"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground leading-none">{clienteNome}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
              <span className="text-[10px] font-semibold text-primary">Seguindo</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
              {totalSlides > 1 ? `Carrossel (${totalSlides} fotos)` : 'Publicação no Feed'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-accent/70 border border-border/60 text-muted-foreground">
            4:5 Portrait
          </span>
          <button type="button" className="p-1 hover:text-foreground text-muted-foreground" aria-label="Opções">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Área Visual 4:5 (Sem Barras Pretas) */}
      <div className="relative w-full aspect-[4/5] bg-neutral-950 flex items-center justify-center overflow-hidden select-none group">
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
                className="w-full h-full object-cover transition-transform duration-300"
              />
            )}

            {/* Contador de Slides Flutuante no Topo Direito (1/5) */}
            {totalSlides > 1 && (
              <div className="absolute top-3 right-3 bg-black/70 text-white backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold shadow-md border border-white/15">
                {slideValido + 1}/{totalSlides}
              </div>
            )}

            {/* Setas de Navegação do Carrossel */}
            {totalSlides > 1 && (
              <>
                {slideValido > 0 && (
                  <button
                    type="button"
                    onClick={slideAnterior}
                    aria-label="Slide anterior"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 text-black hover:bg-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {slideValido < totalSlides - 1 && (
                  <button
                    type="button"
                    onClick={proximoSlide}
                    aria-label="Próximo slide"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 text-black hover:bg-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            {/* Botão de Atalho Rápido para Ajuste no Slide Ativo */}
            {onPedirAjuste && (
              <button
                type="button"
                onClick={() => onPedirAjuste(slideValido + 1)}
                className="absolute bottom-3 right-3 bg-black/75 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/20 flex items-center gap-1 shadow-md transition-all active:scale-95"
              >
                <Sparkles className="w-3 h-3 text-lime" />
                <span>Ajustar Slide #{slideValido + 1}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Barra de Ações Oficiais do Instagram */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/40 bg-card text-foreground">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCurtido(!curtido)}
            className="hover:scale-110 transition-transform"
            aria-label="Curtir"
          >
            <Heart
              className={`w-5 h-5 ${curtido ? 'fill-red-500 text-red-500' : 'text-foreground'}`}
            />
          </button>
          <button
            type="button"
            onClick={() => onPedirAjuste?.(slideValido + 1)}
            className="hover:scale-110 transition-transform"
            aria-label="Comentar / Ajustar"
          >
            <MessageCircle className="w-5 h-5 text-foreground" />
          </button>
          <button
            type="button"
            className="hover:scale-110 transition-transform"
            aria-label="Compartilhar"
          >
            <Send className="w-5 h-5 text-foreground -rotate-45" />
          </button>
        </div>

        {/* Paginação por Bolinhas Centrada */}
        {totalSlides > 1 && (
          <div className="flex items-center gap-1.5">
            {arquivos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onMudarSlide(i)}
                className={`transition-all rounded-full ${
                  slideValido === i
                    ? 'w-4 h-1.5 bg-blue-500'
                    : 'w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-600 hover:bg-neutral-500'
                }`}
                aria-label={`Ir para slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setSalvo(!salvo)}
          className="hover:scale-110 transition-transform"
          aria-label="Salvar"
        >
          <Bookmark className={`w-5 h-5 ${salvo ? 'fill-foreground text-foreground' : 'text-foreground'}`} />
        </button>
      </div>

      {/* 4. Bloco de Legenda Oficial do Instagram */}
      <div className="p-3.5 flex flex-col gap-1.5 text-xs text-foreground bg-card">
        {titulo && (
          <h3 className="font-bold text-xs text-foreground font-display">{titulo}</h3>
        )}

        {legenda ? (
          <div className="text-xs leading-relaxed text-foreground/90">
            <span className="font-bold mr-1.5">{clienteNome}</span>
            <span className={expandido ? 'whitespace-pre-line' : 'line-clamp-3'}>
              {legenda}
            </span>
            {legenda.length > 120 && (
              <button
                type="button"
                onClick={() => setExpandido(!expandido)}
                className="text-[11px] text-muted-foreground ml-1 font-semibold hover:underline"
              >
                {expandido ? 'menos' : '...mais'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Sem legenda definida.</p>
        )}
      </div>
    </div>
  );
}
