'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Clapperboard,
  Video,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  BarChart3,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
  Sparkles,
  ExternalLink,
  Calendar as CalendarIcon,
  AlertCircle,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { CalendarPicker } from '@/components/ui/calendar-picker';
import type { PostingTimeSuggestion } from '@/lib/best-posting-time';
import type { PrefillAgendamento } from '@/lib/conteudo';
import { upload } from '@vercel/blob/client';

type MediaType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';
type PostKind = 'post' | 'reels' | 'story';

interface AccountOption {
  instagram_user_id: string;
  instagram_username: string | null;
}

interface ScheduledPost {
  id: string;
  instagram_user_id: string;
  media_type: MediaType;
  media_url: string;
  media_urls: string[] | null;
  caption: string | null;
  scheduled_at: string;
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled';
  ig_media_id: string | null;
  error_message: string | null;
  published_at: string | null;
}

interface PublishPanelProps {
  accounts: AccountOption[];
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
  prefillData?: PrefillAgendamento | null;
  onClearPrefill?: () => void;
}

const STATUS_META: Record<
  ScheduledPost['status'],
  { label: string; icon: React.ElementType; variant: 'warning' | 'info' | 'success' | 'destructive' | 'muted' }
> = {
  scheduled: { label: 'Agendado', icon: Clock, variant: 'warning' },
  publishing: { label: 'Publicando...', icon: Loader2, variant: 'info' },
  published: { label: 'Publicado', icon: CheckCircle2, variant: 'success' },
  failed: { label: 'Falhou', icon: XCircle, variant: 'destructive' },
  canceled: { label: 'Cancelado', icon: XCircle, variant: 'muted' },
};

function parseNameList(raw: string, max?: number): string[] {
  const names = raw
    .split(',')
    .map((n) => n.trim().replace(/^@/, ''))
    .filter(Boolean);
  return max ? names.slice(0, max) : names;
}

/** Métricas inline para posts já publicados */
function MetricsInline({
  mediaId,
  accountId,
  withAccount,
}: {
  mediaId: string;
  accountId: string;
  withAccount: (url: string) => string;
}) {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(withAccount(`/api/instagram/media-insights?media_id=${mediaId}&account=${accountId}`))
      .then((res) => res.json())
      .then((data) => setMetrics(data.metrics || {}))
      .finally(() => setLoading(false));
  }, [mediaId, accountId]);

  if (loading) return <p className="text-[11px] text-muted-foreground mt-2">Carregando métricas da Meta...</p>;
  if (!metrics || Object.keys(metrics).length === 0) {
    return <p className="text-[11px] text-muted-foreground mt-2">Sem métricas disponíveis ainda para este post.</p>;
  }

  return (
    <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border/60 text-xs">
      {Object.entries(metrics).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1.5 bg-accent/40 px-2.5 py-1 rounded-lg border border-border/50">
          <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
          <span className="font-bold text-foreground font-mono tabular-nums">{value.toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  );
}

/** Mockup de Celular Fiel ao Instagram (Feed 4:5, Reels 9:16 e Stories) */
function InstagramPhoneMockup({
  kind,
  username,
  previewUrls,
  isVideo,
  isCarousel,
  caption,
}: {
  kind: PostKind;
  username: string;
  previewUrls: string[];
  isVideo: boolean;
  isCarousel: boolean;
  caption: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= previewUrls.length) {
      setCurrentIndex(Math.max(0, previewUrls.length - 1));
    }
  }, [previewUrls.length, currentIndex]);

  const activeUrl = previewUrls[currentIndex] || previewUrls[0] || null;

  return (
    <div className="w-full max-w-[340px] mx-auto bg-card rounded-[38px] border-4 border-foreground/15 shadow-2xl overflow-hidden flex flex-col select-none relative">
      {/* Top Notch do Celular */}
      <div className="bg-card px-6 pt-3 pb-2 flex items-center justify-between border-b border-border/40">
        <span className="text-[10px] font-bold text-foreground font-mono">9:41</span>
        <div className="w-16 h-3.5 bg-foreground/90 rounded-full" />
        <div className="flex items-center gap-1 text-[10px] text-foreground">
          <span>5G</span>
          <div className="w-3.5 h-2 rounded-xs border border-foreground/80 bg-foreground/60" />
        </div>
      </div>

      {/* Header do Post no Instagram */}
      <div className="p-3 flex items-center justify-between bg-card border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#d8ff3c] via-[#55703a] to-[#192313] p-0.5 shadow-2xs">
            <div className="w-full h-full rounded-full bg-card flex items-center justify-center font-bold text-[10px] text-foreground">
              {username[1]?.toUpperCase() || 'G'}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground leading-none">{username}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">Áudio original</span>
          </div>
        </div>
        <span className="text-xs font-bold text-muted-foreground tracking-widest">•••</span>
      </div>

      {/* Área da Mídia */}
      <div className={`relative w-full bg-[#0d120a] overflow-hidden flex items-center justify-center ${
        kind === 'story' || kind === 'reels' || (isVideo && !isCarousel) ? 'aspect-[9/16]' : 'aspect-[4/5]'
      }`}>
        {previewUrls.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="w-8 h-8 opacity-30" />
            <p className="text-xs font-medium">Faça upload da foto ou vídeo para ver a prévia real</p>
          </div>
        ) : isVideo ? (
          <video src={activeUrl || ''} className="w-full h-full object-cover" controls muted />
        ) : (
          <img src={activeUrl || ''} alt="" className="w-full h-full object-cover" />
        )}

        {/* Controles de Slide do Carrossel */}
        {isCarousel && previewUrls.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={() => setCurrentIndex((c) => c - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md shadow-md active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {currentIndex < previewUrls.length - 1 && (
              <button
                type="button"
                onClick={() => setCurrentIndex((c) => c + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md shadow-md active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {/* Indicador de Bolinhas do Instagram */}
            <div className="absolute top-3 right-3 bg-black/70 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full backdrop-blur-md">
              {currentIndex + 1}/{previewUrls.length}
            </div>
          </>
        )}
      </div>

      {/* Ações do Instagram */}
      <div className="px-3.5 py-2.5 flex items-center justify-between bg-card text-foreground">
        <div className="flex items-center gap-3.5">
          <Heart className="w-5 h-5 hover:text-destructive cursor-pointer transition-colors" />
          <MessageCircle className="w-5 h-5 cursor-pointer" />
          <Share2 className="w-5 h-5 cursor-pointer" />
        </div>
        {isCarousel && previewUrls.length > 1 && (
          <div className="flex items-center gap-1">
            {previewUrls.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === i ? 'w-3 bg-foreground' : 'w-1 bg-muted-foreground/40'
                }`}
              />
            ))}
          </div>
        )}
        <Bookmark className="w-5 h-5 cursor-pointer" />
      </div>

      {/* Legenda com expansão visual */}
      <div className="px-3.5 pb-4 bg-card flex flex-col gap-1">
        <p className="text-xs text-foreground leading-relaxed line-clamp-3">
          <strong className="mr-1.5">{username}</strong>
          {caption || 'Sua legenda formatada aparecerá aqui com hashtags e quebras de linha...'}
        </p>
        <span className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Há alguns minutos</span>
      </div>
    </div>
  );
}

export default function PublishPanel({
  accounts,
  selectedAccountId,
  withAccount,
  prefillData,
  onClearPrefill,
}: PublishPanelProps) {
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [kind, setKind] = useState<PostKind>('post');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [prefillRemoteUrls, setPrefillRemoteUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [collaboratorsInput, setCollaboratorsInput] = useState('');
  const [userTagsInput, setUserTagsInput] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PostingTimeSuggestion[]>([]);

  // Carrega dados da demanda aprovada quando prefillData estiver presente
  useEffect(() => {
    if (!prefillData) return;
    if (prefillData.kind) setKind(prefillData.kind);
    if (prefillData.caption) setCaption(prefillData.caption);
    if (prefillData.mediaUrls && prefillData.mediaUrls.length > 0) {
      setPreviewUrls(prefillData.mediaUrls);
      setPrefillRemoteUrls(prefillData.mediaUrls);
      setFiles([]);
    }
    if (prefillData.scheduledAt) {
      setScheduleEnabled(true);
      try {
        setScheduledAt(new Date(prefillData.scheduledAt));
      } catch {
        // ignora data inválida
      }
    }
    if (prefillData.instagramUserId) {
      const conta = accounts.find((a) => a.instagram_user_id === prefillData.instagramUserId);
      if (conta) setTargetAccount(conta.instagram_user_id);
    }
  }, [prefillData, accounts]);

  // Lista de Publicações
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all');

  useEffect(() => {
    if (selectedAccountId && selectedAccountId !== 'all') {
      setTargetAccount(selectedAccountId);
    } else if (accounts.length > 0 && !targetAccount) {
      setTargetAccount(accounts[0].instagram_user_id);
    }
  }, [selectedAccountId, accounts]);

  useEffect(() => {
    if (!targetAccount) return;
    fetch(withAccount(`/api/instagram/best-posting-time?account=${targetAccount}`, targetAccount))
      .then((res) => res.json())
      .then((data) => setSuggestions(data.insufficientData ? [] : data.suggestions || []))
      .catch(() => setSuggestions([]));
  }, [targetAccount]);

  const loadPosts = () => {
    setLoadingPosts(true);
    fetch(withAccount('/api/instagram/publish'))
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .finally(() => setLoadingPosts(false));
  };

  useEffect(() => {
    loadPosts();
  }, [selectedAccountId]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (kind === 'post') {
      const merged = [...files, ...selected].slice(0, 10);
      setFiles(merged);
      const localPreviews = merged.map((f) => URL.createObjectURL(f));
      setPreviewUrls([...prefillRemoteUrls, ...localPreviews].slice(0, 10));
    } else {
      const single = selected.slice(0, 1);
      setFiles(single);
      setPrefillRemoteUrls([]);
      setPreviewUrls(single.map((f) => URL.createObjectURL(f)));
    }
  };

  const handleRemoveFile = (index: number) => {
    if (prefillRemoteUrls.length > 0 && index < prefillRemoteUrls.length) {
      const updatedRemote = prefillRemoteUrls.filter((_, i) => i !== index);
      setPrefillRemoteUrls(updatedRemote);
      const updatedFilesPreview = files.map((f) => URL.createObjectURL(f));
      setPreviewUrls([...updatedRemote, ...updatedFilesPreview]);
      return;
    }
    const fileIndex = index - prefillRemoteUrls.length;
    const updatedFiles = files.filter((_, i) => i !== fileIndex);
    setFiles(updatedFiles);
    const updatedFilesPreview = updatedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls([...prefillRemoteUrls, ...updatedFilesPreview]);
  };

  const isVideo =
    files[0]?.type.startsWith('video') ||
    kind === 'reels' ||
    Boolean(previewUrls[0]?.match(/\.(mp4|mov|webm)(\?.*)?$/i));
  const isCarousel = kind === 'post' && (files.length > 1 || previewUrls.length > 1);
  const usernameLabel = `@${accounts.find((a) => a.instagram_user_id === targetAccount)?.instagram_username || 'agenciagens'}`;

  const handleSubmit = async () => {
    if ((files.length === 0 && prefillRemoteUrls.length === 0) || !targetAccount) {
      setError('Selecione uma conta e adicione pelo menos uma imagem ou vídeo.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      let uploadedUrls: string[] = [...prefillRemoteUrls];
      for (const file of files) {
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/instagram/upload-media',
          multipart: true,
        });
        uploadedUrls.push(blob.url);
      }

      if (uploadedUrls.length === 0) {
        throw new Error('Nenhuma mídia disponível para publicação.');
      }

      let mediaType: MediaType;
      if (kind === 'story') mediaType = 'STORIES';
      else if (kind === 'reels') mediaType = 'REELS';
      else if (isCarousel) mediaType = 'CAROUSEL';
      else mediaType = isVideo ? 'VIDEO' : 'IMAGE';

      const collaborators = kind !== 'story' ? parseNameList(collaboratorsInput, 3) : [];
      const userTags = kind === 'story' ? parseNameList(userTagsInput).map((username) => ({ username })) : [];

      const publishRes = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_user_id: targetAccount,
          media_type: mediaType,
          media_url: uploadedUrls[0],
          media_urls: mediaType === 'CAROUSEL' ? uploadedUrls : undefined,
          caption,
          collaborators: collaborators.length > 0 ? collaborators : undefined,
          user_tags: userTags.length > 0 ? userTags : undefined,
          scheduled_at: scheduleEnabled && scheduledAt ? scheduledAt.toISOString() : undefined,
          conteudo_item_id: prefillData?.conteudoId || undefined,
        }),
      });

      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishData.error || 'Falha ao publicar ou agendar.');

      setFiles([]);
      setPreviewUrls([]);
      setPrefillRemoteUrls([]);
      setCaption('');
      setCollaboratorsInput('');
      setUserTagsInput('');
      setScheduleEnabled(false);
      setScheduledAt(null);
      onClearPrefill?.();
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Deseja cancelar esta publicação agendada?')) return;
    await fetch(withAccount(`/api/instagram/publish/${id}`), { method: 'DELETE' });
    loadPosts();
  };

  const postsFiltrados = posts.filter((p) => {
    if (filtroStatus === 'all') return true;
    return p.status === filtroStatus;
  });

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">
      {/* 1. Header do Estúdio de Agendamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-accent px-2 py-0.5 rounded-md border border-border/60">
              Creator Studio
            </span>
            <span className="text-xs text-muted-foreground font-mono">✳</span>
          </div>
          <h3 className="text-2xl font-bold font-display text-foreground tracking-tight mt-1">
            Agendamento & Publicação
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Composição com prévia nativa fiel ao Instagram, upload em lote para carrosséis e horários de pico sugeridos.
          </p>
        </div>

        {/* Seletor de Conta Ativa */}
        <div className="flex items-center gap-2.5 bg-accent/60 p-1.5 rounded-2xl border border-border/80 self-start sm:self-auto shadow-2xs">
          <span className="text-xs font-bold text-muted-foreground px-2">Conta:</span>
          <select
            value={targetAccount}
            onChange={(e) => setTargetAccount(e.target.value)}
            className="h-8 text-xs font-bold bg-card border border-border/80 rounded-xl px-3 text-foreground shadow-2xs focus:outline-none"
          >
            {accounts.map((acc) => (
              <option key={acc.instagram_user_id} value={acc.instagram_user_id}>
                @{acc.instagram_username || acc.instagram_user_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Grid do Estúdio: Composer (Esquerda) + Live Preview (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Lado Esquerdo: Formulário de Criação (lg:col-span-7) */}
        <Card padding="lg" className="lg:col-span-7 rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col gap-6">
          {/* Banner de Demanda Aprovada Vinculada */}
          {prefillData && (
            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 text-primary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">
                    Demanda Aprovada: {prefillData.titulo}
                  </p>
                  <p className="text-muted-foreground text-[11px] truncate">
                    Cliente: <span className="font-semibold text-foreground">{prefillData.clienteNome}</span> · Mídias, legenda e data preenchidos automaticamente.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setPrefillRemoteUrls([]);
                  setPreviewUrls([]);
                  setCaption('');
                  onClearPrefill?.();
                }}
                className="text-xs h-7 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              >
                Desvincular
              </Button>
            </div>
          )}

          {/* Seletor de Formato: Post, Reels, Story */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-foreground">Formato da Publicação</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'post' as const, label: 'Feed / Carrossel', icon: ImageIcon, desc: 'Até 10 slides 4:5' },
                { id: 'reels' as const, label: 'Reels', icon: Clapperboard, desc: 'Vídeo 9:16 até 90s' },
                { id: 'story' as const, label: 'Story', icon: Video, desc: 'Temporário 24h' },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setKind(opt.id);
                      setFiles([]);
                      setPreviewUrls([]);
                      setPrefillRemoteUrls([]);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      active
                        ? 'bg-foreground text-background border-foreground shadow-xs font-bold'
                        : 'bg-accent/40 text-foreground border-border/70 hover:bg-accent/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{opt.label}</span>
                    </div>
                    <span className={`text-[10px] ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload de Mídia com Dropzone & Miniaturas */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Mídia da Publicação</label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {kind === 'post' ? `${previewUrls.length}/10 itens` : `${previewUrls.length} item`}
              </span>
            </div>

            {/* Dropzone */}
            <div className="relative border-2 border-dashed border-border hover:border-foreground/30 rounded-2xl p-6 transition-all text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-2">
              <input
                type="file"
                multiple={kind === 'post'}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                onChange={handleFilesChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-10 h-10 rounded-2xl bg-card border border-border/80 flex items-center justify-center text-foreground shadow-2xs">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-bold text-foreground">Clique ou arraste as fotos/vídeos aqui</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {kind === 'post'
                    ? 'JPG, PNG ou WEBP em 4:5. Selecione várias imagens para carrossel.'
                    : 'MP4 ou MOV em 9:16 em alta resolução.'}
                </p>
              </div>
            </div>

            {/* Miniaturas de Slides de Carrossel */}
            {previewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {previewUrls.map((url, idx) => {
                  const isItemVideo = isVideo || Boolean(url.match(/\.(mp4|mov|webm)(\?.*)?$/i));
                  return (
                    <div
                      key={idx}
                      className="relative w-16 h-20 rounded-xl overflow-hidden border border-border/80 bg-accent/60 group shadow-2xs"
                    >
                      {isItemVideo ? (
                        <video src={url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                      )}
                      <span className="absolute bottom-1 left-1 text-[9px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-white hover:scale-110 transition-transform"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legenda & Copy com Contadores */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Legenda do Instagram</label>
              <span className="text-[10px] font-mono text-muted-foreground">
                {caption.length}/2.200 caracteres
              </span>
            </div>
            <Textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva a copy da postagem, chamadas de ação e hashtags..."
              className="rounded-2xl text-xs"
            />
          </div>

          {/* Colaboradores / Marcação (Opcional) */}
          {kind !== 'story' && (
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-semibold text-foreground">
                Colaboradores (até 3 perfis separados por vírgula)
              </label>
              <input
                type="text"
                value={collaboratorsInput}
                onChange={(e) => setCollaboratorsInput(e.target.value)}
                placeholder="ex: perfil1, perfil2"
                className="h-9 px-3.5 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none focus:border-foreground/40"
              />
            </div>
          )}

          {/* Modo de Publicação: Imediato vs. Agendado */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleEnabled(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !scheduleEnabled
                    ? 'bg-foreground text-background shadow-xs'
                    : 'bg-accent/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                Publicar Agora
              </button>
              <button
                type="button"
                onClick={() => setScheduleEnabled(true)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  scheduleEnabled
                    ? 'bg-foreground text-background shadow-xs'
                    : 'bg-accent/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Agendar Data & Horário
              </button>
            </div>

            {/* Agendador Inteligente com Horários de Pico */}
            {scheduleEnabled && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-accent/30 border border-border/70 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Escolha a Data e Horário</span>
                </div>
                <CalendarPicker value={scheduledAt} onChange={setScheduledAt} suggestions={suggestions} />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botão de Ação Principal */}
          <Button
            type="button"
            variant="lime"
            onClick={handleSubmit}
            loading={submitting}
            disabled={files.length === 0 || (scheduleEnabled && !scheduledAt)}
            className="w-full py-3.5 rounded-2xl text-xs font-bold shadow-xs text-foreground"
          >
            {!submitting && <Send className="w-4 h-4 mr-1.5" />}
            {scheduleEnabled ? 'Agendar Publicação Oficial' : 'Publicar Agora no Instagram'}
          </Button>
        </Card>

        {/* Lado Direito: Mockup de Celular Fiel ao Instagram (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-3 sticky top-20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold">Prévia Fiel no Aplicativo</span>
          </div>

          <InstagramPhoneMockup
            kind={kind}
            username={usernameLabel}
            previewUrls={previewUrls}
            isVideo={isVideo}
            isCarousel={isCarousel}
            caption={caption}
          />
        </div>
      </div>

      {/* 3. Lista e Histórico de Publicações Agendadas */}
      <Card padding="lg" className="rounded-3xl border border-border/80 bg-card shadow-2xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h4 className="font-bold font-display text-foreground text-base tracking-tight">
              Fila & Histórico de Publicações
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acompanhe o status de publicação, erros de entrega e métricas dos posts no ar
            </p>
          </div>

          {/* Filtros de Status */}
          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-2xl border border-border/70 self-start sm:self-auto text-xs">
            {[
              { id: 'all' as const, label: 'Todas' },
              { id: 'scheduled' as const, label: 'Agendadas' },
              { id: 'published' as const, label: 'Publicadas' },
              { id: 'failed' as const, label: 'Falhas' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFiltroStatus(st.id)}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  filtroStatus === st.id
                    ? 'bg-card text-foreground shadow-2xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {loadingPosts ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-accent/30 animate-pulse border border-border/60" />
            ))}
          </div>
        ) : postsFiltrados.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Nenhuma publicação encontrada nesta categoria."
            description="Agende ou publique conteúdos acima para acompanhar a esteira em tempo real."
          />
        ) : (
          <div className="flex flex-col divide-y divide-border/40">
            {postsFiltrados.map((post) => {
              const meta = STATUS_META[post.status];
              const StatusIcon = meta.icon;
              const isExpanded = expandedId === post.id;
              const isCarouselPost = post.media_type === 'CAROUSEL';

              return (
                <div key={post.id} className="py-3.5 flex flex-col gap-2 hover:bg-accent/25 transition-colors rounded-2xl px-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Thumbnail */}
                      <div className="relative w-12 h-14 rounded-xl overflow-hidden bg-accent shrink-0 border border-border/80">
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        {isCarouselPost && post.media_urls && (
                          <span className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] font-mono font-bold px-1 rounded-tl">
                            {post.media_urls.length}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate max-w-md">
                          {post.caption || '(sem legenda)'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {post.media_type} · {new Date(post.status === 'published' && post.published_at ? post.published_at : post.scheduled_at).toLocaleString('pt-BR')}
                        </p>
                        {post.status === 'failed' && post.error_message && (
                          <p className="text-[11px] text-destructive mt-0.5 font-medium">{post.error_message}</p>
                        )}
                      </div>
                    </div>

                    {/* Ações e Badges */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={meta.variant} className="text-[10px] font-bold">
                        <StatusIcon className={`w-3 h-3 ${post.status === 'publishing' ? 'animate-spin' : ''}`} />
                        {meta.label}
                      </Badge>

                      {post.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(post.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title="Cancelar agendamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {post.status === 'published' && post.ig_media_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : post.id)}
                          className="text-xs font-bold text-primary hover:text-primary/80"
                        >
                          <BarChart3 className="w-3.5 h-3.5 mr-1" />
                          {isExpanded ? 'Ocultar' : 'Métricas'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Seção de Métricas Expandida */}
                  {isExpanded && post.ig_media_id && (
                    <MetricsInline mediaId={post.ig_media_id} accountId={post.instagram_user_id} withAccount={withAccount} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
