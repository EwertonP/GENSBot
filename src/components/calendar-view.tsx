'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CalendarPicker } from '@/components/ui/calendar-picker';
import { X } from 'lucide-react';

type ApprovalStatus = 'rascunho' | 'em_revisao' | 'aprovado' | 'agendado' | 'publicado' | 'rejeitado';

interface Post {
  id: string;
  instagram_user_id: string;
  media_type: string;
  media_url: string;
  caption: string | null;
  scheduled_at: string;
  approval_status: ApprovalStatus;
}

interface AccountOption {
  instagram_user_id: string;
  instagram_username: string | null;
}

interface CalendarViewProps {
  accounts: AccountOption[];
  selectedAccountId: string | null;
  withAccount: (url: string, accountIdOverride?: string | null) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const STATUS_DOT: Record<ApprovalStatus, string> = {
  rascunho: 'bg-muted-foreground',
  em_revisao: 'bg-warning',
  aprovado: 'bg-primary',
  agendado: 'bg-primary',
  publicado: 'bg-success',
  rejeitado: 'bg-destructive',
};

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(monthAnchor: Date): (Date | null)[] {
  const first = startOfMonth(monthAnchor);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const leadingBlanks = first.getDay();
  const cells: (Date | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  }
  return cells;
}

/** Visão mensal dos agendamentos — mesma fonte de dado do Kanban (scheduled_posts),
 * só que organizada por dia. Arrastar um card pra outro dia reagenda (PATCH scheduled_at). */
export default function CalendarView({ accounts, selectedAccountId, withAccount, showToast }: CalendarViewProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [draggingId, setDraggingId] = useState<string | null>(null);
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

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      const key = new Date(post.scheduled_at).toDateString();
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [posts]);

  const rescheduleTo = async (postId: string, day: Date) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const original = new Date(post.scheduled_at);
    const newDate = new Date(day);
    newDate.setHours(original.getHours(), original.getMinutes(), 0, 0);

    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, scheduled_at: newDate.toISOString() } : p)));
    try {
      const res = await fetch(withAccount(`/api/instagram/publish/${postId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: newDate.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reagendar.');
      setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
      showToast('Publicação reagendada.', 'success');
    } catch (err: any) {
      load();
      showToast(err.message || 'Erro ao reagendar.', 'error');
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

  const cells = buildMonthGrid(monthAnchor);
  const monthLabel = monthAnchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-12">Carregando calendário...</p>;
  }

  return (
    <>
      <Card padding="md" className="rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-accent">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-sm font-bold text-foreground capitalize">{monthLabel}</p>
          <button type="button" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-accent">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((w) => (
            <div key={w} className="text-center text-[10px] font-bold text-muted-foreground py-1">{w}</div>
          ))}
          {cells.map((day, i) => {
            const dayPosts = day ? postsByDay.get(day.toDateString()) || [] : [];
            const isToday = day && day.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={`min-h-[88px] rounded-lg border p-1.5 flex flex-col gap-1 ${day ? 'border-border' : 'border-transparent'} ${isToday ? 'bg-primary/5' : ''}`}
                onDragOver={(e) => day && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (day && draggingId) rescheduleTo(draggingId, day);
                }}
              >
                {day && <span className={`text-[10px] font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day.getDate()}</span>}
                {dayPosts.map((post) => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={() => setDraggingId(post.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => openEditor(post)}
                    className={`text-[9px] px-1.5 py-1 rounded-md bg-accent cursor-grab active:cursor-grabbing flex items-center gap-1 truncate ${draggingId === post.id ? 'opacity-40' : ''}`}
                    title={post.caption || undefined}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[post.approval_status]}`} />
                    {post.media_type === 'VIDEO' || post.media_type === 'REELS' ? <Video className="w-2.5 h-2.5 shrink-0" /> : null}
                    <span className="truncate">@{usernameFor(post.instagram_user_id)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

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
            <Button onClick={handleSaveEdit} disabled={saving}>Salvar</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
