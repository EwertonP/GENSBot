'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Copy,
  Check,
  ExternalLink,
  Music,
  Share2,
  Sparkles,
  Layers,
  FileText,
  MapPin,
  User,
  X,
  Play,
  Pause,
  AlertCircle,
} from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { Instagram } from '@/components/instagram-icon';
import type { TrendingTrack } from '@/app/api/instagram/trending-audios/route';
import { cn } from '@/lib/utils';

export interface PublishAppKitModalProps {
  open: boolean;
  onClose: () => void;
  mediaUrls: string[];
  caption: string;
  audioName?: string | null;
  selectedTrack?: TrendingTrack | null;
  collaborators?: string[];
  locationName?: string | null;
  accountUsername?: string | null;
}

export function PublishAppKitModal({
  open,
  onClose,
  mediaUrls,
  caption,
  audioName,
  selectedTrack,
  collaborators = [],
  locationName,
  accountUsername,
}: PublishAppKitModalProps) {
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedAudio, setCopiedAudio] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  const displayAudioName = selectedTrack?.display_name || audioName || 'Música do Instagram';
  const instagramAudioSearchUrl =
    selectedTrack?.instagram_search_url ||
    `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(displayAudioName)}`;

  // Para a reprodução de áudio ao fechar
  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handleTogglePlay = () => {
    if (!selectedTrack?.preview_url) return;
    if (isPlayingAudio) {
      stopAudio();
    } else {
      stopAudio();
      const a = new Audio(selectedTrack.preview_url);
      audioPlayerRef.current = a;
      a.onended = () => setIsPlayingAudio(false);
      a.onerror = () => setIsPlayingAudio(false);
      a.play().catch(() => setIsPlayingAudio(false));
      setIsPlayingAudio(true);
    }
  };

  // Copia a legenda completa
  const handleCopyCaption = () => {
    let textToCopy = caption.trim();
    if (collaborators.length > 0) {
      const collabTags = collaborators.map((c) => `@${c.replace(/^@/, '')}`).join(' ');
      textToCopy += `\n\nCom ${collabTags}`;
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedCaption(true);
    toast.success('Legenda copiada para a área de transferência!');
    setTimeout(() => setCopiedCaption(false), 2500);
  };

  // Copia o nome do áudio
  const handleCopyAudioName = () => {
    navigator.clipboard.writeText(displayAudioName);
    setCopiedAudio(true);
    toast.success('Nome da música copiado!');
    setTimeout(() => setCopiedAudio(false), 2500);
  };

  // Download das mídias
  const handleDownloadAllMedia = async () => {
    if (mediaUrls.length === 0) return;
    setDownloading(true);

    try {
      for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i];
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const ext = url.match(/\.(mp4|mov|webm)/i) ? 'mp4' : 'jpg';
        a.download = `post-slide-${i + 1}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
      toast.success(`${mediaUrls.length} mídia(s) baixada(s) com sucesso!`);
    } catch (err) {
      console.error('Erro ao baixar mídias:', err);
      // Fallback: abre as URLs em novas abas
      mediaUrls.forEach((url) => window.open(url, '_blank'));
      toast.info('Mídias abertas em novas abas para salvar.');
    } finally {
      setDownloading(false);
    }
  };

  // Compartilhar Kit Completo no WhatsApp
  const handleShareWhatsApp = () => {
    const lines = [
      `🚀 *KIT DE PUBLICAÇÃO NO INSTAGRAM*`,
      accountUsername ? `📱 *Conta:* ${accountUsername}` : '',
      locationName ? `📍 *Localização:* ${locationName}` : '',
      collaborators.length > 0
        ? `👥 *Colaboradores:* ${collaborators.map((c) => `@${c.replace(/^@/, '')}`).join(' ')}`
        : '',
      `🎵 *Música:* ${displayAudioName}`,
      `🔗 *Áudio no Instagram:* ${instagramAudioSearchUrl}`,
      '',
      `📝 *LEGENDA DO POST:*`,
      caption || '(Sem legenda)',
      '',
      `📂 *MÍDIAS:*`,
      ...mediaUrls.map((u, i) => `Slide ${i + 1}: ${u}`),
    ]
      .filter((l) => l !== '')
      .join('\n');

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <DialogShell
      open={open}
      onRequestClose={() => {
        stopAudio();
        onClose();
      }}
      aria-label="Kit de Publicação no App com Música"
      className="w-full max-w-xl bg-card border-border shadow-2xl flex flex-col max-h-[90vh] rounded-3xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 pb-3.5 border-b border-border flex items-start justify-between gap-3 bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-2xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Kit de Publicação no App com Música
              </h2>
              <Badge variant="brand" className="text-[10px] gap-1 px-1.5 py-0 font-bold">
                <Sparkles className="w-3 h-3" />
                Oficial Meta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tudo pronto para postar o carrossel no aplicativo do Instagram com a música oficial tocando.
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

      {/* Conteúdo com Scroll */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Bloco 1: A Música Oficial no Instagram */}
        <div className="p-4 rounded-2xl bg-accent/20 border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <Music className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">1. Trilha Sonora Oficial</span>
            </div>
            <Badge variant="muted" className="text-[10px]">
              Biblioteca do Instagram
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-accent shrink-0 border border-border">
                {selectedTrack?.artwork_url ? (
                  <img
                    src={selectedTrack.artwork_url}
                    alt={selectedTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Music className="w-5 h-5" />
                  </div>
                )}
                {selectedTrack?.preview_url && (
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title={isPlayingAudio ? 'Pausar prévia' : 'Ouvir prévia'}
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4 text-primary fill-primary" />
                    ) : (
                      <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                    )}
                  </button>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {selectedTrack?.title || displayAudioName}
                </span>
                {selectedTrack?.artist && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {selectedTrack.artist}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyAudioName}
                className="h-8 text-xs rounded-xl px-2.5 gap-1"
                title="Copiar nome do áudio"
              >
                {copiedAudio ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar Nome
              </Button>
              <a
                href={instagramAudioSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-xs hover:bg-primary/90 transition-all"
              >
                <Instagram className="w-3.5 h-3.5" />
                Abrir Áudio
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Opção 1: Download do MP3 para quem quiser embutir em vídeo no Canva/CapCut */}
          {selectedTrack?.preview_url && (
            <div className="flex items-center justify-between text-[11px] bg-accent/40 px-3 py-2 rounded-xl text-muted-foreground">
              <span>Quer postar 100% automático? Baixe o áudio e coloque no slide 1 em vídeo (.mp4):</span>
              <a
                href={selectedTrack.preview_url}
                target="_blank"
                download={`${displayAudioName}.mp3`}
                className="text-primary font-bold hover:underline inline-flex items-center gap-1 ml-2 shrink-0"
              >
                <Download className="w-3 h-3" />
                Baixar MP3
              </a>
            </div>
          )}
        </div>

        {/* Bloco 2: Mídias do Carrossel */}
        <div className="p-4 rounded-2xl bg-accent/20 border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">
                2. Mídias do Carrossel ({mediaUrls.length} arquivos)
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownloadAllMedia}
              loading={downloading}
              className="h-8 text-xs rounded-xl px-2.5 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Todas
            </Button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 overflow-x-auto py-1">
            {mediaUrls.map((url, i) => {
              const isVideo = Boolean(url.match(/\.(mp4|mov|webm)/i));
              return (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden bg-black/30 border border-border group"
                >
                  {isVideo ? (
                    <video src={url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                  )}
                  <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                    {i + 1}
                  </span>
                  <a
                    href={url}
                    download={`slide-${i + 1}`}
                    target="_blank"
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    title={`Baixar slide ${i + 1}`}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bloco 3: Legenda e Marcações */}
        <div className="p-4 rounded-2xl bg-accent/20 border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">3. Legenda & Marcações</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyCaption}
              className="h-8 text-xs rounded-xl px-2.5 gap-1.5"
            >
              {copiedCaption ? (
                <>
                  <Check className="w-3.5 h-3.5 text-primary" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Legenda
                </>
              )}
            </Button>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border text-xs text-foreground/90 max-h-24 overflow-y-auto font-sans leading-relaxed whitespace-pre-wrap">
            {caption || <span className="italic text-muted-foreground">Sem legenda</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {locationName && (
              <span className="flex items-center gap-1 bg-accent/40 px-2 py-0.5 rounded-md text-foreground">
                <MapPin className="w-3 h-3 text-primary" /> {locationName}
              </span>
            )}
            {collaborators.length > 0 && (
              <span className="flex items-center gap-1 bg-accent/40 px-2 py-0.5 rounded-md text-foreground">
                <User className="w-3 h-3 text-primary" />{' '}
                {collaborators.map((c) => `@${c.replace(/^@/, '')}`).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Bloco 4: Envio Rápido para Celular / Equipe pelo WhatsApp */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">
                Enviar Kit Completo para o WhatsApp
              </span>
              <span className="text-[11px] text-muted-foreground">
                Manda a legenda, links de fotos e link da música direto pro seu celular ou social media.
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleShareWhatsApp}
            className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Rodapé */}
      <div className="p-3.5 px-5 border-t border-border bg-accent/10 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>No app do Instagram: selecione as fotos, toque no ícone 🎵 e cole o nome da música.</span>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} className="text-xs">
          Fechar
        </Button>
      </div>
    </DialogShell>
  );
}
