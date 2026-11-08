'use client';

import React, { useRef, useState } from 'react';
import {
  Play,
  Volume2,
  VolumeX,
  Disc,
  Clock,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { formatarTimecode, type ArquivoConteudo } from '@/lib/conteudo';
import { formatarUsernameInstagram } from './instagram-format';
import {
  InstagramVerifiedBadge,
  InstagramHeartIcon,
  InstagramCommentIcon,
  InstagramShareIcon,
  InstagramSaveIcon,
  InstagramOptionsIcon,
  InstagramReelsIcon,
  InstagramAudioWaveIcon,
} from './instagram-icons';

interface InstagramReelsPreviewProps {
  clienteNome: string;
  clienteCor?: string | null;
  clienteFotoUrl?: string | null;
  clienteInstagramUsername?: string | null;
  audioNome?: string | null;
  arquivoVideo?: ArquivoConteudo | null;
  titulo?: string | null;
  legenda?: string | null;
  tempoAtual: number;
  onAtualizarTempo: (segundos: number) => void;
  onPedirAjuste?: (segundos: number) => void;
  className?: string;
}

export function InstagramReelsPreview({
  clienteNome,
  clienteCor,
  clienteFotoUrl,
  clienteInstagramUsername,
  audioNome,
  arquivoVideo,
  titulo,
  legenda,
  tempoAtual,
  onAtualizarTempo,
  onPedirAjuste,
  className,
}: InstagramReelsPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pausado, setPausado] = useState(true);
  const [mutado, setMutado] = useState(false);
  const [curtido, setCurtido] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [duracaoTotal, setDuracaoTotal] = useState(0);
  const [animandoCoracao, setAnimandoCoracao] = useState(false);

  const lastTapRef = useRef<number>(0);
  const coracaoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const videoUrl = arquivoVideo?.url || '';

  // Formata o username oficial do Instagram (sem @)
  const usernameLimpo = formatarUsernameInstagram(clienteNome, clienteInstagramUsername);

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPausado(false);
    } else {
      videoRef.current.pause();
      setPausado(true);
    }
  }

  function handleVideoAreaClick() {
    const agora = Date.now();
    if (agora - lastTapRef.current < 320) {
      // Double tap para curtir com animação do coração
      setCurtido(true);
      setAnimandoCoracao(true);
      if (coracaoTimeoutRef.current) clearTimeout(coracaoTimeoutRef.current);
      coracaoTimeoutRef.current = setTimeout(() => {
        setAnimandoCoracao(false);
      }, 900);
    } else {
      togglePlay();
    }
    lastTapRef.current = agora;
  }

  function handleTimeUpdate() {
    if (videoRef.current) {
      const sec = Math.floor(videoRef.current.currentTime);
      onAtualizarTempo(sec);
    }
  }

  function handleLoadedMetadata() {
    if (videoRef.current) {
      setDuracaoTotal(Math.floor(videoRef.current.duration) || 0);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const novoTempo = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = novoTempo;
      onAtualizarTempo(novoTempo);
    }
  }

  const progressoPercent = duracaoTotal > 0 ? (tempoAtual / duracaoTotal) * 100 : 0;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Moldura de Smartphone do Instagram Reels (9:16) */}
      <div className={`relative w-full ${className || 'max-w-[340px] sm:max-w-[360px]'} aspect-[9/16] rounded-[32px] sm:rounded-[38px] overflow-hidden shadow-2xl bg-black border-4 border-neutral-300 dark:border-neutral-800 flex flex-col select-none group`}>
        
        {/* Camada do Vídeo com Toque para Play/Pause e Duplo Toque para Like */}
        <div
          className="absolute inset-0 w-full h-full bg-black flex items-center justify-center cursor-pointer"
          onClick={handleVideoAreaClick}
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              playsInline
              loop
              muted={mutado}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center text-muted-foreground text-xs">
              Vídeo Reels em processamento pela equipe.
            </div>
          )}

          {/* Explosão de Coração no Duplo Toque */}
          {animandoCoracao && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 animate-in zoom-in-50 fade-in duration-200">
              <InstagramHeartIcon size={96} filled className="text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] animate-pulse" />
            </div>
          )}

          {/* Indicador de Play/Pause Flutuante no Centro */}
          {pausado && videoUrl && !animandoCoracao && (
            <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-xl border border-white/20 transition-ui hover:scale-105 pointer-events-none">
              <Play className="w-7 h-7 ml-1 fill-white" />
            </div>
          )}
        </div>

        {/* Degradê Superior para Header do Reels */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none z-10" />

        {/* Header Superior do Reels com Ícone Oficial Figma */}
        <div className="relative z-20 px-4 pt-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <InstagramReelsIcon size={20} className="text-white" />
            <span className="text-sm font-bold tracking-tight">Reels</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMutado(!mutado);
            }}
            className="p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 hover:text-white cursor-pointer"
            aria-label="Som"
          >
            {mutado ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Trilha Lateral Direita Oficial do Reels com Vetores Figma */}
        <div className="absolute right-2.5 bottom-16 z-20 flex flex-col items-center gap-3.5 text-white">
          {/* Curtidas */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurtido(!curtido);
            }}
            className="flex flex-col items-center gap-1 group/btn cursor-pointer"
            aria-label="Curtir Reels"
          >
            <div className="p-2 rounded-full bg-black/30 backdrop-blur-xs group-hover/btn:scale-110 active:scale-125 transition-transform">
              <InstagramHeartIcon size={24} filled={curtido} className={curtido ? 'text-[#FF0034]' : 'text-white'} />
            </div>
            <span className="text-[10px] font-bold drop-shadow">18.4k</span>
          </button>

          {/* Comentário / Ajuste no Minuto */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                videoRef.current.pause();
                setPausado(true);
              }
              onPedirAjuste?.(tempoAtual);
            }}
            className="flex flex-col items-center gap-1 group/btn cursor-pointer"
            aria-label="Comentar ou sugerir ajuste"
          >
            <div className="p-2 rounded-full bg-black/30 backdrop-blur-xs group-hover/btn:scale-110 active:scale-125 transition-transform">
              <InstagramCommentIcon size={24} className="text-white" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">Ajustar</span>
          </button>

          {/* Compartilhar (Figma 2026 Glyph) */}
          <button
            type="button"
            className="flex flex-col items-center gap-1 group/btn cursor-pointer"
            aria-label="Compartilhar"
          >
            <div className="p-2 rounded-full bg-black/30 backdrop-blur-xs group-hover/btn:scale-110 active:scale-125 transition-transform">
              <InstagramShareIcon size={24} className="text-white" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">Enviar</span>
          </button>

          {/* Salvar */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSalvo(!salvo);
            }}
            className="p-2 rounded-full bg-black/30 backdrop-blur-xs text-white hover:scale-110 active:scale-125 transition-transform cursor-pointer"
            aria-label="Salvar post"
          >
            <InstagramSaveIcon size={22} filled={salvo} className="text-white" />
          </button>

          {/* Mais opções */}
          <button
            type="button"
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-xs text-white hover:text-white cursor-pointer"
            aria-label="Opções"
          >
            <InstagramOptionsIcon size={20} className="text-white" />
          </button>

          {/* Disco de Vinil Giratório */}
          <div className="w-8 h-8 rounded-full border-2 border-white/40 p-[2px] bg-neutral-900 animate-spin [animation-duration:4s] shadow-lg mt-1">
            <div className="w-full h-full rounded-full bg-neutral-800 flex items-center justify-center">
              <Disc className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Degradê Inferior para Legibilidade da Legenda */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-10" />

        {/* Informações Inferiores do Perfil & Legenda */}
        <div className="relative z-20 mt-auto px-4 pb-3 pr-16 flex flex-col gap-1.5 text-white">
          {/* Perfil + Botão Seguir */}
          <div className="flex items-center gap-2">
            <ClienteAvatar
              nome={clienteNome}
              cor={clienteCor}
              fotoUrl={clienteFotoUrl}
              tamanho="xs"
              className="ring-1 ring-white"
            />
            <span className="text-xs font-bold drop-shadow-md truncate">{usernameLimpo}</span>
            <InstagramVerifiedBadge size={13} />
            <button
              type="button"
              className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/60 text-white backdrop-blur-xs hover:bg-white/20 transition-colors shrink-0 cursor-pointer ml-1"
            >
              Seguir
            </button>
          </div>

          {/* Legenda com Expansão inline e autor colado */}
          {legenda && (
            <div className="text-xs drop-shadow leading-relaxed text-white/95">
              <span className="font-bold mr-1.5">{usernameLimpo}</span>
              <span className={expandido ? 'whitespace-pre-line' : 'line-clamp-2'}>
                {legenda}
              </span>
              {legenda.length > 50 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandido(!expandido);
                  }}
                  className="text-white/80 font-semibold ml-1 hover:underline cursor-pointer"
                >
                  {expandido ? ' menos' : '... mais'}
                </button>
              )}
            </div>
          )}

          {/* Áudio Original com Ticker Oficial */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/85 mt-0.5">
            <InstagramAudioWaveIcon size={12} className="text-white shrink-0" />
            <span className="truncate">
              {audioNome || `Áudio original · ${usernameLimpo}`}
            </span>
          </div>
        </div>

        {/* Linha do Tempo Scrubber no Rodapé do Reels */}
        <div className="relative z-20 px-3 pb-2 pt-1 bg-black/40 backdrop-blur-xs flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duracaoTotal || 100}
            value={tempoAtual}
            onChange={handleSeek}
            className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
            aria-label="Controle de tempo do Reels"
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-white/80 px-0.5">
            <span>{formatarTimecode(tempoAtual)}</span>
            <span>{formatarTimecode(duracaoTotal)}</span>
          </div>
        </div>
      </div>

      {/* Botão de Pontuar Ajuste na Minutagem Exata */}
      {onPedirAjuste && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.pause();
                setPausado(true);
              }
              onPedirAjuste(tempoAtual);
            }}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-lime hover:bg-lime/90 text-lime-foreground flex items-center gap-2 shadow-md transition-ui active:scale-95 cursor-pointer font-sans"
          >
            <Clock className="w-4 h-4 text-lime-foreground" />
            <span>Sugerir Ajuste aos {formatarTimecode(tempoAtual)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
