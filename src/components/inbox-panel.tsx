'use client';

import React, { useEffect, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';

interface Conversation {
  contact_id: string;
  name: string | null;
  username: string | null;
  profile_picture_url: string | null;
  last_message: string | null;
  last_direction: 'inbound' | 'outbound';
  last_at: string;
  ai_modo?: 'ia' | 'humano' | null;
  negocio_id?: string | null;
}

interface Message {
  id: string;
  contact_id: string;
  direction: 'inbound' | 'outbound';
  text: string | null;
  created_at: string;
}

interface InboxPanelProps {
  withAccount: (url: string, accountIdOverride?: string | null) => string;
}

/** Inbox com atendimento humano (Onda 5) — lista de conversas reais + assumir
 * manualmente. Depende de `messages` gravar de verdade (Onda 0, item 1). */
export default function InboxPanel({ withAccount }: InboxPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const loadConversations = () => {
    setLoading(true);
    fetch(withAccount('/api/inbox'))
      .then((res) => res.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadThread = (contactId: string) => {
    fetch(withAccount(`/api/messages?contact_id=${contactId}`))
      .then((res) => res.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    if (!selectedId) return;
    loadThread(selectedId);
    const interval = setInterval(() => loadThread(selectedId), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSend = async () => {
    if (!selectedId || !input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(withAccount('/api/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: selectedId, text: input.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, data]);
        setInput('');
        loadConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((c) => c.contact_id === selectedId);

  if (loading) {
    return <SkeletonRows rows={5} className="p-4" />;
  }

  if (conversations.length === 0) {
    return <EmptyState icon={MessageCircle} title="Nenhuma conversa ainda" description="Conversas aparecem aqui assim que alguém interagir com o bot." />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[600px]">
      <Card padding="sm" className="rounded-2xl overflow-y-auto flex flex-col gap-1">
        {conversations.map((c) => (
          <button
            key={c.contact_id}
            onClick={() => setSelectedId(c.contact_id)}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors ${selectedId === c.contact_id ? 'bg-accent' : 'hover:bg-accent/50'}`}
          >
            {c.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL da Meta
              <img src={c.profile_picture_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                {(c.name || c.username || '?')[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-foreground truncate">{c.name || c.username || c.contact_id}</p>
                {c.ai_modo === 'ia' && (
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/15 text-primary shrink-0">🤖 IA</span>
                )}
                {c.ai_modo === 'humano' && (
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0">👤 Humano</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.last_direction === 'outbound' ? 'Você: ' : ''}{c.last_message || '—'}</p>
            </div>
          </button>
        ))}
      </Card>

      <Card padding="sm" className="rounded-2xl flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Selecione uma conversa</div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-foreground">{selected.name || selected.username || selected.contact_id}</span>
                {selected.username && <span className="text-xs text-muted-foreground ml-1.5 font-mono">@{selected.username}</span>}
              </div>

              {/* Controle de IA / Atendimento Humano */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const novoModo = selected.ai_modo === 'ia' ? 'humano' : 'ia';
                    try {
                      await fetch('/api/inbox/ai-toggle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contact_id: selected.contact_id, modo: novoModo }),
                      });
                      loadConversations();
                    } catch (err) {
                      console.error('Erro ao alternar IA:', err);
                    }
                  }}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                    selected.ai_modo === 'humano'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                  }`}
                >
                  <span>{selected.ai_modo === 'humano' ? '👤 Atendimento Humano (Clique para ativar IA)' : '🤖 IA Ativa (Clique para assumir)'}</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${m.direction === 'outbound' ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-accent text-accent-foreground'}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-2 border-t border-border">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Responder manualmente..."
                className="flex-1 bg-muted rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
              />
              <Button size="sm" onClick={handleSend} disabled={sending || !input.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
