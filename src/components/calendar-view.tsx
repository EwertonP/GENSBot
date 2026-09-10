'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video, X } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CalendarPicker } from '@/components/ui/calendar-picker';

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

// Cor por status (não por tipo de mídia) — verde continua exclusivo de ação/
// estado ativo (Etapa A/B do reskin); tipo de post é indicado só por ícone.
const STATUS_CHIP: Record<ApprovalStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground border-l-muted-foreground',
  em_revisao: 'bg-warning/10 text-warning-foreground border-l-warning',
  aprovado: 'bg-primary/10 text-primary border-l-primary',
  agendado: 'bg-primary/10 text-primary border-l-primary',
  publicado: 'bg-success/10 text-success border-l-success',
  rejeitado: 'bg-destructive/10 text-destructive border-l-destructive',
};

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_VISIBLE_PER_DAY = 3;

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

function EventChip({ post, usernameFor, onClick }: { post: Post; usernameFor: (id: string) => string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`text-xs px-2 py-1.5 rounded-md border-l-2 cursor-grab active:cursor-grabbing flex items-center gap-1.5 truncate transition-transform hover:scale-[1.03] ${STATUS_CHIP[post.approval_status]}`}
      title={post.caption || undefined}
    >
      {post.media_type === 'VIDEO' || post.media_type === 'REELS' ? <Video className="w-3 h-3 shrink-0" /> : null}
      <span className="truncate font-medium">@{usernameFor(post.instagram_user_id)}</span>
    </div>
  );
}

function DraggableChip({ post, usernameFor, onClick }: { post: Post; usernameFor: (id: string) => string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ transform: CSS.Translate.toString(transform) }} className={`touch-none ${isDragging ? 'opacity-30' : ''}`}>
      <EventChip post={post} usernameFor={usernameFor} onClick={onClick} />
    </div>
  );
}

function DayCell({ day, dayPosts, isToday, usernameFor, onOpenPost }: { day: Date | null; dayPosts: Post[]; isToday: boolean; usernameFor: (id: string) => string; onOpenPost: (p: Post) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: day ? day.toDateString() : `empty` , disabled: !day });
  const visible = dayPosts.slice(0, MAX_VISIBLE_PER_DAY);
  const hiddenCount = dayPosts.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[104px] rounded-xl p-2 flex flex-col gap-1.5 transition-colors ${day ? 'hover:bg-accent/40' : ''} ${isOver ? 'bg-primary/5 ring-1 ring-primary/30' : ''}`}
    >
      {day && (
        <span
          className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
            isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
        >
          {day.getDate()}
        </span>
      )}
      {visible.map((post) => (
        <DraggableChip key={post.id} post={post} usernameFor={usernameFor} onClick={() => onOpenPost(post)} />
      ))}
      {hiddenCount > 0 && <span className="text-xs text-muted-foreground px-2">+{hiddenCount} mais</span>}
    </div>
  );
}

/** Visão mensal dos agendamentos — mesma fonte de dado do Kanban (scheduled_posts),
 * só que organizada por dia. Arrastar um card pra outro dia reagenda (PATCH scheduled_at).
 * Reskin Etapa D (Cron/Notion Calendar): dnd-kit no lugar do drag nativo (suporte a
 * touch + ghost card), células com mais respiro, destaque de "hoje" mais forte. */
export default function CalendarView({ accounts, selectedAccountId, withAccount, showToast }: CalendarViewProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  const activePost = activeId ? posts.find((p) => p.id === activeId) || null : null;

  const rescheduleTo = async (postId: string, dayKey: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const day = new Date(dayKey);
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

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    rescheduleTo(String(active.id), String(over.id));
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
          <button type="button" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-sm font-bold text-foreground capitalize">{monthLabel}</p>
          <button type="button" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w} className="text-center text-xs font-bold text-muted-foreground py-1">{w}</div>
            ))}
            {cells.map((day, i) => {
              const dayPosts = day ? postsByDay.get(day.toDateString()) || [] : [];
              const isToday = !!day && day.toDateString() === new Date().toDateString();
              return <DayCell key={i} day={day} dayPosts={dayPosts} isToday={isToday} usernameFor={usernameFor} onOpenPost={openEditor} />;
            })}
          </div>
          <DragOverlay>{activePost ? <EventChip post={activePost} usernameFor={usernameFor} onClick={() => {}} /> : null}</DragOverlay>
        </DndContext>
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
