'use client';

import { Tip } from '@/components/ui/tooltip';
import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
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
  Download,
  Copy,
  Check,
  FolderDown,
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

  const [ajusteEscopo, setAjusteEscopo] = useState<'ponto' | 'geral'>('ponto');
  const [ajusteSlideIndex, setAjusteSlideIndex] = useState<number | null>(null);
  const [ajusteTimestamp, setAjusteTimestamp] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucessoAprovado, setSucessoAprovado] = useState(
    itemInicial?.status === 'agendamento' || itemInicial?.status === 'pronto_publicar' || itemInicial?.status === 'publicado'
  );

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Estados de Download em Alta Resolução
  const [modalDownloadAberto, setModalDownloadAberto] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [statusDownload, setStatusDownload] = useState<string | null>(null);
  const [copiouLegenda, setCopiouLegenda] = useState(false);

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

  // Clique em "Aprovar": envia imediatamente a aprovação para o servidor
  function handleAprovar() {
    comNome(() => {
      void enviarAprovacao();
    });
  }

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
        <Spinner size="md" className="text-foreground mb-4" />
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

  function sanitizarNome(texto: string): string {
    return (
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'post'
    );
  }

  function getNomeArquivoDownload(index?: number, total?: number, tipoArquivo?: string): string {
    const cli = sanitizarNome(item?.cliente?.nome || 'cliente');
    const tit = sanitizarNome(item?.titulo || 'conteudo');
    const ext = tipoArquivo === 'video' || (item?.tipo === 'reel' && (index === undefined || index === 0)) ? 'mp4' : 'png';
    if (total && total > 1 && index != null) {
      return `${cli}-${tit}-slide-${index + 1}.${ext}`;
    }
    return `${cli}-${tit}.${ext}`;
  }

  function getMimeType(nome: string): string {
    const ext = nome.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      default:
        return 'image/png';
    }
  }

  function dispararDownloadDireto(downloadProxyUrl: string, nomeArquivo: string) {
    // Dispara o download diretamente usando a rota /api/download na mesma origem.
    // Como a rota responde com 'Content-Disposition: attachment' e 'application/octet-stream',
    // o navegador salva diretamente na pasta de Downloads SEM abrir qualquer nova guia.
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = downloadProxyUrl;
    link.setAttribute('download', nomeArquivo);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {}
    }, 2000);
  }

  async function baixarArquivoIndividual(url: string, nomeArquivo: string): Promise<'success' | 'aborted' | 'error'> {
    const downloadProxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(nomeArquivo)}`;

    // 1. Mobile (iOS Safari / Android Chrome / WhatsApp WebView):
    // Tenta usar a Web Share API nativa com File.
    // No iPhone e Android, isso abre a folha nativa do sistema com a ação "Salvar Imagem" / "Salvar Vídeo"
    // gravando diretamente no rolo da câmera / galeria de fotos, SEM ABRIR NENHUMA NOVA GUIA!
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const res = await fetch(downloadProxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          const mimeType = getMimeType(nomeArquivo);
          const file = new File([blob], nomeArquivo, { type: mimeType });

          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: nomeArquivo,
              });
              return 'success';
            } catch (shareErr: any) {
              if (shareErr?.name === 'AbortError') {
                return 'aborted';
              }
            }
          }
        }
      }
    } catch {
      // Segue para o download direto caso a API de compartilhamento não responda
    }

    // 2. Desktop e Fallback Universal:
    // Dispara o download diretamente na mesma página via cabeçalho HTTP attachment.
    // NUNCA usamos blob URLs aqui para garantir que nenhum navegador mobile ou desktop abra o visualizador em nova aba.
    try {
      dispararDownloadDireto(downloadProxyUrl, nomeArquivo);
      return 'success';
    } catch {
      return 'error';
    }
  }

  async function handleBaixarSlideAtualOuUnico() {
    if (!item?.arquivos || item.arquivos.length === 0) return;
    const idx = Math.min(Math.max(0, slideAtual), item.arquivos.length - 1);
    const arq = item.arquivos[idx] || item.arquivos[0];
    if (!arq?.url) return;

    setBaixando(true);
    const nome = getNomeArquivoDownload(idx, item.arquivos.length, arq.tipo);
    try {
      const res = await baixarArquivoIndividual(arq.url, nome);
      if (res === 'success') {
        toast.success(
          item.arquivos.length > 1
            ? `Slide ${idx + 1} em alta resolução baixado!`
            : 'Mídia em alta definição baixada com sucesso!'
        );
      }
    } catch {
      toast.error('Não foi possível concluir o download. Verifique sua conexão.');
    } finally {
      setBaixando(false);
    }
  }

  async function handleBaixarTodos() {
    if (!item?.arquivos || item.arquivos.length === 0) return;
    setBaixando(true);
    const total = item.arquivos.length;

    try {
      // 1. No Mobile: Tenta agrupar e compartilhar todas as artes de uma vez só via Web Share API.
      // No iPhone/Android, isso permite ao cliente tocar em "Salvar X Imagens" direto na galeria!
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const arquivosParaCompartilhar: File[] = [];
        let falhaNoCarregamento = false;

        for (let i = 0; i < total; i++) {
          setStatusDownload(`Preparando arte ${i + 1} de ${total}...`);
          const arq = item.arquivos[i];
          const nome = getNomeArquivoDownload(i, total, arq.tipo);
          const downloadProxyUrl = `/api/download?url=${encodeURIComponent(arq.url)}&filename=${encodeURIComponent(nome)}`;
          try {
            const res = await fetch(downloadProxyUrl);
            if (!res.ok) throw new Error('Falha');
            const blob = await res.blob();
            const mimeType = getMimeType(nome);
            arquivosParaCompartilhar.push(new File([blob], nome, { type: mimeType }));
          } catch {
            falhaNoCarregamento = true;
            break;
          }
        }

        if (!falhaNoCarregamento && arquivosParaCompartilhar.length === total) {
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: arquivosParaCompartilhar })) {
            try {
              setStatusDownload('Salvando na galeria do celular...');
              await navigator.share({
                files: arquivosParaCompartilhar,
                title: `Todas as artes em HD - ${item.cliente?.nome || 'Post'}`,
              });
              toast.success(`Todas as ${total} artes foram salvas com sucesso!`);
              return;
            } catch (shareErr: any) {
              if (shareErr?.name === 'AbortError') {
                return;
              }
            }
          }
        }
      }

      // 2. Desktop e Fallback: Dispara o download sequencial direto sem criar novas abas
      for (let i = 0; i < total; i++) {
        const arq = item.arquivos[i];
        setStatusDownload(`Baixando arte ${i + 1} de ${total}...`);
        const nome = getNomeArquivoDownload(i, total, arq.tipo);
        const downloadProxyUrl = `/api/download?url=${encodeURIComponent(arq.url)}&filename=${encodeURIComponent(nome)}`;
        dispararDownloadDireto(downloadProxyUrl, nome);
        if (i < total - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      toast.success(`Todas as ${total} artes em alta definição foram baixadas!`);
    } catch {
      toast.error('Erro ao baixar alguns arquivos.');
    } finally {
      setBaixando(false);
      setStatusDownload(null);
    }
  }

  function handleCopiarLegenda() {
    if (!item?.legenda) {
      toast.error('Nenhuma legenda cadastrada para este post.');
      return;
    }
    navigator.clipboard.writeText(item.legenda);
    setCopiouLegenda(true);
    toast.success('Legenda copiada para a área de transferência!');
    setTimeout(() => setCopiouLegenda(false), 3000);
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
          {arquivos.length > 0 && (
            <Tip label="Baixar material em alta definição para postar">
              <button
                type="button"
                onClick={() => setModalDownloadAberto(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card hover:bg-accent border border-border text-xs font-bold text-foreground transition-ui cursor-pointer shadow-2xs active:scale-[0.98]"
                aria-label="Baixar material em alta definição"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Baixar HD</span>
              </button>
            </Tip>
          )}
          <Badge
            variant={sucessoAprovado ? 'success' : item.status === 'travado' ? 'destructive' : 'warning'}
            className="text-xs font-bold px-2.5 py-1"
          >
            {sucessoAprovado ? 'Aprovado' : item.status === 'travado' ? 'Ajustes Solicitados' : 'Aguardando Aprovação'}
          </Badge>
          <Tip label={theme === 'dark' ? 'Mudar para o Modo Claro' : 'Mudar para o Dark Mode'}><button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para o Modo Claro' : 'Mudar para o Dark Mode'}
            className="p-1.5 rounded-xl bg-card hover:bg-accent border border-border text-foreground transition-ui duration-150 cursor-pointer shadow-2xs flex items-center justify-center ml-1 active:scale-[0.98]"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-primary animate-in spin-in-180 duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-primary animate-in spin-in-180 duration-200" />
            )}
          </button></Tip>
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

        {/* Card de Material em Alta Definição para o Cliente Baixar e Postar */}
        {arquivos.length > 0 && (
          <div className="w-full max-w-[420px] bg-card rounded-2xl border border-border p-3.5 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {isReel ? 'Vídeo em Alta Resolução (HD)' : isCarrossel ? `Carrossel em Alta Resolução (${arquivos.length} artes)` : 'Arte em Alta Resolução (HD)'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isReel ? 'MP4 original pronto para postar' : 'Arquivos originais em qualidade máxima'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalDownloadAberto(true)}
                className="text-xs font-semibold text-primary hover:text-primary/80 h-7 px-2 cursor-pointer"
              >
                Opções ↗
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={baixando}
                onClick={handleBaixarSlideAtualOuUnico}
                className="h-9 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-accent hover:bg-accent/80 border border-border"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">{isCarrossel ? `Baixar Slide ${slideAtual + 1}` : 'Baixar Mídia HD'}</span>
              </Button>

              {isCarrossel ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={baixando}
                  onClick={handleBaixarTodos}
                  className="h-9 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
                >
                  <FolderDown className="w-3.5 h-3.5" />
                  <span className="truncate">{statusDownload || `Baixar Todas (${arquivos.length})`}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopiarLegenda}
                  className="h-9 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiouLegenda ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="truncate">{copiouLegenda ? 'Copiada!' : 'Copiar Legenda'}</span>
                </Button>
              )}
            </div>

            {isCarrossel && item.legenda && (
              <button
                type="button"
                onClick={handleCopiarLegenda}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 pt-0.5 cursor-pointer"
              >
                {copiouLegenda ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                <span>{copiouLegenda ? 'Legenda copiada para a área de transferência!' : 'Copiar texto da legenda'}</span>
              </button>
            )}
          </div>
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
            enviando={enviando}
            rotuloAjuste={isReel ? `Ajustar aos ${formatarTimecode(videoTempo)}` : arquivos.length > 1 ? `Ajustar slide ${slideAtual + 1}` : 'Sugerir ajuste'}
            onAjuste={() => comNome(() => (isReel ? handleAbrirAjusteVideo(videoTempo) : handleAbrirAjusteSlide(slideAtual + 1)))}
            onAprovar={handleAprovar}
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
                  <Tip label={"Perfil Verificado"}><span className="w-4 h-4 bg-info text-info-foreground rounded-full inline-flex items-center justify-center text-xs font-bold">✓</span></Tip>
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
                <Tip label={"Curtir"}><button
                  type="button"
                  onClick={() => setCurtido(!curtido)}
                  className="hover:text-muted-foreground transition-transform active:scale-125" aria-label={"Curtir"}
                >
                  <Heart className={`w-6 h-6 ${curtido ? 'fill-destructive text-destructive' : ''}`} />
                </button></Tip>
                <Tip label={"Comentar / Sugerir Ajuste"}><button
                  type="button"
                  onClick={() => comNome(() => (isReel ? handleAbrirAjusteVideo(videoTempo) : handleAbrirAjusteSlide(slideAtual + 1)))}
                  className="hover:text-muted-foreground transition-transform active:scale-110" aria-label={"Comentar / Sugerir Ajuste"}
                >
                  <MessageCircle className="w-6 h-6" />
                </button></Tip>
                <Tip label={"Compartilhar"}><button type="button" className="hover:text-muted-foreground transition-transform active:scale-110" aria-label={"Compartilhar"}>
                  <Send className="w-6 h-6" />
                </button></Tip>
                {arquivos.length > 0 && (
                  <Tip label="Baixar em Alta Definição (HD)">
                    <button
                      type="button"
                      onClick={() => setModalDownloadAberto(true)}
                      className="hover:text-primary transition-transform active:scale-110 cursor-pointer"
                      aria-label="Baixar em Alta Definição"
                    >
                      <Download className="w-6 h-6" />
                    </button>
                  </Tip>
                )}
              </div>
              <Tip label={"Salvar"}><button
                type="button"
                onClick={() => setSalvo(!salvo)}
                className="hover:text-muted-foreground transition-transform active:scale-110" aria-label={"Salvar"}
              >
                <Bookmark className={`w-6 h-6 ${salvo ? 'fill-foreground text-foreground' : ''}`} />
              </button></Tip>
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
                enviando={enviando}
                rotuloAjuste={isReel ? `Ajustar aos ${formatarTimecode(videoTempo)}` : arquivos.length > 1 ? `Ajustar slide ${slideAtual + 1}` : 'Sugerir ajuste'}
                onAjuste={() => comNome(() => (isReel ? handleAbrirAjusteVideo(videoTempo) : handleAbrirAjusteSlide(slideAtual + 1)))}
                onAprovar={handleAprovar}
                autorNome={autorNome}
                onTrocarNome={() => {
                  setNomeRascunho(autorNome);
                  setNomeSheetAberto(true);
                }}
                compacto
              />
            </div>

            {arquivos.length > 0 && (
              <div className="px-3 pb-2.5 bg-accent/30 flex items-center justify-between gap-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalDownloadAberto(true)}
                  className="w-full text-xs font-bold gap-1.5 text-primary hover:text-primary hover:bg-primary/10 h-8 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar material em alta resolução (HD)</span>
                </Button>
              </div>
            )}

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

      {/* Modal / Sheet Exclusivo para Download em Alta Definição */}
      <Sheet
        open={modalDownloadAberto}
        onClose={() => setModalDownloadAberto(false)}
        aria-label="Baixar em Alta Definição"
        className="w-full max-w-md"
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold font-display text-foreground">Baixar em Alta Definição</h3>
            <p className="text-xs text-muted-foreground">Baixe os arquivos originais em resolução máxima no seu dispositivo para postar diretamente.</p>
          </div>
          {/* Cartão de Identificação do Post */}
          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border flex items-center gap-3">
            <div className="w-12 h-14 rounded-xl bg-muted overflow-hidden shrink-0 border border-border flex items-center justify-center">
              {arquivos[slideAtual]?.tipo === 'video' ? (
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              ) : arquivos[slideAtual]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={arquivos[slideAtual]?.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{item.titulo || 'Publicação do Instagram'}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {isReel ? 'Vídeo Reels (Vertical 9:16)' : isStory ? 'Story (Vertical 9:16)' : isCarrossel ? `Carrossel (${arquivos.length} fotos 4:5)` : 'Post Feed (Retrato 4:5)'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                  Resolução Original Máxima
                </span>
              </div>
            </div>
          </div>

          {/* Opções de Download */}
          <div className="flex flex-col gap-2.5">
            {isCarrossel ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  disabled={baixando}
                  onClick={handleBaixarSlideAtualOuUnico}
                  className="h-11 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer w-full"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Slide Atual (#{slideAtual + 1}) em HD</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={baixando}
                  onClick={handleBaixarTodos}
                  className="h-11 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer w-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  <FolderDown className="w-4 h-4" />
                  <span>{statusDownload || `Baixar Todas as Artes (${arquivos.length} arquivos)`}</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled={baixando}
                onClick={handleBaixarSlideAtualOuUnico}
                className="h-11 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer w-full"
              >
                <Download className="w-4 h-4" />
                <span>{isReel ? 'Baixar Vídeo em Alta Definição (HD)' : 'Baixar Arte em Alta Definição (HD)'}</span>
              </Button>
            )}

            {/* Copiar Legenda */}
            {item.legenda && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopiarLegenda}
                className="h-10 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer w-full border border-border"
              >
                {copiouLegenda ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                <span>{copiouLegenda ? 'Legenda copiada com sucesso!' : 'Copiar Legenda do Post'}</span>
              </Button>
            )}
          </div>

          {/* Dica para o Cliente */}
          <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground flex flex-col gap-1 leading-relaxed">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              💡 Dica para postar pelo celular:
            </span>
            <span>
              1. Ao clicar em baixar, o arquivo de alta qualidade será salvo na galeria de fotos ou downloads do seu smartphone.
            </span>
            <span>
              2. Copie a legenda clicando no botão acima.
            </span>
            <span>
              3. Abra o Instagram, selecione o arquivo baixado e cole a legenda na hora de postar.
            </span>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalDownloadAberto(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Sheet>

    </div>
  );
}

function BarraDecisao({
  aprovado,
  enviando,
  rotuloAjuste,
  onAjuste,
  onAprovar,
  autorNome,
  onTrocarNome,
  compacto,
}: {
  aprovado: boolean;
  enviando: boolean;
  rotuloAjuste: string;
  onAjuste: () => void;
  onAprovar: () => void;
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
