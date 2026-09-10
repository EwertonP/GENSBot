'use client';

import React, { useEffect, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface Conversation {
  contact_id: string;
  name: string | null;
  username: string | null;
  profile_picture_url: string | null;
  last_message: string | null;
  last_direction: 'inbound' | 'outbound';
  last_at: string;
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
    return <p className="text-sm text-muted-foreground text-center py-12">Carregando conversas...</p>;
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
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                {(c.name || c.username || '?')[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{c.name || c.username || c.contact_id}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.last_direction === 'outbound' ? 'Você: ' : ''}{c.last_message || '—'}</p>
            </div>
          </button>
        ))}
      </Card>

      <Card padding="sm" className="rounded-2xl flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Selecione uma conversa</div>
        ) : (
          <>
            <div className="px-2 py-2 border-b border-border font-bold text-sm text-foreground">{selected.name || selected.username || selected.contact_id}</div>
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
