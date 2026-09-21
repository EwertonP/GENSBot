'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  MessageSquarePlus,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Clock,
  Send,
  Sparkles,
  Share2,
  Heart,
  Bookmark,
  MessageCircle,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/ui/sheet';
import { formatarTimecode, type ConteudoItem, type ComentarioRevisao } from '@/lib/conteudo';

export default function PaginaAprovacaoPublica() {
  const params = useParams();
  const token = params?.token as string;

  const [item, setItem] = useState<ConteudoItem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de navegação de mídia
  const [slideAtual, setSlideAtual] = useState(0);
  const [videoTempo, setVideoTempo] = useState(0);
  const [videoPausado, setVideoPausado] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Modal de Ajuste
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [textoAjuste, setTextoAjuste] = useState('');
  const [autorNome, setAutorNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucessoAprovado, setSucessoAprovado] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/aprovacao/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar conteúdo');
        setItem(data.item);
        if (data.item.status === 'agendamento' || data.item.status === 'publicado') {
          setSucessoAprovado(true);
        }
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token]);

  // Atualiza timecode do vídeo
  function handleTimeUpdate() {
    if (videoRef.current) {
      setVideoTempo(Math.floor(videoRef.current.currentTime));
    }
  }

  function togglePlayVideo() {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setVideoPausado(false);
      } else {
        videoRef.current.pause();
        setVideoPausado(true);
      }
    }
  }

  // Ação de Aprovação Direta
  async function handleAprovar() {
    if (!token) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/aprovacao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'aprovar', autor: autorNome || 'Cliente' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar');
      setItem(data.item);
      setSucessoAprovado(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar.');
    } finally {
      setEnviando(false);
    }
  }

  // Ação de Solicitar Ajuste
  async function handleEnviarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!textoAjuste.trim() || !token) return;

    setEnviando(true);
    try {
      const isVideo = item?.tipo === 'reel' || item?.arquivos[slideAtual]?.tipo === 'video';
      const payload: any = {
        acao: 'ajuste',
        texto: textoAjuste.trim(),
        autor: autorNome.trim() || 'Cliente',
      };

      if (isVideo) {
        payload.timestamp_seconds = videoTempo;
      } else if (item?.arquivos && item.arquivos.length > 1) {
        payload.slide_index = slideAtual + 1;
      }

      const res = await fetch(`/api/aprovacao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar ajuste');

      setItem(data.item);
      setTextoAjuste('');
      setModalAjusteAberto(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar feedback.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-foreground border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">Carregando prévia da publicação...</p>
      </div>
    );
  }

  if (erro || !item) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold font-display text-center">Link Indisponível ou Expirado</h1>
        <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">{erro || 'Esta publicação não foi encontrada.'}</p>
      </div>
    );
  }

  const arquivos = item.arquivos || [];
  const arquivoAtual = arquivos[slideAtual] || null;
  const isVideo = item.tipo === 'reel' || arquivoAtual?.tipo === 'video';
  const comentarios = (item.comentarios_revisao || []) as ComentarioRevisao[];

  return (
    <div className="min-h-screen bg-[#f4f5ee] flex flex-col items-center justify-start p-4 sm:p-6 font-sans text-foreground">
      
      {/* Top Header da Marca GENS */}
      <header className="w-full max-w-md flex items-center justify-between py-3 mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-display tracking-tight text-foreground">Agência GENS</span>
          <span className="text-xs text-muted-foreground font-mono">✳</span>
        </div>
        <Badge variant={sucessoAprovado ? 'success' : item.status === 'travado' ? 'destructive' : 'warning'} className="text-[10px] font-bold">
          {sucessoAprovado ? 'Aprovado' : item.status === 'travado' ? 'Ajustes Solicitados' : 'Aguardando sua Aprovação'}
        </Badge>
      </header>

      {/* Card Principal — Simulação Nativa do Instagram Feed / Reels */}
      <main className="w-full max-w-md bg-card rounded-3xl border border-border/80 shadow-md overflow-hidden flex flex-col">

        {/* 1. Header do Post com Perfil do Cliente */}
        <div className="p-3.5 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-3">
            <ClienteAvatar
              nome={item.cliente?.nome || 'Cliente'}
              cor={item.cliente?.cor}
              fotoUrl={item.cliente?.foto_url}
              tamanho="sm"
              className="ring-2 ring-background shadow-2xs"
            />
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-foreground truncate">
                {item.cliente?.nome || 'Minha Empresa'}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {item.tipo === 'reel' ? 'Vídeo Reels' : arquivos.length > 1 ? `Carrossel (${arquivos.length} slides)` : 'Publicação no Feed'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-accent text-muted-foreground border border-border/60">
            Preview Oficial
          </span>
        </div>

        {/* 2. Área Visual (Mídia: Imagens ou Vídeo) */}
        <div className="relative w-full aspect-square bg-[#0f140d] flex items-center justify-center overflow-hidden select-none">
          {arquivos.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground text-xs">
              <p>Mídia em processamento pela equipe.</p>
            </div>
          ) : isVideo ? (
            <div className="relative w-full h-full flex items-center justify-center group" onClick={togglePlayVideo}>
              <video
                ref={videoRef}
                src={arquivoAtual?.url}
                onTimeUpdate={handleTimeUpdate}
                playsInline
                className="w-full h-full object-contain cursor-pointer"
              />
              <button
                type="button"
                onClick={togglePlayVideo}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-foreground/70 text-background backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90"
              >
                {videoPausado ? <Play className="w-6 h-6 ml-1 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
              </button>

              {/* Timecode Badge Flutuante */}
              <div className="absolute bottom-3 left-3 bg-foreground/80 text-background backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-lime" />
                <span>{formatarTimecode(videoTempo)}</span>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={arquivoAtual?.url}
                alt={`Slide ${slideAtual + 1}`}
                className="w-full h-full object-contain"
              />

              {/* Controles de Slides para Carrossel */}
              {arquivos.length > 1 && (
                <>
                  {slideAtual > 0 && (
                    <button
                      type="button"
                      onClick={() => setSlideAtual((s) => s - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground/70 text-background backdrop-blur-md flex items-center justify-center shadow-md active:scale-90"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {slideAtual < arquivos.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setSlideAtual((s) => s + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground/70 text-background backdrop-blur-md flex items-center justify-center shadow-md active:scale-90"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}

                  {/* Indicador de Bolinhas e Slide Index */}
                  <div className="absolute top-3 right-3 bg-foreground/80 text-background backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono font-bold shadow-xs">
                    {slideAtual + 1} / {arquivos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 3. Ações do Instagram (Simulação Visual) */}
        <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/40 text-muted-foreground">
          <div className="flex items-center gap-4">
            <Heart className="w-5 h-5 hover:text-destructive cursor-pointer transition-colors" />
            <MessageCircle className="w-5 h-5 hover:text-foreground cursor-pointer transition-colors" />
            <Share2 className="w-5 h-5 hover:text-foreground cursor-pointer transition-colors" />
          </div>
          {arquivos.length > 1 && (
            <div className="flex items-center gap-1">
              {arquivos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    slideAtual === i ? 'w-4 bg-primary' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>
          )}
          <Bookmark className="w-5 h-5 hover:text-foreground cursor-pointer transition-colors" />
        </div>

        {/* 4. Legenda e Texto do Post */}
        <div className="p-4 flex flex-col gap-2">
          {item.titulo && (
            <h3 className="text-sm font-bold font-display text-foreground">{item.titulo}</h3>
          )}
          <div className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed bg-accent/30 p-3 rounded-2xl border border-border/50">
            <span className="font-bold mr-1.5">{item.cliente?.nome || 'cliente'}:</span>
            {item.legenda || 'Sem legenda definida.'}
          </div>
        </div>

        {/* 5. Histórico de Comentários e Feedbacks já feitos */}
        {comentarios.length > 0 && (
          <div className="px-4 pb-4 flex flex-col gap-2 border-t border-border/50 pt-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Histórico de Ajustes</p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {comentarios.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-accent/40 border border-border/60 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{c.autor}</span>
                    {c.slide_index && (
                      <span className="text-[10px] font-mono font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        Slide {c.slide_index}
                      </span>
                    )}
                    {c.timestamp_seconds != null && (
                      <span className="text-[10px] font-mono font-bold bg-lime text-foreground px-1.5 py-0.5 rounded flex items-center gap-1 border border-foreground/10">
                        ⏱ {formatarTimecode(c.timestamp_seconds)}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px]">{c.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Barra de Ação de Aprovação (Bottom Sticky) */}
        <div className="p-4 bg-card border-t border-border flex flex-col gap-2.5">
          {sucessoAprovado ? (
            <div className="p-3.5 rounded-2xl bg-success/15 border border-success/30 text-success flex items-center justify-center gap-2 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Publicação aprovada com sucesso!</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAjusteAberto(true)}
                disabled={enviando}
                className="rounded-xl text-xs font-bold"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 mr-1" />
                Pedir Ajuste {isVideo ? `aos ${formatarTimecode(videoTempo)}` : arquivos.length > 1 ? `no Slide ${slideAtual + 1}` : ''}
              </Button>
              <Button
                type="button"
                variant="lime"
                onClick={handleAprovar}
                loading={enviando}
                className="rounded-xl text-xs font-bold shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Aprovar Post
              </Button>
            </div>
          )}
        </div>

      </main>

      {/* Footer discreto */}
      <footer className="mt-4 text-center text-[11px] text-muted-foreground">
        Aprovação segura powered by <strong className="font-semibold text-foreground">Agência GENS</strong>
      </footer>

      {/* Modal / Sheet para Inserir Ajuste Específico */}
      <Sheet open={modalAjusteAberto} onClose={() => setModalAjusteAberto(false)} aria-label="Solicitar Ajuste">
        <form onSubmit={handleEnviarAjuste} className="p-6 flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ajuste de Conteúdo</span>
            <h3 className="text-lg font-bold font-display text-foreground mt-0.5">
              Solicitar alteração {isVideo ? `no minuto ${formatarTimecode(videoTempo)}` : arquivos.length > 1 ? `no Slide ${slideAtual + 1}` : ''}
            </h3>
          </div>

          <div className="p-2.5 rounded-xl bg-accent/60 border border-border/70 text-xs flex items-center gap-2">
            {isVideo ? (
              <>
                <Clock className="w-4 h-4 text-primary" />
                <span>O comentário ficará fixado exatamente aos <strong>{formatarTimecode(videoTempo)}</strong> do vídeo.</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-primary" />
                <span>O ajuste será registrado especificamente para o <strong>Slide {slideAtual + 1} de {arquivos.length}</strong>.</span>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Seu Nome</label>
            <input
              type="text"
              placeholder="Ex.: Dr. Paulo / Mariana"
              value={autorNome}
              onChange={(e) => setAutorNome(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-foreground/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">O que deseja ajustar?</label>
            <Textarea
              placeholder="Descreva a alteração desejada (ex: trocar a foto, ajustar o texto, mudar a transição...)"
              value={textoAjuste}
              onChange={(e) => setTextoAjuste(e.target.value)}
              rows={4}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setModalAjusteAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={enviando}>
              <Send className="w-3.5 h-3.5 mr-1" />
              Enviar Ajuste
            </Button>
          </div>
        </form>
      </Sheet>

    </div>
  );
}
