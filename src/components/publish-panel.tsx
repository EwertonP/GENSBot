'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
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
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { fieldInputClass, fieldLabelClass } from '@/lib/form-styles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { CalendarPicker } from '@/components/ui/calendar-picker';
import type { PostingTimeSuggestion } from '@/lib/best-posting-time';
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
}

const STATUS_META: Record<ScheduledPost['status'], { label: string; icon: React.ElementType; variant: 'warning' | 'info' | 'success' | 'destructive' | 'muted' }> = {
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

function MetricsInline({ mediaId, accountId, withAccount }: { mediaId: string; accountId: string; withAccount: (url: string) => string }) {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(withAccount(`/api/instagram/media-insights?media_id=${mediaId}&account=${accountId}`))
      .then((res) => res.json())
      .then((data) => setMetrics(data.metrics || {}))
      .finally(() => setLoading(false));
  }, [mediaId, accountId]);

  if (loading) return <p className="text-[11px] text-muted-foreground mt-2">Carregando métricas...</p>;
  if (!metrics || Object.keys(metrics).length === 0) {
    return <p className="text-[11px] text-muted-foreground mt-2">Sem métricas disponíveis ainda para este post.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border">
      {Object.entries(metrics).map(([key, value]) => (
        <div key={key} className="text-[11px]">
          <span className="font-bold text-foreground tabular-nums">{value}</span>{' '}
          <span className="text-muted-foreground">{key}</span>
        </div>
      ))}
    </div>
  );
}

/** Preview fiel: moldura de post/carrossel/reels/story, atualiza ao vivo com o que o usuário está compondo. */
function LivePreview({
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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const currentIndex = Math.min(carouselIndex, Math.max(previewUrls.length - 1, 0));

  if (previewUrls.length === 0) {
    return (
      <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">
        A prévia aparece aqui
      </div>
    );
  }

  if (kind === 'story') {
    return (
      <div className="relative w-full max-w-[220px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black">
        <div className="absolute top-2 left-2 right-2 h-0.5 bg-white/30 rounded-full overflow-hidden z-10">
          <div className="h-full bg-white animate-[story-progress_15s_linear_infinite]" style={{ width: '100%' }} />
        </div>
        <div className="absolute top-4 left-3 flex items-center gap-1.5 z-10">
          <div className="w-6 h-6 rounded-full bg-white/80" />
          <span className="text-white text-[11px] font-bold drop-shadow">{username}</span>
        </div>
        {isVideo ? (
          <video src={previewUrls[0]} className="w-full h-full object-cover" muted autoPlay loop />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- preview local
          <img src={previewUrls[0]} alt="" className="w-full h-full object-cover" />
        )}
      </div>
    );
  }

  if (kind === 'reels') {
    return (
      <div className="relative w-full max-w-[220px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black">
        <video src={previewUrls[0]} className="w-full h-full object-cover" controls muted />
      </div>
    );
  }

  // Post / carrossel
  return (
    <div className="w-full max-w-[320px] mx-auto rounded-2xl overflow-hidden border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-7 h-7 rounded-full bg-accent shrink-0" />
        <span className="text-xs font-bold text-foreground">{username}</span>
      </div>
      {/* Feed (post/carrossel) usa 4:5, não mais 1:1 — o Instagram não exibe mais
          quadrado, e a prévia cortando errado escondia isso até a hora de publicar.
          Vídeo único de feed (não-carrossel) é publicado como REELS pela própria API
          (ver instagram-publish.ts), então a prévia dele já é 9:16 igual o Reels. */}
      <div className={`relative w-full bg-black ${isVideo && !isCarousel ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
        {isVideo ? (
          <video src={previewUrls[currentIndex]} className="w-full h-full object-cover" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- preview local
          <img src={previewUrls[currentIndex]} alt="" className="w-full h-full object-cover" />
        )}
        {previewUrls.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={() => setCarouselIndex(currentIndex - 1)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {currentIndex < previewUrls.length - 1 && (
              <button
                type="button"
                onClick={() => setCarouselIndex(currentIndex + 1)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {previewUrls.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentIndex ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 px-3 pt-2 text-foreground">
        <Heart className="w-5 h-5" />
        <MessageCircle className="w-5 h-5" />
      </div>
      {caption && <p className="px-3 py-2 text-xs text-foreground line-clamp-3">{caption}</p>}
    </div>
  );
}

export default function PublishPanel({ accounts, selectedAccountId, withAccount }: PublishPanelProps) {
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [kind, setKind] = useState<PostKind>('post');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [collaboratorsInput, setCollaboratorsInput] = useState('');
  const [userTagsInput, setUserTagsInput] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PostingTimeSuggestion[]>([]);

  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAccountId && selectedAccountId !== 'all') {
      setTargetAccount(selectedAccountId);
    } else if (accounts.length > 0) {
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
    const capped = kind === 'post' ? selected.slice(0, 10) : selected.slice(0, 1);
    setFiles(capped);
    setPreviewUrls(capped.map((f) => URL.createObjectURL(f)));
  };

  const isVideo = files[0]?.type.startsWith('video') ?? false;
  const isCarousel = kind === 'post' && files.length > 1;
  const usernameLabel = `@${accounts.find((a) => a.instagram_user_id === targetAccount)?.instagram_username || 'sua_conta'}`;

  const handleSubmit = async () => {
    if (files.length === 0 || !targetAccount) {
      setError('Selecione uma conta e ao menos um arquivo.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Upload direto pro Vercel Blob (multipart) — o corpo da requisição pra
      // função serverless da Vercel tem limite de ~4.5MB, então mandar o arquivo
      // (principalmente vídeo de Reels, até 1GB) via FormData pra nossa própria
      // API route batia nesse limite e voltava "Request Entity Too Large" (texto
      // puro, não JSON: daí o erro "Unexpected token 'R'..." ao dar JSON.parse).
      // `upload()` só usa a API route pra pegar um client token (payload
      // pequeno) e manda os bytes do arquivo direto pro Blob em partes.
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/instagram/upload-media',
          multipart: true,
        });
        uploadedUrls.push(blob.url);
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
        }),
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishData.error || 'Falha ao publicar.');

      setFiles([]);
      setPreviewUrls([]);
      setCaption('');
      setCollaboratorsInput('');
      setUserTagsInput('');
      setScheduleEnabled(false);
      setScheduledAt(null);
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    await fetch(withAccount(`/api/instagram/publish/${id}`), { method: 'DELETE' });
    loadPosts();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Composer em 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <Card className="flex flex-col gap-4">
          <Select label="Conta" value={targetAccount} onChange={(e) => setTargetAccount(e.target.value)}>
            {accounts.map((acc) => (
              <option key={acc.instagram_user_id} value={acc.instagram_user_id}>
                @{acc.instagram_username || acc.instagram_user_id}
              </option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelClass}>Tipo de publicação</label>
            <div className="flex gap-2">
              {([
                { id: 'post', label: 'Post' },
                { id: 'reels', label: 'Reels' },
                { id: 'story', label: 'Story' },
              ] as { id: PostKind; label: string }[]).map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  variant={kind === opt.id ? 'primary' : 'secondary'}
                  onClick={() => {
                    setKind(opt.id);
                    setFiles([]);
                    setPreviewUrls([]);
                  }}
                  className="rounded-xl"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelClass}>
              Mídia {kind === 'post' ? '(imagem/vídeo — selecione várias pra carrossel, até 10)' : '(imagem ou vídeo)'}
            </label>
            <input
              type="file"
              multiple={kind === 'post'}
              accept="image/jpeg,image/png,video/mp4,video/quicktime"
              onChange={handleFilesChange}
              className={fieldInputClass}
            />
            {isCarousel && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3" /> Carrossel com {files.length} itens
              </p>
            )}
          </div>

          <Textarea
            label="Legenda + hashtags"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escreva a legenda da publicação..."
          />

          {kind !== 'story' ? (
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabelClass}>Colaboradores (até 3, precisam aprovar no próprio Instagram)</label>
              <input
                type="text"
                className={fieldInputClass}
                placeholder="usuario1, usuario2"
                value={collaboratorsInput}
                onChange={(e) => setCollaboratorsInput(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabelClass}>Marcar pessoas (só marcação — sem link/localização/enquete em Story)</label>
              <input
                type="text"
                className={fieldInputClass}
                placeholder="usuario1, usuario2"
                value={userTagsInput}
                onChange={(e) => setUserTagsInput(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!scheduleEnabled ? 'primary' : 'secondary'}
                onClick={() => setScheduleEnabled(false)}
                className="rounded-xl"
              >
                Publicar agora
              </Button>
              <Button
                type="button"
                variant={scheduleEnabled ? 'primary' : 'secondary'}
                onClick={() => setScheduleEnabled(true)}
                className="rounded-xl"
              >
                Agendar
              </Button>
            </div>
            {scheduleEnabled && (
              <CalendarPicker value={scheduledAt} onChange={setScheduledAt} suggestions={suggestions} />
            )}
          </div>

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}

          <Button
            type="button"
            onClick={handleSubmit}
            loading={submitting}
            disabled={files.length === 0 || (scheduleEnabled && !scheduledAt)}
            className="self-start rounded-xl"
          >
            {!submitting && <Send className="w-4 h-4" />}
            {scheduleEnabled ? 'Agendar publicação' : 'Publicar agora'}
          </Button>
        </Card>

        <Card className="flex items-center justify-center bg-accent/40">
          <LivePreview kind={kind} username={usernameLabel} previewUrls={previewUrls} isVideo={isVideo} isCarousel={isCarousel} caption={caption} />
        </Card>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-3">
        {loadingPosts ? (
          <p className="text-xs text-muted-foreground">Carregando publicações...</p>
        ) : posts.length === 0 ? (
          <EmptyState icon={ImageIcon} title="Nenhuma publicação ainda." />
        ) : (
          posts.map((post) => {
            const meta = STATUS_META[post.status];
            const StatusIcon = meta.icon;
            const TypeIcon = post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL' ? ImageIcon : Video;
            const isExpanded = expandedId === post.id;
            return (
              <Card key={post.id} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border bg-accent flex items-center justify-center shrink-0">
                    {post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL do próprio Storage
                      <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <TypeIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                    {post.media_type === 'CAROUSEL' && post.media_urls && (
                      <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl">
                        {post.media_urls.length}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{post.caption || '(sem legenda)'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {post.media_type} · {new Date(post.status === 'published' && post.published_at ? post.published_at : post.scheduled_at).toLocaleString('pt-BR')}
                    </p>
                    {post.status === 'failed' && post.error_message && (
                      <p className="text-[11px] text-destructive mt-0.5">{post.error_message}</p>
                    )}
                  </div>
                  <Badge variant={meta.variant} className="shrink-0">
                    <StatusIcon className={`w-3 h-3 ${post.status === 'publishing' ? 'animate-spin' : ''}`} />
                    {meta.label}
                  </Badge>
                  {post.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(post.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      title="Cancelar publicação agendada"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {post.status === 'published' && post.ig_media_id && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : post.id)}
                      className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                      title="Ver métricas"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {isExpanded && post.ig_media_id && (
                  <MetricsInline mediaId={post.ig_media_id} accountId={post.instagram_user_id} withAccount={withAccount} />
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
