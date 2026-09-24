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
  Zap,
  Bot,
  Link2,
  CornerDownRight,
  Check,
  MessageSquare,
  AlertTriangle,
  ArrowLeft,
  User,
  Pencil,
  Save,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { CalendarPicker } from '@/components/ui/calendar-picker';
import { Sheet } from '@/components/ui/sheet';
import type { PostingTimeSuggestion } from '@/lib/best-posting-time';
import type { PrefillAgendamento } from '@/lib/conteudo';
import { detectarGatilhosDaLegenda, type PublishAutomationConfig } from '@/lib/publish-automation';
import type { Automation } from '@/types/automation';
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
  automation_config?: PublishAutomationConfig | null;
  created_automation_id?: string | null;
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
  automationKeyword,
}: {
  kind: PostKind;
  username: string;
  previewUrls: string[];
  isVideo: boolean;
  isCarousel: boolean;
  caption: string;
  automationKeyword?: string | null;
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

        {/* Banner de Comentários / Automação no mockup */}
        {automationKeyword && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-md border border-primary/50 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-[10px] text-white">
              <Zap className="w-3 h-3 text-primary shrink-0" />
              <span>Comente <strong className="text-primary font-mono font-bold">"{automationKeyword}"</strong></span>
            </div>
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold font-mono">⚡ DM Ativa</span>
          </div>
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
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostScheduledAt, setEditingPostScheduledAt] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PostingTimeSuggestion[]>([]);

  const handleOpenConfirmation = () => {
    if ((files.length === 0 && prefillRemoteUrls.length === 0) || !targetAccount) {
      setError('Selecione uma conta e adicione pelo menos uma imagem ou vídeo.');
      return;
    }
    if (scheduleEnabled && !scheduledAt) {
      setError('Selecione a data e o horário para o agendamento.');
      return;
    }
    setError(null);
    setShowConfirmModal(true);
  };

  // Automação de Comentários (Direct Automático)
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoKeywords, setAutoKeywords] = useState('QUERO');
  const [autoMatchType, setAutoMatchType] = useState<'contains' | 'exact' | 'any'>('contains');
  const [autoWelcomeDm, setAutoWelcomeDm] = useState('');
  const [autoLinkUrl, setAutoLinkUrl] = useState('');
  const [autoLinkButtonLabel, setAutoLinkButtonLabel] = useState('');
  const [autoPublicReply, setAutoPublicReply] = useState('');
  const [autoDetectedPrompt, setAutoDetectedPrompt] = useState<{ keyword: string; dm: string; publicReply: string } | null>(null);

  // Automações Salvas da Biblioteca
  const [savedAutomations, setSavedAutomations] = useState<Automation[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string>('custom');
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  // Carrega automações salvas na biblioteca da conta atual
  useEffect(() => {
    if (!targetAccount) return;
    setLoadingAutomations(true);
    fetch(withAccount('/api/automations', targetAccount))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedAutomations(data);
      })
      .catch(() => setSavedAutomations([]))
      .finally(() => setLoadingAutomations(false));
  }, [targetAccount]);

  function handleSelectSavedAutomation(id: string) {
    setSelectedSavedId(id);
    if (id === 'custom') return;

    const aut = savedAutomations.find((a) => a.id === id);
    if (aut) {
      setAutoEnabled(true);
      const kw =
        Array.isArray(aut.keywords) && aut.keywords.length > 0
          ? aut.keywords.join(', ')
          : aut.triggers && aut.triggers.length > 0
          ? aut.triggers.join(', ')
          : 'QUERO';
      setAutoKeywords(kw);
      setAutoMatchType(aut.match_type || 'contains');
      setAutoWelcomeDm(aut.welcome_dm || '');
      setAutoLinkUrl(aut.link_url || '');
      setAutoLinkButtonLabel(aut.link_button_label || '');
      setAutoPublicReply(
        Array.isArray(aut.public_replies) && aut.public_replies.length > 0
          ? aut.public_replies[0]
          : ''
      );
    }
  }

  // Monitora a legenda para sugerir ativação inteligente de CTA (ex: "Comente QUERO")
  useEffect(() => {
    if (!caption) {
      setAutoDetectedPrompt(null);
      return;
    }
    const det = detectarGatilhosDaLegenda(caption);
    if (det.detected && det.keyword && !autoEnabled) {
      setAutoDetectedPrompt({
        keyword: det.keyword,
        dm: det.suggestedDm,
        publicReply: det.suggestedPublicReply,
      });
    } else {
      setAutoDetectedPrompt(null);
    }
  }, [caption, autoEnabled]);

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
    if (prefillData.automationConfig) {
      setAutoEnabled(prefillData.automationConfig.enabled);
      setAutoKeywords(prefillData.automationConfig.keywords?.join(', ') || 'QUERO');
      setAutoMatchType(prefillData.automationConfig.match_type || 'contains');
      setAutoWelcomeDm(prefillData.automationConfig.welcome_dm || '');
      setAutoLinkUrl(prefillData.automationConfig.link_url || '');
      setAutoLinkButtonLabel(prefillData.automationConfig.link_button_label || '');
      setAutoPublicReply(prefillData.automationConfig.public_replies?.[0] || '');
    }
  }, [prefillData, accounts]);

  // Lista de Publicações
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all');
  const [filaContaFiltro, setFilaContaFiltro] = useState<'target' | 'all'>('target');

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

  const loadPosts = (accOverride?: string, modoOverride?: 'target' | 'all') => {
    setLoadingPosts(true);
    const activeModo = modoOverride !== undefined ? modoOverride : filaContaFiltro;
    const activeAcc = activeModo === 'all' ? 'all' : (accOverride || targetAccount || selectedAccountId);
    fetch(withAccount('/api/instagram/publish', activeAcc))
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .finally(() => setLoadingPosts(false));
  };

  useEffect(() => {
    loadPosts(targetAccount, filaContaFiltro);
  }, [targetAccount, selectedAccountId, filaContaFiltro]);

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

      const automationPayload = autoEnabled
        ? {
            enabled: true,
            keywords: parseNameList(autoKeywords).length > 0 ? parseNameList(autoKeywords) : ['QUERO'],
            match_type: autoMatchType,
            welcome_dm: autoWelcomeDm.trim() || 'Olá! Vi que você comentou no nosso post. Aqui está o acesso exclusivo ao que prometemos:',
            link_button_label: autoLinkButtonLabel.trim() || null,
            link_url: autoLinkUrl.trim() || null,
            public_replies: autoPublicReply.trim() ? [autoPublicReply.trim()] : [],
          }
        : undefined;

      if (editingPostId) {
        const patchRes = await fetch(`/api/instagram/publish/${editingPostId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: mediaType,
            media_url: uploadedUrls[0],
            media_urls: mediaType === 'CAROUSEL' ? uploadedUrls : undefined,
            caption,
            collaborators: collaborators.length > 0 ? collaborators : undefined,
            user_tags: userTags.length > 0 ? userTags : undefined,
            scheduled_at: scheduleEnabled && scheduledAt ? scheduledAt.toISOString() : undefined,
            automation_config: automationPayload,
          }),
        });

        const patchData = await patchRes.json();
        if (!patchRes.ok) throw new Error(patchData.error || 'Falha ao atualizar agendamento.');
        setEditingPostId(null);
        setEditingPostScheduledAt(null);
      } else {
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
            automation_config: automationPayload,
          }),
        });

        const publishData = await publishRes.json();
        if (!publishRes.ok) throw new Error(publishData.error || 'Falha ao publicar ou agendar.');
      }

      if (autoEnabled && saveToLibrary && automationPayload) {
        fetch(withAccount('/api/automations', targetAccount), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Automação: ${automationPayload.keywords.join(', ')}`,
            keywords: automationPayload.keywords,
            match_type: automationPayload.match_type,
            welcome_dm: automationPayload.welcome_dm,
            link_url: automationPayload.link_url,
            link_button_label: automationPayload.link_button_label,
            public_replies: automationPayload.public_replies,
            status: 'active',
          }),
        }).catch(() => {});
      }

      setFiles([]);
      setPreviewUrls([]);
      setPrefillRemoteUrls([]);
      setCaption('');
      setCollaboratorsInput('');
      setUserTagsInput('');
      setScheduleEnabled(false);
      setScheduledAt(null);
      setEditingPostId(null);
      setEditingPostScheduledAt(null);
      setAutoEnabled(false);
      setAutoKeywords('QUERO');
      setAutoWelcomeDm('');
      setAutoLinkUrl('');
      setAutoLinkButtonLabel('');
      setAutoPublicReply('');
      onClearPrefill?.();
      setShowConfirmModal(false);
      loadPosts(targetAccount, filaContaFiltro);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (post: ScheduledPost) => {
    setEditingPostId(post.id);
    setEditingPostScheduledAt(post.scheduled_at);
    setTargetAccount(post.instagram_user_id);

    // Formato
    if (post.media_type === 'STORIES') setKind('story');
    else if (post.media_type === 'REELS') setKind('reels');
    else setKind('post');

    // Legenda
    setCaption(post.caption || '');

    // Mídias
    const remoteUrls = post.media_urls && post.media_urls.length > 0 ? post.media_urls : [post.media_url];
    const filteredUrls = remoteUrls.filter(Boolean);
    setPrefillRemoteUrls(filteredUrls);
    setPreviewUrls(filteredUrls);
    setFiles([]);

    // Data / Agendamento
    setScheduleEnabled(true);
    try {
      setScheduledAt(new Date(post.scheduled_at));
    } catch {
      setScheduledAt(new Date());
    }

    // Colaboradores e Tags
    const postCollabs = (post as any).collaborators;
    setCollaboratorsInput(Array.isArray(postCollabs) ? postCollabs.join(', ') : '');
    const postTags = (post as any).user_tags;
    setUserTagsInput(
      Array.isArray(postTags)
        ? postTags.map((t: any) => (typeof t === 'string' ? t : t.username)).join(', ')
        : ''
    );

    // Automação Direct
    if (post.automation_config?.enabled) {
      setAutoEnabled(true);
      setAutoKeywords(post.automation_config.keywords?.join(', ') || 'QUERO');
      setAutoMatchType(post.automation_config.match_type || 'contains');
      setAutoWelcomeDm(post.automation_config.welcome_dm || '');
      setAutoLinkUrl(post.automation_config.link_url || '');
      setAutoLinkButtonLabel(post.automation_config.link_button_label || '');
      setAutoPublicReply(post.automation_config.public_replies?.[0] || '');
    } else {
      setAutoEnabled(false);
    }

    setError(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditingPostScheduledAt(null);
    setFiles([]);
    setPreviewUrls([]);
    setPrefillRemoteUrls([]);
    setCaption('');
    setCollaboratorsInput('');
    setUserTagsInput('');
    setScheduleEnabled(false);
    setScheduledAt(null);
    setAutoEnabled(false);
    setError(null);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Deseja cancelar esta publicação agendada?')) return;
    if (editingPostId === id) {
      handleCancelEdit();
    }
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

          {/* Banner de Modo de Edição de Agendamento */}
          {editingPostId && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <Pencil className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground text-sm">
                      Modo de Edição de Agendamento
                    </p>
                    <Badge variant="warning" className="text-[10px] px-2 py-0.5 font-bold">
                      Em Edição
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Post agendado para{' '}
                    <span className="font-bold text-foreground font-mono">
                      {editingPostScheduledAt ? new Date(editingPostScheduledAt).toLocaleString('pt-BR') : 'Data futura'}
                    </span>
                    . Altere qualquer campo e clique em &quot;Salvar Alterações&quot;.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleCancelEdit}
                className="text-xs h-8.5 px-3 border-amber-500/40 text-foreground hover:bg-amber-500/15 shrink-0 cursor-pointer font-bold rounded-xl"
              >
                Cancelar Edição
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
                        ? 'bg-primary/20 text-primary border-primary/40 shadow-xs font-bold'
                        : 'bg-accent/40 text-foreground border-border/70 hover:bg-accent/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-bold">{opt.label}</span>
                    </div>
                    <span className={`text-[10px] ${active ? 'text-foreground/80 dark:text-muted-foreground' : 'text-muted-foreground'}`}>
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

          {/* Seção: Automação de Comentários (Direct Automático) */}
          {kind !== 'story' && (
            <div
              className={`p-4 rounded-2xl border transition-all ${
                autoEnabled
                  ? 'bg-accent/40 border-primary/40 shadow-xs'
                  : 'bg-card border-border/80 hover:border-foreground/20'
              }`}
            >
              {/* Header com Toggle Switch */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      autoEnabled ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        Automação de Comentários
                      </span>
                      <Badge variant={autoEnabled ? 'info' : 'muted'} className="text-[10px] px-1.5 py-0 font-bold">
                        {autoEnabled ? 'Ativada' : 'Opcional'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Envie uma DM instantânea com link ou material quando alguém comentar no post
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setAutoEnabled(!autoEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                  aria-label="Ativar automação de comentários"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-sm ring-1 ring-border transition duration-200 ease-in-out ${
                      autoEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sugestão Inteligente (quando o usuário não ativou mas escreveu 'Comente QUERO' na legenda) */}
              {!autoEnabled && autoDetectedPrompt && (
                <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-foreground">
                      Detectamos o gatilho <strong className="text-primary font-mono font-bold">"{autoDetectedPrompt.keyword}"</strong> na legenda!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoEnabled(true);
                      setAutoKeywords(autoDetectedPrompt.keyword);
                      setAutoWelcomeDm(autoDetectedPrompt.dm);
                      setAutoPublicReply(autoDetectedPrompt.publicReply);
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shrink-0 active:scale-[0.98]"
                  >
                    ⚡ Ativar em 1 Clique
                  </button>
                </div>
              )}

              {/* Campos da Automação (quando ativado) */}
              {autoEnabled && (
                <div className="mt-4 pt-4 border-t border-border/60 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150">
                  {/* Seletor de Automação Salva da Biblioteca */}
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-accent/30 border border-border/70">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Usar Automação Salva
                      </span>
                      {loadingAutomations && <span className="text-[10px] text-muted-foreground animate-pulse">Carregando...</span>}
                    </label>
                    <select
                      value={selectedSavedId}
                      onChange={(e) => handleSelectSavedAutomation(e.target.value)}
                      className="h-9 px-3 rounded-lg bg-card border border-border/80 text-xs text-foreground focus:outline-none focus:border-primary/60 cursor-pointer font-medium"
                    >
                      <option value="custom">✏️ Criar / Personalizar Regra para Este Post</option>
                      {savedAutomations.map((aut) => (
                        <option key={aut.id} value={aut.id}>
                          ⚡ {aut.name} ({aut.keywords.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Palavras-chave / Gatilhos */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span>Palavras-chave do Comentário</span>
                        <span className="text-[10px] text-muted-foreground font-normal">(separadas por vírgula)</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAutoMatchType('contains')}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                            autoMatchType === 'contains'
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Contém
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoMatchType('exact')}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                            autoMatchType === 'exact'
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Exata
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={autoKeywords}
                      onChange={(e) => setAutoKeywords(e.target.value)}
                      placeholder="QUERO, LINK, EU QUERO, VALOR"
                      className="h-9 px-3 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none focus:border-primary/60 font-mono"
                    />
                    {/* Chips rápidos */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Adicionar rápido:</span>
                      {['QUERO', 'LINK', 'EU QUERO', 'PREÇO', 'AULA', 'CHECKLIST'].map((chip) => {
                        const currentList = autoKeywords.split(',').map((k) => k.trim().toUpperCase());
                        const isSelected = currentList.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                const filtered = currentList.filter((k) => k !== chip);
                                setAutoKeywords(filtered.join(', '));
                              } else {
                                const updated = currentList.filter(Boolean);
                                updated.push(chip);
                                setAutoKeywords(updated.join(', '));
                              }
                            }}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary/20 border-primary text-primary font-bold'
                                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            +{chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mensagem no Direct (DM Privada) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      <span>Mensagem no Direct (DM Automática)</span>
                    </label>
                    <Textarea
                      rows={3}
                      value={autoWelcomeDm}
                      onChange={(e) => setAutoWelcomeDm(e.target.value)}
                      placeholder="Olá! Vi que você comentou no nosso post. Aqui está o acesso exclusivo ao que prometemos:"
                      className="rounded-xl text-xs bg-card"
                    />
                  </div>

                  {/* Botão com Link (Opcional) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        <span>URL do Botão (Link)</span>
                      </label>
                      <input
                        type="url"
                        value={autoLinkUrl}
                        onChange={(e) => setAutoLinkUrl(e.target.value)}
                        placeholder="https://seusite.com/conteudo"
                        className="h-8 px-2.5 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none focus:border-primary/60 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Texto do Botão
                      </label>
                      <input
                        type="text"
                        value={autoLinkButtonLabel}
                        onChange={(e) => setAutoLinkButtonLabel(e.target.value)}
                        placeholder="Acessar Conteúdo 🚀"
                        className="h-8 px-2.5 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none focus:border-primary/60"
                      />
                    </div>
                  </div>

                  {/* Resposta Pública no Comentário (Opcional) */}
                  <div className="flex flex-col gap-1 pt-1">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <CornerDownRight className="w-3 h-3 text-muted-foreground" />
                      <span>Resposta Pública no Comentário (Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={autoPublicReply}
                      onChange={(e) => setAutoPublicReply(e.target.value)}
                      placeholder="ex: Acabei de te enviar no Direct! 🚀 Confere lá."
                      className="h-8 px-2.5 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none focus:border-primary/60"
                    />
                  </div>

                  {/* Prévia do Funil */}
                  <div className="p-3 rounded-xl bg-accent/20 border border-border/50 text-[11px] text-muted-foreground flex flex-col gap-1.5">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                      Como vai funcionar:
                    </span>
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-foreground">1. Seguidor comenta:</span>
                      <code className="text-primary font-bold">"{autoKeywords || 'QUERO'}"</code>
                    </div>
                    {autoPublicReply && (
                      <div className="flex items-center gap-2 pl-2">
                        <span className="text-foreground">2. Resposta pública no post:</span>
                        <span className="italic text-foreground/80">"{autoPublicReply}"</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-foreground">3. Direct na hora:</span>
                      <span className="text-foreground/80 truncate max-w-xs">{autoWelcomeDm || 'Mensagem enviada com sucesso!'}</span>
                    </div>
                  </div>

                  {/* Opção para Salvar na Biblioteca Central */}
                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveToLibrary}
                      onChange={(e) => setSaveToLibrary(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-foreground font-medium">
                      Salvar também esta automação na biblioteca principal para uso em futuros posts
                    </span>
                  </label>
                </div>
              )}
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
            onClick={handleOpenConfirmation}
            loading={submitting}
            disabled={(files.length === 0 && prefillRemoteUrls.length === 0) || (scheduleEnabled && !scheduledAt)}
            className="w-full py-3.5 rounded-2xl text-xs font-bold shadow-xs text-neutral-950 dark:text-neutral-950 cursor-pointer"
          >
            {!submitting && (editingPostId ? <Save className="w-4 h-4 mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />)}
            {editingPostId
              ? 'Salvar Alterações do Agendamento'
              : scheduleEnabled
              ? 'Agendar Publicação Oficial'
              : 'Publicar Agora no Instagram'}
          </Button>
        </Card>

        {/* Modal / Dialog de Confirmação Obrigatória Antes de Enviar ao Instagram */}
        <Sheet
          open={showConfirmModal}
          onClose={() => !submitting && setShowConfirmModal(false)}
          aria-label="Confirmar envio de postagem"
          className="w-full max-w-lg p-0 overflow-hidden"
        >
          <div className="p-6 flex flex-col gap-5">
            {/* Header com Alerta de Segurança */}
            <div className="flex items-start gap-3.5 border-b border-border/60 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h4 className="text-base font-bold font-display text-foreground">
                  {editingPostId ? 'Confirmar Alterações de Agendamento' : 'Confirmação de Publicação'}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingPostId
                    ? 'Verifique as informações antes de salvar o agendamento atualizado.'
                    : 'Verifique a conta de destino e as informações antes de postar para evitar envios no perfil incorreto.'}
                </p>
              </div>
            </div>

            {/* Resumo da Publicação */}
            <div className="flex flex-col gap-3">
              {/* 1. Conta Selecionada (Destaque Principal) */}
              <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary/40 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#d8ff3c] via-[#55703a] to-[#192313] p-0.5 shrink-0">
                    <div className="w-full h-full rounded-full bg-card flex items-center justify-center font-bold text-xs text-foreground uppercase">
                      {(accounts.find((a) => a.instagram_user_id === targetAccount)?.instagram_username || 'G')[0]}
                    </div>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Conta do Cliente (Destino)
                    </span>
                    <span className="text-sm font-extrabold text-foreground truncate">
                      @{accounts.find((a) => a.instagram_user_id === targetAccount)?.instagram_username || targetAccount}
                    </span>
                  </div>
                </div>
                <Badge variant="warning" className="text-[10px] px-2 py-0.5 font-bold shrink-0">
                  ⚠️ Confirmar Perfil
                </Badge>
              </div>

              {/* 2. Grid Formato + Data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tipo de Conteúdo
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {kind === 'story'
                      ? 'Story (24h)'
                      : kind === 'reels'
                      ? 'Reels (Vídeo 9:16)'
                      : isCarousel
                      ? `Carrossel (${previewUrls.length} mídias)`
                      : isVideo
                      ? 'Vídeo Feed 4:5'
                      : 'Imagem Única Feed'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Data da Postagem
                  </span>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {scheduleEnabled ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">
                          {scheduledAt
                            ? new Intl.DateTimeFormat('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).format(scheduledAt)
                            : 'Horário agendado'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Imediato (Agora)</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* 3. Prévia da Mídia & Legenda */}
              <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/60 flex items-start gap-3">
                {previewUrls[0] && (
                  <div className="w-12 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-border/80">
                    {isVideo ? (
                      <video src={previewUrls[0]} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={previewUrls[0]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Legenda
                  </span>
                  <p className="text-xs text-foreground/90 line-clamp-2 mt-0.5">
                    {caption ? caption : <span className="italic text-muted-foreground">(Sem legenda)</span>}
                  </p>
                  {autoEnabled && (
                    <span className="text-[10px] text-primary font-bold mt-1 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Direct Automático Ativo ({autoKeywords})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 text-xs font-bold text-muted-foreground hover:text-foreground h-11 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Voltar e Alterar
              </Button>
              <Button
                type="button"
                variant="lime"
                loading={submitting}
                onClick={handleSubmit}
                className="flex-1 text-xs font-bold text-neutral-950 dark:text-neutral-950 h-11 shadow-md cursor-pointer"
              >
                {!submitting && <Check className="w-4 h-4 mr-1.5" />}
                {editingPostId
                  ? 'Confirmar e Salvar Alterações'
                  : scheduleEnabled
                  ? 'Confirmar e Agendar'
                  : 'Confirmar e Publicar'}
              </Button>
            </div>
          </div>
        </Sheet>

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
            automationKeyword={autoEnabled ? (autoKeywords.split(',')[0]?.trim() || 'QUERO') : null}
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

          {/* Filtros de Escopo de Conta e Status */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
            {/* Seletor de Escopo de Conta */}
            <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-2xl border border-border/70">
              <button
                type="button"
                onClick={() => setFilaContaFiltro('target')}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  filaContaFiltro === 'target'
                    ? 'bg-card text-foreground shadow-2xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                @{accounts.find((a) => a.instagram_user_id === targetAccount)?.instagram_username || 'Conta Ativa'}
              </button>
              <button
                type="button"
                onClick={() => setFilaContaFiltro('all')}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  filaContaFiltro === 'all'
                    ? 'bg-card text-foreground shadow-2xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todas as Contas
              </button>
            </div>

            {/* Filtros de Status */}
            <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-2xl border border-border/70">
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
              const isScheduled = post.status === 'scheduled';
              const isEditingThis = editingPostId === post.id;

              return (
                <div
                  key={post.id}
                  className={`py-3.5 flex flex-col gap-2 transition-all rounded-2xl px-3 ${
                    isEditingThis
                      ? 'bg-amber-500/10 border-2 border-amber-500/50 shadow-xs ring-1 ring-amber-500/20'
                      : 'hover:bg-accent/25 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div
                      onClick={() => isScheduled && handleStartEdit(post)}
                      className={`flex items-center gap-3.5 min-w-0 ${isScheduled ? 'cursor-pointer group' : ''}`}
                      title={isScheduled ? 'Clique para editar esta publicação no simulador' : undefined}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-12 h-14 rounded-xl overflow-hidden bg-accent shrink-0 border border-border/80 group-hover:border-foreground/40 transition-colors">
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        {isCarouselPost && post.media_urls && (
                          <span className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] font-mono font-bold px-1 rounded-tl">
                            {post.media_urls.length}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold bg-accent text-foreground px-2 py-0.5 rounded-md border border-border/60 shrink-0">
                            @{accounts.find((a) => a.instagram_user_id === post.instagram_user_id)?.instagram_username || 'instagram'}
                          </span>
                          <p className="text-xs font-bold text-foreground truncate max-w-md group-hover:text-primary transition-colors">
                            {post.caption || '(sem legenda)'}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {post.media_type} · {new Date(post.status === 'published' && post.published_at ? post.published_at : post.scheduled_at).toLocaleString('pt-BR')}
                        </p>
                        {post.status === 'failed' && post.error_message && (
                          <p className="text-[11px] text-destructive mt-0.5 font-medium">{post.error_message}</p>
                        )}
                        {post.automation_config?.enabled && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="info" className="text-[10px] px-2 py-0 font-bold flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              <span>Gatilho: {(post.automation_config.keywords || ['QUERO']).join(', ')}</span>
                            </Badge>
                            {post.created_automation_id ? (
                              <span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Direct Ativo
                              </span>
                            ) : post.status === 'scheduled' ? (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> Ativa ao publicar
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações e Badges */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <Badge variant={meta.variant} className="text-[10px] font-bold">
                        <StatusIcon className={`w-3 h-3 ${post.status === 'publishing' ? 'animate-spin' : ''}`} />
                        {meta.label}
                      </Badge>

                      {isScheduled && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(post)}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98] ${
                            isEditingThis
                              ? 'bg-amber-400 text-amber-950 border-amber-500/40 shadow-xs'
                              : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 hover:border-primary/50'
                          }`}
                          title="Editar publicação no simulador"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>{isEditingThis ? 'Editando' : 'Editar'}</span>
                        </button>
                      )}

                      {isScheduled && (
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
