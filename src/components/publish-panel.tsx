'use client';

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Video, Send, Clock, CheckCircle2, XCircle, Loader2, Trash2, BarChart3 } from 'lucide-react';
import { fieldInputClass, fieldLabelClass } from '@/lib/form-styles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';

type MediaType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES';
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

const KIND_TO_MEDIA_TYPE: Record<PostKind, (isVideo: boolean) => MediaType> = {
  post: (isVideo) => (isVideo ? 'VIDEO' : 'IMAGE'),
  reels: () => 'REELS',
  story: (isVideo) => (isVideo ? 'STORIES' : 'STORIES'),
};

const STATUS_META: Record<ScheduledPost['status'], { label: string; icon: React.ElementType; variant: 'warning' | 'info' | 'success' | 'destructive' | 'muted' }> = {
  scheduled: { label: 'Agendado', icon: Clock, variant: 'warning' },
  publishing: { label: 'Publicando...', icon: Loader2, variant: 'info' },
  published: { label: 'Publicado', icon: CheckCircle2, variant: 'success' },
  failed: { label: 'Falhou', icon: XCircle, variant: 'destructive' },
  canceled: { label: 'Cancelado', icon: XCircle, variant: 'muted' },
};

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

export default function PublishPanel({ accounts, selectedAccountId, withAccount }: PublishPanelProps) {
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [kind, setKind] = useState<PostKind>('post');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  };

  const handleSubmit = async () => {
    if (!file || !targetAccount) {
      setError('Selecione uma conta e um arquivo.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/instagram/upload-media', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Falha no upload da mídia.');

      const isVideo = file.type.startsWith('video');
      const mediaType = KIND_TO_MEDIA_TYPE[kind](isVideo);

      const publishRes = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_user_id: targetAccount,
          media_type: mediaType,
          media_url: uploadData.url,
          caption,
          scheduled_at: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishData.error || 'Falha ao publicar.');

      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setScheduleEnabled(false);
      setScheduledAt('');
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
      {/* Composer */}
      <Card className="flex flex-col gap-4">
        {accounts.length > 1 && (
          <Select label="Conta" value={targetAccount} onChange={(e) => setTargetAccount(e.target.value)}>
            {accounts.map((acc) => (
              <option key={acc.instagram_user_id} value={acc.instagram_user_id}>
                @{acc.instagram_username || acc.instagram_user_id}
              </option>
            ))}
          </Select>
        )}

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
                onClick={() => setKind(opt.id)}
                className="rounded-xl"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={fieldLabelClass}>Mídia (imagem JPG/PNG ou vídeo MP4)</label>
          <input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" onChange={handleFileChange} className={fieldInputClass} />
          {previewUrl && (
            <div className="mt-2 w-32 h-32 rounded-lg overflow-hidden border border-border bg-accent flex items-center justify-center">
              {file?.type.startsWith('video') ? (
                <video src={previewUrl} className="w-full h-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- preview local, não é URL da Meta
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>

        <Textarea
          label="Legenda"
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Escreva a legenda da publicação..."
        />

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground cursor-pointer">
            <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
            Agendar para depois
          </label>
          {scheduleEnabled && (
            <input
              type="datetime-local"
              className={fieldInputClass}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          )}
        </div>

        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

        <Button type="button" onClick={handleSubmit} loading={submitting} disabled={!file} className="self-start rounded-xl">
          {!submitting && <Send className="w-4 h-4" />}
          {scheduleEnabled ? 'Agendar publicação' : 'Publicar agora'}
        </Button>
      </Card>

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
            const TypeIcon = post.media_type === 'IMAGE' ? ImageIcon : Video;
            const isExpanded = expandedId === post.id;
            return (
              <Card key={post.id} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-accent flex items-center justify-center shrink-0">
                    {post.media_type === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL do próprio Storage
                      <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <TypeIcon className="w-5 h-5 text-muted-foreground" />
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
