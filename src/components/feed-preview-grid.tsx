'use client';

import React, { useState } from 'react';
import {
  Grid3X3,
  Download,
  Share2,
  ExternalLink,
  Layers,
  Video,
  Check,
  Copy,
  RefreshCw,
  X,
  MessageCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Send,
  Calendar,
  Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram } from '@/components/instagram-icon';
import { STATUS_LABELS, type ConteudoItem, type StatusConteudo } from '@/lib/conteudo';
import type { Cliente } from '@/lib/clientes';

interface FeedPreviewGridProps {
  cliente: Cliente;
  items: ConteudoItem[];
  mesSelecionado: string; // YYYY-MM
  onAbrirEdicao?: (item: ConteudoItem) => void;
  showToast?: (message: string, type: 'success' | 'error') => void;
  onAtualizarCliente?: (cliente: Cliente) => void;
}

export function FeedPreviewGrid({
  cliente,
  items,
  mesSelecionado,
  onAbrirEdicao,
  showToast,
  onAtualizarCliente,
}: FeedPreviewGridProps) {
  const [modalShareAberto, setModalShareAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [renovandoToken, setRenovandoToken] = useState(false);

  // Modal de visualização detalhada do post clicado
  const [postAtivo, setPostAtivo] = useState<ConteudoItem | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  // Filtra itens do cliente e do mês que tenham mídias ou estejam em planejamento/produção
  const postsDoMes = items
    .filter((it) => {
      const matchCliente = it.cliente_id === cliente.id;
      const itMes = it.mes_referencia ? it.mes_referencia.slice(0, 7) : '';
      const matchMes = !mesSelecionado || itMes === mesSelecionado;
      return matchCliente && matchMes;
    })
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const linkPublico = typeof window !== 'undefined' && cliente.token_aprovacao_mes
    ? `${window.location.origin}/aprovacao/feed/${cliente.token_aprovacao_mes}`
    : '';

  function handleCopiarLink() {
    if (!linkPublico) return;
    navigator.clipboard.writeText(linkPublico);
    setCopiado(true);
    showToast?.('Link público do feed copiado!', 'success');
    setTimeout(() => setCopiado(false), 2500);
  }

  async function handleRenovarToken() {
    if (!confirm('Deseja revogar o link anterior e gerar um novo link para este cliente?')) return;
    setRenovandoToken(true);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renovar_token_mes: true }),
      });
      if (!res.ok) throw new Error('Falha ao renovar token');
      const data = await res.json();
      if (data?.token_aprovacao_mes) {
        onAtualizarCliente?.({ ...cliente, token_aprovacao_mes: data.token_aprovacao_mes });
        showToast?.('Novo link exclusivo gerado com sucesso!', 'success');
      }
    } catch {
      showToast?.('Erro ao renovar link público.', 'error');
    } finally {
      setRenovandoToken(false);
    }
  }

  function handleBaixarEmAlta() {
    const urlsParaBaixar = postsDoMes.flatMap((p) => (p.arquivos || []).map((a) => a.url));
    if (urlsParaBaixar.length === 0) {
      showToast?.('Nenhuma arte com arquivo para download neste mês.', 'error');
      return;
    }
    // Abre a primeira ou copia todas
    urlsParaBaixar.forEach((url, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = `arte_${i + 1}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 250);
    });
    showToast?.(`Iniciando download de ${urlsParaBaixar.length} arquivo(s)...`, 'success');
  }

  const linkWhatsappWeb = `https://web.whatsapp.com/send?text=${encodeURIComponent(
    `Olá! Segue o link exclusivo para visualizar e aprovar a grade completa das publicações de ${mesSelecionado}:\n\n${linkPublico}\n\nVocê pode conferir o design do feed, passar os slides dos carrosséis e deixar suas sugestões diretamente na página! 🚀`
  )}`;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Topo de Ações da Grade de Feed (idêntico à Imagem 3 de referência) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-3xl border border-border/80 shadow-2xs backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#d8ff3c] via-[#55703a] to-[#192313] p-0.5 shadow-2xs">
            <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center text-foreground font-bold font-mono">
              <Grid3X3 className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold font-display text-foreground">
                Preview de Feed 3x3 do Instagram
              </h3>
              <Badge variant="info" className="text-[10px] font-mono font-bold">
                {postsDoMes.length} postagens
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Simulação estética do perfil do cliente ({cliente.nome}) para avaliar harmonia e sequência
            </p>
          </div>
        </div>

        {/* Botões do Topo (Baixar em Alta Qualidade & Compartilhar Preview) */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBaixarEmAlta}
            className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Baixar em Alta Qualidade</span>
          </Button>

          <Button
            type="button"
            variant="lime"
            size="sm"
            onClick={() => setModalShareAberto(true)}
            className="rounded-xl text-xs font-bold gap-1.5 shadow-xs text-black cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartilhar Preview</span>
          </Button>
        </div>
      </div>

      {/* Grade 3x3 do Instagram */}
      {postsDoMes.length === 0 ? (
        <Card padding="lg" className="rounded-3xl border-dashed border-border p-12 text-center flex flex-col items-center gap-3">
          <Grid3X3 className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-bold text-foreground">Nenhuma postagem cadastrada para {mesSelecionado}</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Crie demandas na esteira com fotos ou vídeos para montar a grade estética de 9 publicações do mês.
          </p>
        </Card>
      ) : (
        <div className="max-w-3xl mx-auto w-full">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 bg-black/40 p-2 sm:p-3.5 rounded-3xl border border-border/80 shadow-2xl">
            {postsDoMes.map((post, idx) => {
              const primeiraMidia = post.arquivos?.[0]?.url || null;
              const isVideo = post.tipo === 'reel' || post.arquivos?.[0]?.tipo === 'video';
              const isCarrossel = post.tipo === 'post' && (post.arquivos?.length || 0) > 1;
              const slidesCount = post.arquivos?.length || 1;
              const statusMeta = STATUS_LABELS[post.status];

              return (
                <div
                  key={post.id}
                  onClick={() => {
                    setPostAtivo(post);
                    setSlideIndex(0);
                  }}
                  className="group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-card/80 border border-border/60 hover:border-primary/60 transition-all cursor-pointer select-none"
                >
                  {/* Imagem / Vídeo de Capa */}
                  {primeiraMidia ? (
                    isVideo ? (
                      <video src={primeiraMidia} className="w-full h-full object-cover" muted />
                    ) : (
                      <img
                        src={primeiraMidia}
                        alt={post.titulo || `Post ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-accent/30 text-muted-foreground gap-1">
                      <span className="text-xs font-mono font-bold">#{String(idx + 1).padStart(2, '0')}</span>
                      <p className="text-[10px] font-medium line-clamp-2">{post.titulo || 'Sem arte'}</p>
                    </div>
                  )}

                  {/* Número de Ordem no Topo Esquerdo */}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold text-white shadow-xs">
                    #{String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Badges de Formato no Topo Direito (Carrossel ou Vídeo) */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isCarrossel && (
                      <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold text-white flex items-center gap-1 shadow-xs">
                        <Layers className="w-2.5 h-2.5" />
                        <span>{slidesCount}</span>
                      </span>
                    )}
                    {isVideo && (
                      <span className="p-1 rounded-md bg-black/75 backdrop-blur-md text-white shadow-xs">
                        <Video className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Pílula de Status na Base */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                    <span
                      className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-md truncate shadow-md ${
                        post.status === 'agendamento' || post.status === 'pronto_publicar' || post.status === 'publicado'
                          ? 'bg-primary text-black font-extrabold'
                          : 'bg-black/80 text-white'
                      }`}
                    >
                      {statusMeta?.label || post.status}
                    </span>
                  </div>

                  {/* Overlay ao passar o mouse */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 rounded-full bg-black/70 text-white backdrop-blur-md">
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: COMPARTILHAR PREVIEW (idêntico à Imagem 3 de referência) */}
      {modalShareAberto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setModalShareAberto(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Cabeçalho */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider">
                LINK PÚBLICO DO PREVIEW
              </span>
              <h4 className="text-base font-bold font-display text-foreground">
                Compartilhar Grade com {cliente.nome}
              </h4>
            </div>

            {/* Input com Link e Botão Copiar */}
            <div className="flex items-center gap-2 p-1.5 bg-accent/40 rounded-2xl border border-border/80">
              <input
                type="text"
                readOnly
                value={linkPublico}
                className="flex-1 bg-transparent px-2.5 text-xs text-foreground font-mono truncate focus:outline-none"
              />
              <Button
                type="button"
                variant="lime"
                size="sm"
                onClick={handleCopiarLink}
                className="rounded-xl text-xs font-bold text-black gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiado ? 'Copiado!' : 'Copiar'}</span>
              </Button>
            </div>

            {/* Ação WhatsApp Web Direta */}
            <a
              href={linkWhatsappWeb}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 text-xs font-bold transition-colors shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar no WhatsApp Web</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>

            {/* Ação de Revogar / Gerar Novo Link */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
              <button
                type="button"
                disabled={renovandoToken}
                onClick={handleRenovarToken}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${renovandoToken ? 'animate-spin' : ''}`} />
                <span>Gerar novo link (revoga o anterior)</span>
              </button>
              <button
                type="button"
                onClick={() => setModalShareAberto(false)}
                className="text-muted-foreground hover:text-foreground font-medium cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Descrição Explicativa */}
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              Link fixo — não muda de mês pra mês, sempre mostra as publicações do cliente. Quem tiver o link pode navegar pelos carrosséis e deixar comentários e aprovações.
            </p>
          </div>
        </div>
      )}

      {/* Modal / Drawer do Post Ativo (Navegação Fiel ao Portal do Cliente) */}
      {postAtivo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-card border border-border/80 rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 max-h-[90vh] relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setPostAtivo(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Lado Esquerdo: Mídia com visualizador carrossel (lg:col-span-7) */}
            <div className="lg:col-span-7 bg-black flex items-center justify-center relative min-h-[350px] lg:min-h-[500px]">
              {postAtivo.arquivos && postAtivo.arquivos.length > 0 ? (
                <>
                  {postAtivo.arquivos[slideIndex]?.tipo === 'video' ? (
                    <video
                      src={postAtivo.arquivos[slideIndex]?.url}
                      className="w-full h-full max-h-[500px] object-contain"
                      controls
                      autoPlay
                    />
                  ) : (
                    <img
                      src={postAtivo.arquivos[slideIndex]?.url}
                      alt=""
                      className="w-full h-full max-h-[500px] object-contain select-none"
                    />
                  )}

                  {/* Setas do Carrossel */}
                  {postAtivo.arquivos.length > 1 && (
                    <>
                      {slideIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => setSlideIndex((i) => i - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}
                      {slideIndex < postAtivo.arquivos.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setSlideIndex((i) => i + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                      <span className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-mono font-bold backdrop-blur-md">
                        {slideIndex + 1}/{postAtivo.arquivos.length}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma mídia anexada a este post.</p>
              )}
            </div>

            {/* Lado Direito: Informações, Legenda e Ações (lg:col-span-5) */}
            <div className="lg:col-span-5 p-6 flex flex-col justify-between overflow-y-auto max-h-[500px] gap-4 bg-card">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider">
                      {postAtivo.tipo.toUpperCase()}
                    </span>
                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{postAtivo.titulo}</h4>
                  </div>
                  <Badge variant="info" className="text-[10px] font-bold">
                    {STATUS_LABELS[postAtivo.status]?.label || postAtivo.status}
                  </Badge>
                </div>

                {/* Previsão de publicação */}
                {postAtivo.data_programada && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Publicação: {new Date(postAtivo.data_programada).toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {/* Legenda */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-foreground">Legenda da Postagem:</span>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto p-2.5 rounded-xl bg-accent/20 border border-border/60 font-sans">
                    {postAtivo.legenda || '(sem legenda cadastrada)'}
                  </p>
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const item = postAtivo;
                    setPostAtivo(null);
                    onAbrirEdicao?.(item);
                  }}
                  className="flex-1 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Abrir na Esteira
                </Button>
                <Button
                  type="button"
                  variant="lime"
                  size="sm"
                  onClick={() => setPostAtivo(null)}
                  className="rounded-xl text-xs font-bold text-black cursor-pointer px-4"
                >
                  Concluído
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
