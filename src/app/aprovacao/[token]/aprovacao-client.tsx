'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  Sun,
  Moon,
  Undo2,
  UserRound,
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
import { toast } from '@/components/ui/toast';

const NOME_STORAGE_KEY = 'gensbot_aprovacao_nome';
const SEGUNDOS_DESFAZER = 8;

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
  // Nome de quem aprova: pedido uma vez e lembrado neste navegador — antes
  // toda aprovação ficava registrada como "Cliente".
  const [autorNome, setAutorNome] = useState(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(NOME_STORAGE_KEY) || '' : '';
    } catch {
      return '';
    }
  });
  const [nomeSheetAberto, setNomeSheetAberto] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState('');
  const acaoAposNomeRef = useRef<null | (() => void)>(null);
  // Aprovação com "Desfazer": só é enviada quando a contagem acaba.
  const [aprovacaoPendente, setAprovacaoPendente] = useState<number | null>(null); // segundos restantes
  const aprovacaoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ajusteEscopo, setAjusteEscopo] = useState<'ponto' | 'geral'>('ponto');
  const [ajusteSlideIndex, setAjusteSlideIndex] = useState<number | null>(null);
  const [ajusteTimestamp, setAjusteTimestamp] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucessoAprovado, setSucessoAprovado] = useState(
    itemInicial?.status === 'agendamento' || itemInicial?.status === 'pronto_publicar' || itemInicial?.status === 'publicado'
  );

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // O script inline do layout já aplicou o tema (preferência salva ou do SO);
    // aqui só sincronizamos o estado do toggle com a classe real do <html>.
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gensbot_theme', nextTheme);
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

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

  // Garante o nome antes de uma ação; se faltar, pergunta e continua depois.
  function comNome(acao: () => void) {
    if (autorNome.trim()) return acao();
    acaoAposNomeRef.current = acao;
    setNomeRascunho('');
    setNomeSheetAberto(true);
  }

  function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    const nome = nomeRascunho.trim();
    if (!nome) return;
    setAutorNome(nome);
    try {
      localStorage.setItem(NOME_STORAGE_KEY, nome);
    } catch {}
    setNomeSheetAberto(false);
    const acao = acaoAposNomeRef.current;
    acaoAposNomeRef.current = null;
    // deixa o estado do nome assentar antes de seguir
    if (acao) setTimeout(acao, 0);
  }

  function corpoAprovacao(nome: string) {
    return JSON.stringify({ acao: 'aprovar', autor: nome || 'Cliente' });
  }

  // Envio real da aprovação (fim da contagem, ou saída da página).
  async function enviarAprovacao() {
    if (!token) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/aprovacao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpoAprovacao(autorNome),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar');
      setItem(data.item);
      setSucessoAprovado(true);
    } catch (err: any) {
      toast.error('Não foi possível aprovar', { description: err.message || 'Tente novamente em instantes.' });
    } finally {
      setEnviando(false);
    }
  }

  function pararContagem() {
    if (aprovacaoTimerRef.current) clearInterval(aprovacaoTimerRef.current);
    aprovacaoTimerRef.current = null;
  }

  // Clique em "Aprovar": mostra "Aprovado · Desfazer" e só envia ao fim da contagem.
  function handleAprovar() {
    comNome(() => {
      pararContagem();
      setAprovacaoPendente(SEGUNDOS_DESFAZER);
      aprovacaoTimerRef.current = setInterval(() => {
        setAprovacaoPendente((s) => {
          if (s === null) return null;
          if (s <= 1) {
            pararContagem();
            void enviarAprovacao();
            return null;
          }
          return s - 1;
        });
      }, 1000);
    });
  }

  function desfazerAprovacao() {
    pararContagem();
    setAprovacaoPendente(null);
  }

  // Se a pessoa fechar a aba durante a contagem, a aprovação ainda vale.
  useEffect(() => {
    if (aprovacaoPendente === null) return;
    const onHide = () => {
      if (aprovacaoTimerRef.current === null) return;
      pararContagem();
      navigator.sendBeacon(`/api/aprovacao/${token}`, new Blob([corpoAprovacao(autorNome)], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aprovacaoPendente === null, token, autorNome]);

  useEffect(() => () => pararContagem(), []);

  // Abrir modal com pré-preenchimento
  function handleAbrirAjusteSlide(slideIndex: number) {
    setAjusteSlideIndex(slideIndex);
    setAjusteTimestamp(null);
    setAjusteEscopo(arquivos.length > 1 ? 'ponto' : 'geral');
    setModalAjusteAberto(true);
  }

  function handleAbrirAjusteVideo(segundos: number) {
    setAjusteTimestamp(segundos);
    setAjusteSlideIndex(null);
    setAjusteEscopo('ponto');
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

      // "A publicação toda" não fixa slide nem tempo.
      if (ajusteEscopo === 'ponto') {
        if (ajusteTimestamp != null) {
          payload.timestamp_seconds = ajusteTimestamp;
        } else if (ajusteSlideIndex != null) {
          payload.slide_index = ajusteSlideIndex;
        } else if (item?.tipo === 'reel') {
          payload.timestamp_seconds = videoTempo;
        } else if (arquivos.length > 1) {
          payload.slide_index = slideAtual + 1;
        }
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
      toast.success('Ajuste enviado', { description: 'A equipe da agência já foi avisada.' });
      try {
        if (autorNome.trim()) localStorage.setItem(NOME_STORAGE_KEY, autorNome.trim());
      } catch {}
    } catch (err: any) {
      toast.error('Não foi possível enviar o ajuste', { description: err.message || 'Seu texto continua aqui — tente enviar de novo.' });
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-foreground border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">Carregando publicação oficial do Instagram...</p>
      </div>
    );
  }

  if (erro || !item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-4 px-3 sm:px-6 md:py-8 font-sans text-foreground">
      
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
            className="text-xs font-bold px-2.5 py-1"
          >
            {sucessoAprovado ? 'Aprovado' : item.status === 'travado' ? 'Ajustes Solicitados' : 'Aguardando Aprovação'}
          </Badge>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para o Modo Claro' : 'Mudar para o Dark Mode'}
            aria-label={theme === 'dark' ? 'Mudar para o Modo Claro' : 'Mudar para o Dark Mode'}
            className="p-1.5 rounded-xl bg-card hover:bg-accent border border-border text-foreground transition-ui duration-150 cursor-pointer shadow-2xs flex items-center justify-center ml-1 active:scale-[0.98]"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-primary animate-in spin-in-180 duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-primary animate-in spin-in-180 duration-200" />
            )}
          </button>
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
          <div className="w-full max-w-[420px] bg-card rounded-2xl border border-border p-3.5 flex flex-col gap-2 shadow-sm">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Ajustes Registrados ({comentarios.length})
            </p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {comentarios.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-accent/40 border border-border text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{c.autor}</span>
                    {c.slide_index != null && (
                      <span className="text-xs font-mono font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        Slide {c.slide_index}
                      </span>
                    )}
                    {c.timestamp_seconds != null && (
                      <span className="text-xs font-mono font-bold bg-lime text-lime-foreground px-1.5 py-0.5 rounded flex items-center gap-1 border border-foreground/10">
                        ⏱ {formatarTimecode(c.timestamp_seconds)}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{c.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Ação de Decisão do Cliente (Aprovar / Solicitar Ajustes) */}
        <div className="w-full max-w-[420px] bg-card rounded-2xl border border-border p-3.5 shadow-md flex flex-col gap-2.5">
          <BarraDecisao
            aprovado={sucessoAprovado}
            pendente={aprovacaoPendente}
            enviando={enviando}
            rotuloAjuste={isReel ? `Ajustar aos ${formatarTimecode(videoTempo)}` : arquivos.length > 1 ? `Ajustar slide ${slideAtual + 1}` : 'Sugerir ajuste'}
            onAjuste={() => comNome(() => (isReel ? handleAbrirAjusteVideo(videoTempo) : handleAbrirAjusteSlide(slideAtual + 1)))}
            onAprovar={handleAprovar}
            onDesfazer={desfazerAprovacao}
            autorNome={autorNome}
            onTrocarNome={() => {
              setNomeRascunho(autorNome);
              setNomeSheetAberto(true);
            }}
          />
        </div>
      </main>

      {/* --- VISÃO DESKTOP (>= lg) estilo Instagram Web Native Modal --- */}
      <main className="hidden lg:flex w-full max-w-5xl h-[660px] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden my-auto">
        {/* Coluna da Esquerda (60%): Estágio Visual de Mídia (Carrossel / Reels / Story) */}
        <div className="w-7/12 bg-muted dark:bg-black flex items-center justify-center relative overflow-hidden border-r border-border p-4">
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

        {/* Coluna da Direita (40%): Painel Nativo do Instagram Web */}
        <div className="w-5/12 bg-card flex flex-col justify-between overflow-hidden text-foreground">
          
          {/* Header Superior Nativo */}
          <div className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card">
            <div className="flex items-center gap-3">
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600">
                <ClienteAvatar
                  nome={clienteNome}
                  cor={clienteCor}
                  fotoUrl={clienteFotoUrl}
                  tamanho="md"
                  className="ring-2 ring-card"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground tracking-tight leading-tight">{clienteNome}</span>
                  <span className="w-4 h-4 bg-info text-info-foreground rounded-full inline-flex items-center justify-center text-xs font-bold" title="Perfil Verificado">✓</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">Agência GENS • Central de Aprovação</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={sucessoAprovado ? 'success' : item.status === 'travado' ? 'destructive' : 'warning'}
                className="text-xs font-bold px-2 py-0.5"
              >
                {sucessoAprovado ? 'Aprovado' : item.status === 'travado' ? 'Ajustes Solicitados' : 'Pendente'}
              </Badge>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área Scrollável Central: Legenda e Comentários / Ajustes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-card scrollbar-thin scrollbar-thumb-border">
            
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
                  <span className="font-bold text-foreground mr-2">@{clienteNome.replace(/^@/, '').toLowerCase().replace(/\s+/g, '')}</span>
                  {item.titulo && <span className="font-semibold text-foreground block mb-1">{item.titulo}</span>}
                  <span className="text-foreground/90 whitespace-pre-line font-normal">
                    {item.legenda || 'Nenhuma legenda informada para este post.'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase pt-1">
                  2 h • {isStory ? 'Story' : isReel ? 'Reels' : isCarrossel ? `Carrossel (${arquivos.length} fotos)` : 'Feed'}
                </span>
              </div>
            </div>

            {/* Roteiro / texto de cada slide — separado da legenda, que é só a legenda do Instagram */}
            {item.briefing && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                  📝 Roteiro / Texto dos Slides
                </p>
                <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line">{item.briefing}</p>
              </div>
            )}

            {/* Separador sutil */}
            {comentarios.length > 0 && <div className="border-t border-border my-2" />}

            {/* Seção de Comentários / Histórico de Ajustes */}
            {comentarios.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Ajustes & Comentários ({comentarios.length})
                </span>
                {comentarios.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground border border-border flex items-center justify-center font-bold text-xs shrink-0">
                      {c.autor ? c.autor.substring(0, 2).toUpperCase() : 'CL'}
                    </div>
                    <div className="flex flex-col text-xs flex-1">
                      <div className="bg-accent/40 rounded-xl p-2.5 border border-border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-xs">{c.autor}</span>
                          {c.slide_index != null && (
                            <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                              Slide {c.slide_index}
                            </span>
                          )}
                          {c.timestamp_seconds != null && (
                            <span className="text-xs font-mono font-bold bg-brand-soft text-brand-text px-1.5 py-0.5 rounded border border-brand-ring">
                              ⏱ {formatarTimecode(c.timestamp_seconds)}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs leading-snug">{c.texto}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground px-1 mt-1">
                        <span>1 h</span>
                        <button type="button" className="hover:text-foreground font-semibold transition-colors">Responder</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer do Painel Nativo do Instagram Web */}
          <div className="border-t border-border bg-card shrink-0">
            {/* Barra de Ações Ícones (Curtir, Comentar, Compartilhar, Salvar) */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between text-foreground">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setCurtido(!curtido)}
                  className="hover:text-muted-foreground transition-transform active:scale-125"
                  title="Curtir"
                >
                  <Heart className={`w-6 h-6 ${curtido ? 'fill-destructive text-destructive' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => comNome(() => (isReel ? handleAbrirAjusteVideo(videoTempo) : handleAbrirAjusteSlide(slideAtual + 1)))}
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
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mt-0.5">HÁ 2 HORAS</span>
            </div>

            {/* Decision Bar para Aprovação ou Solicitação de Ajustes */}
            <div className="p-3 border-t border-border bg-accent/30">
              <BarraDecisao
                aprovado={sucessoAprovado}
                pendente={aprovacaoPendente}
                enviando={enviando}
                rotuloAjuste={isReel ? `Ajustar aos ${formatarTimecode(videoTempo)}` : arquivos.length > 1 ? `Ajustar slide ${slideAtual + 1}` : 'Sugerir ajuste'}
                onAjuste={() => comNome(() => (isReel ? handleAbrirAjusteVideo(videoTempo) : handleAbrirAjusteSlide(slideAtual + 1)))}
                onAprovar={handleAprovar}
                onDesfazer={desfazerAprovacao}
                autorNome={autorNome}
                onTrocarNome={() => {
                  setNomeRascunho(autorNome);
                  setNomeSheetAberto(true);
                }}
                compacto
          />
            </div>

          </div>

        </div>
      </main>

      {/* Footer discreto */}
      <footer className="mt-8 mb-2 text-center text-xs text-muted-foreground">
        Visualizador nativo de Instagram powered by <strong className="font-semibold text-foreground">Agência GENS</strong>
      </footer>

      {/* Nome de quem está aprovando (pedido uma vez) */}
      <Sheet open={nomeSheetAberto} onClose={() => setNomeSheetAberto(false)} aria-label="Seu nome" className="w-full max-w-sm">
        <form onSubmit={salvarNome} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold font-display text-foreground">Como podemos te chamar?</h3>
            <p className="text-sm text-muted-foreground">Seu nome fica junto da aprovação ou do ajuste, pra equipe saber quem pediu.</p>
          </div>
          <input
            autoFocus
            required
            value={nomeRascunho}
            onChange={(e) => setNomeRascunho(e.target.value)}
            placeholder="Ex.: Mariana"
            maxLength={60}
            className="w-full bg-card border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setNomeSheetAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!nomeRascunho.trim()}>
              Continuar
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Modal / Sheet para Inserir Ajuste Específico */}
      <Sheet open={modalAjusteAberto} onClose={() => setModalAjusteAberto(false)} aria-label="Solicitar Ajuste">
        <form onSubmit={handleEnviarAjuste} className="p-6 flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ajuste de Conteúdo</span>
            <h3 className="text-lg font-bold font-display text-foreground mt-0.5">
              {ajusteEscopo === 'geral'
                ? 'Pedir ajuste na publicação'
                : ajusteTimestamp != null
                ? `Pedir ajuste aos ${formatarTimecode(ajusteTimestamp)}`
                : ajusteSlideIndex != null
                ? `Pedir ajuste no slide ${ajusteSlideIndex}`
                : 'Pedir ajuste na publicação'}
            </h3>
          </div>

          {(ajusteTimestamp != null || (ajusteSlideIndex != null && arquivos.length > 1)) && (
            <div role="radiogroup" aria-label="Sobre o que é o ajuste" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted border border-border">
              {([
                ['ponto', ajusteTimestamp != null ? `Este momento (${formatarTimecode(ajusteTimestamp)})` : `Este slide (${ajusteSlideIndex})`],
                ['geral', 'A publicação toda'],
              ] as const).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ajusteEscopo === valor}
                  onClick={() => setAjusteEscopo(valor)}
                  className={`h-9 rounded-lg text-xs font-medium transition-colors cursor-pointer ${ajusteEscopo === valor ? 'bg-card text-foreground shadow-xs ring-1 ring-border-strong' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-accent/60 border border-border text-xs flex items-center gap-2">
            {ajusteEscopo === 'geral' ? (
              <>
                <Smartphone className="w-4 h-4 text-primary" />
                <span>O ajuste vale para a publicação inteira (legenda, ordem, ideia geral).</span>
              </>
            ) : ajusteTimestamp != null ? (
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
              className="w-full bg-card border border-input rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-foreground/50"
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

function BarraDecisao({
  aprovado,
  pendente,
  enviando,
  rotuloAjuste,
  onAjuste,
  onAprovar,
  onDesfazer,
  autorNome,
  onTrocarNome,
  compacto,
}: {
  aprovado: boolean;
  pendente: number | null;
  enviando: boolean;
  rotuloAjuste: string;
  onAjuste: () => void;
  onAprovar: () => void;
  onDesfazer: () => void;
  autorNome: string;
  onTrocarNome: () => void;
  compacto?: boolean;
}) {
  if (aprovado) {
    return (
      <div role="status" className={`${compacto ? 'p-3' : 'p-3.5'} rounded-xl bg-success-soft border border-success-ring text-success flex items-center justify-center gap-2 font-semibold text-sm`}>
        <CheckCircle2 className="w-4 h-4" />
        <span>Publicação aprovada. A agência já foi avisada.</span>
      </div>
    );
  }

  if (pendente !== null) {
    return (
      <div role="status" aria-live="polite" className="p-2 pl-3.5 rounded-xl bg-success-soft border border-success-ring flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <span className="flex-1 text-sm font-semibold text-success">Aprovado</span>
        <span className="text-xs text-muted-foreground tabular-nums">envia em {pendente}s</span>
        <Button type="button" variant="secondary" size="sm" onClick={onDesfazer}>
          <Undo2 className="w-3.5 h-3.5" />
          Desfazer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" onClick={onAjuste} disabled={enviando} className="h-10">
          <MessageSquarePlus className="w-3.5 h-3.5" />
          {rotuloAjuste}
        </Button>
        <Button type="button" variant="lime" onClick={onAprovar} loading={enviando} className="h-10">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Aprovar
        </Button>
      </div>
      {autorNome && (
        <button type="button" onClick={onTrocarNome} className="self-center flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          <UserRound className="w-3 h-3" />
          Respondendo como <strong className="font-semibold text-foreground">{autorNome}</strong> · trocar
        </button>
      )}
    </div>
  );
}
