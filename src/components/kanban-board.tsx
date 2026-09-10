'use client';

import React, { useEffect, useState } from 'react';
import { Video, Calendar, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPicker } from '@/components/ui/calendar-picker';
import { EmptyState } from '@/components/ui/empty-state';

type ApprovalStatus = 'rascunho' | 'em_revisao' | 'aprovado' | 'agendado' | 'publicado' | 'rejeitado';

interface Post {
  id: string;
  instagram_user_id: string;
  media_type: string;
  media_url: string;
  caption: string | null;
  scheduled_at: string;
  status: string;
  approval_status: ApprovalStatus;
  error_message: string | null;
}

interface AccountOption {
  instagram_user_id: string;
  instagram_username: string | null;
}

const COLUMNS: { id: ApprovalStatus; label: string }[] = [
  { id: 'rascunho', label: 'Rascunho' },
  { id: 'em_revisao', label: 'Em revisão' },
  { id: 'aprovado', label: 'Aprovado' },
  { id: 'agendado', label: 'Agendado' },
  { id: 'publicado', label: 'Publicado' },
];

interface KanbanBoardProps {
  accounts: AccountOption[];
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

/** Board de aprovação — uso interno da equipe nesta fase (Onda 1), sem acesso do cliente ainda.
 * Colunas mapeiam pra `scheduled_posts.approval_status`; mover pra "Aprovado" sem data já
 * agendada dispara o agendamento automático no servidor (ver api/instagram/publish/[id]). */
export default function KanbanBoard({ accounts, selectedAccountId, withAccount, showToast }: KanbanBoardProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ApprovalStatus | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(withAccount('/api/instagram/publish'))
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data.filter((p: Post) => p.approval_status !== 'rejeitado') : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const usernameFor = (igUserId: string) => accounts.find((a) => a.instagram_user_id === igUserId)?.instagram_username || igUserId;

  const moveCard = async (postId: string, target: ApprovalStatus) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || post.approval_status === target) return;

    // Otimista: atualiza local já, corrige depois se o servidor recalcular (ex: auto-agendamento).
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, approval_status: target } : p)));

    try {
      const res = await fetch(withAccount(`/api/instagram/publish/${postId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao mover o card.');
      setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
      if (target === 'aprovado' && data.approval_status === 'agendado') {
        showToast(`Aprovado e agendado automaticamente para ${new Date(data.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`, 'success');
      }
    } catch (err: any) {
      load();
      showToast(err.message || 'Erro ao mover o card.', 'error');
    }
  };

  const openEditor = (post: Post) => {
    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditDate(new Date(post.scheduled_at));
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setSaving(true);
    try {
      const res = await fetch(withAccount(`/api/instagram/publish/${editingPost.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: editCaption, scheduled_at: editDate?.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
      setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? data : p)));
      setEditingPost(null);
      showToast('Publicação atualizada.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!editingPost) return;
    if (!confirm('Rejeitar esta publicação? Ela sai do board.')) return;
    setSaving(true);
    try {
      const res = await fetch(withAccount(`/api/instagram/publish/${editingPost.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: 'rejeitado' }),
      });
      if (!res.ok) throw new Error('Erro ao rejeitar.');
      setPosts((prev) => prev.filter((p) => p.id !== editingPost.id));
      setEditingPost(null);
      showToast('Publicação rejeitada.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao rejeitar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!editingPost) return;
    if (!confirm('Cancelar esta publicação agendada?')) return;
    setSaving(true);
    try {
      const res = await fetch(withAccount(`/api/instagram/publish/${editingPost.id}`), { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar.');
      setPosts((prev) => prev.filter((p) => p.id !== editingPost.id));
      setEditingPost(null);
      showToast('Publicação cancelada.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao cancelar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-12">Carregando board...</p>;
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Nada no board ainda"
        description="Publicações criadas na aba Publicações aparecem aqui pra revisão e aprovação da equipe."
      />
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cardsInColumn = posts.filter((p) => p.approval_status === col.id);
          return (
            <div
              key={col.id}
              className={`flex-shrink-0 w-64 rounded-2xl transition-colors ${dragOverColumn === col.id ? 'bg-primary/5' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(col.id);
              }}
              onDragLeave={() => setDragOverColumn((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColumn(null);
                if (draggingId) moveCard(draggingId, col.id);
              }}
            >
              <div className="flex items-center justify-between px-2 pb-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">{col.label}</h4>
                <Badge variant="muted">{cardsInColumn.length}</Badge>
              </div>
              <div className="flex flex-col gap-2 min-h-[80px]">
                {cardsInColumn.map((post) => (
                  <Card
                    key={post.id}
                    padding="sm"
                    draggable
                    onDragStart={() => setDraggingId(post.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => openEditor(post)}
                    className={`rounded-xl cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${draggingId === post.id ? 'opacity-40' : ''}`}
                  >
                    <div className="flex gap-2">
                      <div className="w-12 h-12 rounded-lg bg-accent shrink-0 overflow-hidden flex items-center justify-center">
                        {post.media_type === 'VIDEO' || post.media_type === 'REELS' ? (
                          <Video className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- thumbnail de card, não precisa de otimização do Next
                          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">@{usernameFor(post.instagram_user_id)}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{post.caption || 'Sem legenda'}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!editingPost} onClose={() => setEditingPost(null)} aria-label="Editar publicação" className="w-full max-w-md">
        {editingPost && (
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Editar publicação</h3>
              <button onClick={() => setEditingPost(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} rows={4} placeholder="Legenda" />
            <CalendarPicker value={editDate} onChange={setEditDate} />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveEdit} disabled={saving} className="flex-1">Salvar</Button>
              <Button variant="secondary" onClick={handleReject} disabled={saving}>Rejeitar</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={saving} title="Cancelar publicação agendada">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
