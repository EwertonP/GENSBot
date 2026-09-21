'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  MessageSquarePlus,
  Send,
  Clock,
  Sparkles,
  Smartphone,
  Heart,
  MessageCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/ui/sheet';
import { formatarTimecode, type ConteudoItem, type ComentarioRevisao } from '@/lib/conteudo';
import { InstagramCarrosselPreview } from '@/components/aprovacao/instagram-carrossel-preview';
import { InstagramStoryPreview } from '@/components/aprovacao/instagram-story-preview';
import { InstagramReelsPreview } from '@/components/aprovacao/instagram-reels-preview';
import { ClienteAvatar } from '@/components/cliente-avatar';

interface PaginaAprovacaoClientProps {
  itemInicial: ConteudoItem | null;
  token: string;
}

export default function PaginaAprovacaoClient({ itemInicial, token }: PaginaAprovacaoClientProps) {
  const [item, setItem] = useState<ConteudoItem | null>(itemInicial);
  const [carregando, setCarregando] = useState(!itemInicial);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de navegação
  const [slideAtual, setSlideAtual] = useState(0);
  const [videoTempo, setVideoTempo] = useState(0);
  const [curtido, setCurtido] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Modal de Ajuste
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [textoAjuste, setTextoAjuste] = useState('');
  const [autorNome, setAutorNome] = useState('');
  const [ajusteSlideIndex, setAjusteSlideIndex] = useState<number | null>(null);
  const [ajusteTimestamp, setAjusteTimestamp] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucessoAprovado, setSucessoAprovado] = useState(
    itemInicial?.status === 'agendamento' || itemInicial?.status === 'pronto_publicar' || itemInicial?.status === 'publicado'
  );

  useEffect(() => {
    if (itemInicial) return;
    if (!token) return;
    fetch(`/api/aprovacao/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar conteúdo');
        setItem(data.item);
        if (
          data.item.status === 'agendamento' ||
          data.item.status === 'pronto_publicar' ||
          data.item.status === 'publicado'
        ) {
          setSucessoAprovado(true);
        }
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token, itemInicial]);

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

  // Abrir modal com pré-preenchimento
  function handleAbrirAjusteSlide(slideIndex: number) {
    setAjusteSlideIndex(slideIndex);
    setAjusteTimestamp(null);
    setModalAjusteAberto(true);
  }

  function handleAbrirAjusteVideo(segundos: number) {
    setAjusteTimestamp(segundos);
    setAjusteSlideIndex(null);
    setModalAjusteAberto(true);
  }

  // Ação de Solicitar Ajuste
  async function handleEnviarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!textoAjuste.trim() || !token) return;

    setEnviando(true);
    try {
      const payload: any = {
        acao: 'ajuste',
        texto: textoAjuste.trim(),
        autor: autorNome.trim() || 'Cliente',
      };

      if (ajusteTimestamp != null) {
        payload.timestamp_seconds = ajusteTimestamp;
      } else if (ajusteSlideIndex != null) {
        payload.slide_index = ajusteSlideIndex;
      } else if (item?.tipo === 'reel') {
        payload.timestamp_seconds = videoTempo;
      } else if (arquivos.length > 1) {
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
      <div className="min-h-screen bg-[#f4f5ee] flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-foreground border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">Carregando publicação oficial do Instagram...</p>
      </div>
    );
  }

  if (erro || !item) {
    return (
      <div className="min-h-screen bg-[#f4f5ee] flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold font-display text-center">Publicação Não Encontrada</h1>
        <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">
          {erro || 'Este link de aprovação é inválido ou expirou.'}
        </p>
      </div>
    );
  }

  const arquivos = item.arquivos || [];
  const comentarios = (item.comentarios_revisao || []) as ComentarioRevisao[];
  const clienteNome = item.cliente?.nome || 'Minha Empresa';
  const clienteCor = item.cliente?.cor;
  const clienteFotoUrl = item.cliente?.foto_url;

  // Detecção Inteligente do Formato do Instagram
  const isStory = item.tipo === 'story';
  const isReel = item.tipo === 'reel' || (arquivos.length === 1 && arquivos[0]?.tipo === 'video');
  const isCarrossel = (item.tipo as string) === 'carrossel' || (arquivos.length > 1 && !isStory);

  return (
    <div className="min-h-screen bg-[#f4f5ee] flex flex-col items-center justify-start py-4 px-3 sm:px-6 md:py-8 font-sans text-foreground">
      
      {/* Top Header da Agência GENS */}
      <header className="w-full max-w-md lg:max-w-5xl xl:max-w-6xl flex items-center justify-between py-2.5 mb-3 lg:mb-6 px-1">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-sm sm:text-base font-bold font-display tracking-tight text-foreground">Agência GENS</span>
          <span className="text-xs text-muted-foreground font-mono">✳</span>
          <span className="text-xs font-semibold text-muted-foreground">Central de Aprovação</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-medium text-muted-foreground mr-1">
            {isStory ? 'Story' : isReel ? 'Reels' : isCarrossel ? `Carrossel (${arquivos.length} fotos)` : 'Feed'}
          </span>
          <Badge
            variant={sucessoAprovado ? 'success' : item.status === 'travado' ? 'destructive' : 'warning'}
            className="text-[10px] sm:text-xs font-bold px-2.5 py-1"
          >
            {sucessoAprovado ? 'Aprovado' : item.status === 'travado' ? 'Ajustes Solicitados' : 'Aguardando Aprovação'}
          </Badge>
        </div>
      </header>

      {/* --- VISÃO MOBILE (< lg) --- */}
      <main className="w-full max-w-md flex flex-col items-center gap-4 lg:hidden">
        {isStory ? (
          <InstagramStoryPreview
            clienteNome={clienteNome}
            clienteCor={clienteCor}
            clienteFotoUrl={clienteFotoUrl}
            arquivos={arquivos}
            slideAtual={slideAtual}
            onMudarSlide={setSlideAtual}
            onPedirAjuste={handleAbrirAjusteSlide}
          />
        ) : isReel ? (
          <InstagramReelsPreview
            clienteNome={clienteNome}
            clienteCor={clienteCor}
            clienteFotoUrl={clienteFotoUrl}
            arquivoVideo={arquivos[0] || null}
            titulo={item.titulo}
            legenda={item.legenda}
            tempoAtual={videoTempo}
            onAtualizarTempo={setVideoTempo}
            onPedirAjuste={handleAbrirAjusteVideo}
          />
        ) : (
          /* Carrossel 4:5 ou Post de Feed 4:5 */
          <InstagramCarrosselPreview
            clienteNome={clienteNome}
            clienteCor={clienteCor}
            clienteFotoUrl={clienteFotoUrl}
            arquivos={arquivos}
            titulo={item.titulo}
            legenda={item.legenda}
            slideAtual={slideAtual}
            onMudarSlide={setSlideAtual}
            onPedirAjuste={handleAbrirAjusteSlide}
          />
        )}

        {/* Histórico de Comentários / Ajustes já pontuados */}
        {comentarios.length > 0 && (
          <div className="w-full max-w-[420px] bg-card rounded-2xl border border-border/70 p-3.5 flex flex-col gap-2 shadow-sm">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Ajustes Registrados ({comentarios.length})
            </p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {comentarios.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-accent/40 border border-border/60 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{c.autor}</span>
                    {c.slide_index != null && (
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
                  <p className="text-muted-foreground text-[11px] leading-relaxed">{c.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Ação de Decisão do Cliente (Aprovar / Solicitar Ajustes) */}
        <div className="w-full max-w-[420px] bg-card rounded-2xl border border-border/80 p-3.5 shadow-md flex flex-col gap-2.5">
          {sucessoAprovado ? (
            <div className="p-3.5 rounded-xl bg-success/15 border border-success/30 text-success flex items-center justify-center gap-2 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Publicação aprovada para publicação no Instagram! 🎉</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isReel) {
                    handleAbrirAjusteVideo(videoTempo);
                  } else {
                    handleAbrirAjusteSlide(slideAtual + 1);
                  }
                }}
                disabled={enviando}
                className="rounded-xl text-xs font-bold h-10"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 mr-1" />
                {isReel
                  ? `Ajustar aos ${formatarTimecode(videoTempo)}`
                  : arquivos.length > 1
                  ? `Ajustar Slide ${slideAtual + 1}`
                  : 'Sugerir Ajuste'}
              </Button>

              <Button
                type="button"
                variant="lime"
                onClick={handleAprovar}
                loading={enviando}
                className="rounded-xl text-xs font-bold shadow-xs h-10"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Aprovar Post
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* --- VISÃO DESKTOP (>= lg) estilo Instagram Web Native Modal (Tema Claro) --- */}
      <main className="hidden lg:flex w-full max-w-5xl h-[660px] rounded-2xl bg-white border border-border/80 shadow-2xl overflow-hidden my-auto">
        {/* Coluna da Esquerda (60%): Estágio Visual de Mídia (Carrossel / Reels / Story) */}
        <div className="w-7/12 bg-neutral-950 flex items-center justify-center relative overflow-hidden border-r border-border/60 p-4">
          {isStory ? (
            <InstagramStoryPreview
              clienteNome={clienteNome}
              clienteCor={clienteCor}
              clienteFotoUrl={clienteFotoUrl}
              arquivos={arquivos}
              slideAtual={slideAtual}
              onMudarSlide={setSlideAtual}
              onPedirAjuste={handleAbrirAjusteSlide}
            />
          ) : isReel ? (
            <InstagramReelsPreview
              clienteNome={clienteNome}
              clienteCor={clienteCor}
              clienteFotoUrl={clienteFotoUrl}
              arquivoVideo={arquivos[0] || null}
              titulo={item.titulo}
              legenda={item.legenda}
              tempoAtual={videoTempo}
              onAtualizarTempo={setVideoTempo}
              onPedirAjuste={handleAbrirAjusteVideo}
            />
          ) : (
            <InstagramCarrosselPreview
              clienteNome={clienteNome}
              clienteCor={clienteCor}
              clienteFotoUrl={clienteFotoUrl}
              arquivos={arquivos}
              titulo={item.titulo}
              legenda={item.legenda}
              slideAtual={slideAtual}
              onMudarSlide={setSlideAtual}
              onPedirAjuste={handleAbrirAjusteSlide}
            />
          )}
        </div>

        {/* Coluna da Direita (40%): Painel Nativo do Instagram Web (Tema Claro) */}
        <div className="w-5/12 bg-white flex flex-col justify-between overflow-hidden text-foreground">
          
          {/* Header Superior Nativo */}
          <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600">
                <ClienteAvatar
                  nome={clienteNome}
                  cor={clienteCor}
                  fotoUrl={clienteFotoUrl}
                  tamanho="md"
                  className="ring-2 ring-white"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground tracking-tight leading-tight">{clienteNome}</span>
                  <span className="w-4 h-4 bg-sky-500 text-white rounded-full inline-flex items-center justify-center text-[9px] font-bold" title="Perfil Verificado">✓</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">Agência GENS • Central de Aprovação</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={sucessoAprovado ? 'success' : item.status === 'travado' ? 'destructive' : 'warning'}
                className="text-[10px] font-bold px-2 py-0.5"
              >
                {sucessoAprovado ? 'Aprovado' : item.status === 'travado' ? 'Ajustes Solicitados' : 'Pendente'}
              </Badge>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área Scrollável Central: Legenda e Comentários / Ajustes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-thin scrollbar-thumb-neutral-300">
            
            {/* Item Principal: Legenda com Avatar e Username em Negrito */}
            <div className="flex items-start gap-3">
              <ClienteAvatar
                nome={clienteNome}
                cor={clienteCor}
                fotoUrl={clienteFotoUrl}
                tamanho="sm"
                className="shrink-0 mt-0.5"
              />
              <div className="flex flex-col text-xs leading-relaxed space-y-1.5 flex-1">
                <div>
                  <span className="font-bold text-foreground mr-2">@{clienteNome.toLowerCase().replace(/\s+/g, '')}</span>
                  {item.titulo && <span className="font-semibold text-foreground block mb-1">{item.titulo}</span>}
                  <span className="text-foreground/90 whitespace-pre-line font-normal">
                    {item.legenda || 'Nenhuma legenda informada para este post.'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase pt-1">
                  2 h • {isStory ? 'Story' : isReel ? 'Reels' : isCarrossel ? `Carrossel (${arquivos.length} fotos)` : 'Feed'}
                </span>
              </div>
            </div>

            {/* Separador sutil */}
            {comentarios.length > 0 && <div className="border-t border-border/60 my-2" />}

            {/* Seção de Comentários / Histórico de Ajustes */}
            {comentarios.length > 0 && (
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Ajustes & Comentários ({comentarios.length})
                </span>
                {comentarios.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground border border-border flex items-center justify-center font-bold text-[10px] shrink-0">
                      {c.autor ? c.autor.substring(0, 2).toUpperCase() : 'CL'}
                    </div>
                    <div className="flex flex-col text-xs flex-1">
                      <div className="bg-accent/40 rounded-xl p-2.5 border border-border/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px]">{c.autor}</span>
                          {c.slide_index != null && (
                            <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                              Slide {c.slide_index}
                            </span>
                          )}
                          {c.timestamp_seconds != null && (
                            <span className="text-[9px] font-mono font-bold bg-lime/20 text-foreground px-1.5 py-0.5 rounded border border-foreground/10">
                              ⏱ {formatarTimecode(c.timestamp_seconds)}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-snug">{c.texto}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1 mt-1">
                        <span>1 h</span>
                        <button type="button" className="hover:text-foreground font-semibold transition-colors">Responder</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer do Painel Nativo do Instagram Web (Tema Claro) */}
          <div className="border-t border-border/60 bg-white shrink-0">
            {/* Barra de Ações Ícones (Curtir, Comentar, Compartilhar, Salvar) */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between text-foreground">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setCurtido(!curtido)}
                  className="hover:text-muted-foreground transition-transform active:scale-125"
                  title="Curtir"
                >
                  <Heart className={`w-6 h-6 ${curtido ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isReel) handleAbrirAjusteVideo(videoTempo);
                    else handleAbrirAjusteSlide(slideAtual + 1);
                  }}
                  className="hover:text-muted-foreground transition-transform active:scale-110"
                  title="Comentar / Sugerir Ajuste"
                >
                  <MessageCircle className="w-6 h-6" />
                </button>
                <button type="button" className="hover:text-muted-foreground transition-transform active:scale-110" title="Compartilhar">
                  <Send className="w-6 h-6" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSalvo(!salvo)}
                className="hover:text-muted-foreground transition-transform active:scale-110"
                title="Salvar"
              >
                <Bookmark className={`w-6 h-6 ${salvo ? 'fill-foreground text-foreground' : ''}`} />
              </button>
            </div>

            {/* Contador de Curtidas e Horário */}
            <div className="px-4 pb-3">
              <p className="text-xs font-semibold text-foreground">
                Curtido por <span className="font-bold">agenciagens</span> e <span className="font-bold">outras pessoas</span>
              </p>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mt-0.5">HÁ 2 HORAS</span>
            </div>

            {/* Decision Bar para Aprovação ou Solicitação de Ajustes */}
            <div className="p-3 border-t border-border/60 bg-accent/20">
              {sucessoAprovado ? (
                <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success flex items-center justify-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publicação Aprovada! 🎉</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (isReel) {
                        handleAbrirAjusteVideo(videoTempo);
                      } else {
                        handleAbrirAjusteSlide(slideAtual + 1);
                      }
                    }}
                    disabled={enviando}
                    className="rounded-xl text-xs font-bold h-10 border-border bg-white text-foreground hover:bg-accent"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 mr-1 text-primary" />
                    {isReel
                      ? `Ajustar (${formatarTimecode(videoTempo)})`
                      : arquivos.length > 1
                      ? `Ajustar Slide ${slideAtual + 1}`
                      : 'Sugerir Ajuste'}
                  </Button>

                  <Button
                    type="button"
                    variant="lime"
                    onClick={handleAprovar}
                    loading={enviando}
                    className="rounded-xl text-xs font-bold shadow-xs h-10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Aprovar Post
                  </Button>
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Footer discreto */}
      <footer className="mt-8 mb-2 text-center text-[11px] text-muted-foreground">
        Visualizador nativo de Instagram powered by <strong className="font-semibold text-foreground">Agência GENS</strong>
      </footer>

      {/* Modal / Sheet para Inserir Ajuste Específico */}
      <Sheet open={modalAjusteAberto} onClose={() => setModalAjusteAberto(false)} aria-label="Solicitar Ajuste">
        <form onSubmit={handleEnviarAjuste} className="p-6 flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ajuste de Conteúdo</span>
            <h3 className="text-lg font-bold font-display text-foreground mt-0.5">
              {ajusteTimestamp != null
                ? `Solicitar alteração aos ${formatarTimecode(ajusteTimestamp)}`
                : ajusteSlideIndex != null
                ? `Solicitar alteração no Slide #${ajusteSlideIndex}`
                : 'Solicitar alteração na publicação'}
            </h3>
          </div>

          <div className="p-2.5 rounded-xl bg-accent/60 border border-border/70 text-xs flex items-center gap-2">
            {ajusteTimestamp != null ? (
              <>
                <Clock className="w-4 h-4 text-primary" />
                <span>O comentário ficará fixado exatamente aos <strong>{formatarTimecode(ajusteTimestamp)}</strong> do vídeo.</span>
              </>
            ) : ajusteSlideIndex != null ? (
              <>
                <Sparkles className="w-4 h-4 text-primary" />
                <span>O ajuste será registrado especificamente para o <strong>Slide {ajusteSlideIndex} de {arquivos.length}</strong>.</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-primary" />
                <span>O ajuste será registrado para a equipe da agência.</span>
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
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-foreground/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">O que deseja ajustar?</label>
            <Textarea
              placeholder="Descreva a alteração desejada (ex: trocar a foto do slide, alterar o texto da legenda, mudar a transição...)"
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
