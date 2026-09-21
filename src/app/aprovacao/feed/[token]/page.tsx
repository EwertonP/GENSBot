'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Grid3X3,
  Video,
  CheckCircle2,
  Share2,
  Heart,
  MessageCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';

interface PostFeed {
  id: string;
  tipo: string;
  status: string;
  titulo: string | null;
  legenda: string | null;
  arquivos: Array<{ id: string; url: string; tipo: 'imagem' | 'video'; ordem: number }>;
  token_aprovacao: string;
}

interface ClienteFeed {
  id: string;
  nome: string;
  cor: string | null;
  nicho: string | null;
  foto_url: string | null;
  briefing: string | null;
  instagram_accounts?: {
    instagram_username: string | null;
    profile_picture_url: string | null;
  } | null;
}

export default function FeedAprovacaoPage() {
  const { token } = useParams<{ token: string }>();

  const [cliente, setCliente] = useState<ClienteFeed | null>(null);
  const [posts, setPosts] = useState<PostFeed[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal de Post Selecionado
  const [postSelecionado, setPostSelecionado] = useState<PostFeed | null>(null);
  const [slideAtivo, setSlideAtivo] = useState(0);

  // Aprovação em massa
  const [aprovandoGrade, setAprovandoGrade] = useState(false);
  const [gradeAprovada, setGradeAprovada] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/aprovacao/feed/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setErro(data.error);
        } else {
          setCliente(data.cliente);
          setPosts(data.posts || []);
        }
      })
      .catch(() => setErro('Erro de conexão ao carregar feed.'))
      .finally(() => setCarregando(false));
  }, [token]);

  async function handleAprovarGrade() {
    if (!confirm('Deseja aprovar todas as publicações pendentes desta grade?')) return;
    setAprovandoGrade(true);
    try {
      const res = await fetch(`/api/aprovacao/feed/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGradeAprovada(true);
      setPosts((prev) =>
        prev.map((p) => (p.status === 'revisao_cliente' ? { ...p, status: 'agendamento' } : p))
      );
    } catch {
      alert('Não foi possível aprovar a grade. Tente novamente.');
    } finally {
      setAprovandoGrade(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#000] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-foreground/20 border-t-foreground rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground mt-4 font-mono">Carregando feed no Instagram...</p>
      </div>
    );
  }

  if (erro || !cliente) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#000] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <X className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-foreground">Grade não disponível</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{erro || 'Link expirado ou inválido.'}</p>
      </div>
    );
  }

  const username =
    cliente.instagram_accounts?.instagram_username ||
    cliente.nome.toLowerCase().replace(/\s+/g, '_');
  const avatarUrl =
    cliente.instagram_accounts?.profile_picture_url || cliente.foto_url;
  const pendentesAprovacao = posts.filter((p) => p.status === 'revisao_cliente').length;

  return (
    <div className="min-h-screen bg-white text-black antialiased flex flex-col font-sans">
      {/* 1. Barra de Topo da Agência GENS */}
      <header className="sticky top-0 z-30 bg-[#192313] text-[#f7f8f2] px-4 py-3 border-b border-white/10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase bg-[#d8ff3c] text-[#192313] px-2 py-0.5 rounded-full font-mono">
            GENS APROVAÇÃO
          </span>
          <span className="text-xs font-semibold hidden sm:inline">Preview de Grade de Feed</span>
        </div>

        <div className="flex items-center gap-2">
          {gradeAprovada ? (
            <div className="flex items-center gap-1 text-xs font-bold text-[#d8ff3c]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Grade Aprovada!</span>
            </div>
          ) : pendentesAprovacao > 0 ? (
            <button
              type="button"
              onClick={handleAprovarGrade}
              disabled={aprovandoGrade}
              className="px-3.5 py-1.5 rounded-xl bg-[#d8ff3c] text-[#192313] font-bold text-xs hover:bg-[#c9ef30] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {aprovandoGrade ? 'Aprovando...' : `Aprovar Grade (${pendentesAprovacao} posts)`}
            </button>
          ) : (
            <span className="text-xs text-[#d8ff3c] font-semibold">Tudo Aprovado</span>
          )}
        </div>
      </header>

      {/* 2. Container Central no estilo Instagram Web */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10 flex flex-col gap-6 sm:gap-10">
        {/* Header do Perfil do Instagram */}
        <div className="flex items-start gap-6 sm:gap-12">
          {/* Avatar com Story Ring */}
          <div className="relative shrink-0">
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
              <div className="p-0.5 rounded-full bg-white">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={cliente.nome}
                    className="w-20 h-20 sm:w-36 sm:h-36 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-20 h-20 sm:w-36 sm:h-36 rounded-full flex items-center justify-center font-bold text-2xl text-white"
                    style={{ backgroundColor: cliente.cor || '#192313' }}
                  >
                    {cliente.nome[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Perfil */}
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg sm:text-xl font-medium tracking-tight text-neutral-900 truncate">
                {username}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-semibold">
                Cliente Agência GENS
              </span>
            </div>

            {/* Contadores */}
            <div className="flex items-center gap-6 text-sm text-neutral-800">
              <span>
                <strong className="font-semibold">{posts.length}</strong> publicações
              </span>
              <span className="hidden sm:inline">
                <strong className="font-semibold">3.4k</strong> seguidores
              </span>
              <span className="hidden sm:inline">
                <strong className="font-semibold">412</strong> seguindo
              </span>
            </div>

            {/* Bio & Identificação */}
            <div className="text-xs sm:text-sm text-neutral-800 leading-relaxed">
              <p className="font-bold">{cliente.nome}</p>
              {cliente.nicho && <p className="text-neutral-500">{cliente.nicho}</p>}
              <p className="mt-1">{cliente.briefing || 'Transformando presença digital em autoridade e vendas.'}</p>
            </div>
          </div>
        </div>

        {/* Barra de Abas do Perfil */}
        <div className="border-t border-neutral-200 flex items-center justify-center gap-12 text-xs font-semibold tracking-wider uppercase text-neutral-400">
          <div className="flex items-center gap-1.5 py-3 border-t-2 border-black text-black">
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Publicações</span>
          </div>
          <div className="flex items-center gap-1.5 py-3 text-neutral-400">
            <Video className="w-3.5 h-3.5" />
            <span>Reels</span>
          </div>
        </div>

        {/* Grade 3xN do Feed */}
        {posts.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 text-xs">
            Nenhuma publicação pronta nesta grade.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-4 md:gap-6">
            {posts.map((post) => {
              const primeiraMidia = post.arquivos?.[0]?.url;
              const isVideo = post.tipo === 'reel' || post.arquivos?.[0]?.tipo === 'video';
              const isCarrossel = post.arquivos?.length > 1;

              return (
                <div
                  key={post.id}
                  onClick={() => {
                    setPostSelecionado(post);
                    setSlideAtivo(0);
                  }}
                  className="group relative aspect-square bg-neutral-100 overflow-hidden cursor-pointer select-none"
                >
                  {primeiraMidia ? (
                    isVideo ? (
                      <video src={primeiraMidia} className="w-full h-full object-cover" muted />
                    ) : (
                      <img
                        src={primeiraMidia}
                        alt={post.titulo || 'Post'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-neutral-50 text-neutral-400 text-xs">
                      <p className="font-semibold text-neutral-700 line-clamp-2">{post.titulo || 'Sem mídia'}</p>
                    </div>
                  )}

                  {/* Badges de Tipo no Canto Superior Direito */}
                  {isCarrossel && (
                    <div className="absolute top-2 right-2 p-1 rounded-md bg-black/50 text-white backdrop-blur-xs">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {isVideo && !isCarrossel && (
                    <div className="absolute top-2 right-2 p-1 rounded-md bg-black/50 text-white backdrop-blur-xs">
                      <Video className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Overlay ao passar o mouse */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-bold text-xs sm:text-sm">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4 fill-white" /> —
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4 fill-white" /> —
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Inspeção do Post Selecionado */}
      {postSelecionado && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPostSelecionado(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fechar */}
            <button
              type="button"
              onClick={() => setPostSelecionado(null)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Mídia do Post (Esquerda) */}
            <div className="md:w-3/5 bg-black flex items-center justify-center relative min-h-[300px] md:min-h-[500px]">
              {postSelecionado.arquivos?.length > 0 ? (
                postSelecionado.arquivos[slideAtivo]?.tipo === 'video' ? (
                  <video
                    src={postSelecionado.arquivos[slideAtivo].url}
                    controls
                    className="max-h-[500px] w-full object-contain"
                  />
                ) : (
                  <img
                    src={postSelecionado.arquivos[slideAtivo]?.url}
                    alt=""
                    className="max-h-[500px] w-full object-contain"
                  />
                )
              ) : (
                <div className="text-white/60 text-xs">Sem mídia anexada</div>
              )}

              {/* Navegação de Carrossel */}
              {postSelecionado.arquivos?.length > 1 && (
                <>
                  {slideAtivo > 0 && (
                    <button
                      type="button"
                      onClick={() => setSlideAtivo((s) => s - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  {slideAtivo < postSelecionado.arquivos.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setSlideAtivo((s) => s + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Conteúdo do Post (Direita) */}
            <div className="md:w-2/5 p-5 flex flex-col justify-between overflow-y-auto max-h-[500px]">
              <div className="flex flex-col gap-3">
                {/* Header autor */}
                <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
                  <img src={avatarUrl || ''} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-xs font-bold text-neutral-900">{username}</span>
                </div>

                {/* Legenda */}
                <div className="text-xs text-neutral-800 leading-relaxed space-y-2">
                  <p className="font-bold">{postSelecionado.titulo}</p>
                  <p className="whitespace-pre-wrap">{postSelecionado.legenda || 'Sem legenda cadastrada.'}</p>
                </div>
              </div>

              {/* Ação de Aprovação Individual */}
              <div className="pt-4 border-t border-neutral-100 mt-4 flex flex-col gap-2">
                <a
                  href={`/aprovacao/${postSelecionado.token_aprovacao}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-center text-xs font-bold transition-all shadow-xs"
                >
                  Abrir Tela de Aprovação Dedicada ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
