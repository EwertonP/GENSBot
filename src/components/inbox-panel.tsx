'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Send,
  MessageCircle,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Phone,
  Tag,
  Kanban,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Instagram } from '@/components/instagram-icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tip } from '@/components/ui/tooltip';
import type { ConversaUnificada } from '@/app/api/inbox/route';

interface MessageItem {
  id: string;
  conteudo: string;
  de_mim: boolean;
  timestamp: string;
}

interface CrmPipelineInfo {
  id: string;
  nome: string;
  estagios: { id: string; nome: string; cor?: string }[];
}

interface InboxPanelProps {
  withAccount: (url: string, accountIdOverride?: string | null) => string;
  clienteId?: string | null;
  papelUsuario?: 'admin' | 'membro' | 'cliente' | null;
}

export default function InboxPanel({ withAccount, clienteId, papelUsuario }: InboxPanelProps) {
  const [conversations, setConversations] = useState<ConversaUnificada[]>([]);
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [selectedConv, setSelectedConv] = useState<ConversaUnificada | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Filtros de canal
  const [canalFiltro, setCanalFiltro] = useState<'todos' | 'instagram' | 'whatsapp'>('todos');
  const [termoBusca, setTermoBusca] = useState('');

  // Sessão de WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState<string>('desconectado');
  const [qrCodeModal, setQrCodeModal] = useState<string | null>(null);
  const [gerandoQrCode, setGerandoQrCode] = useState(false);

  // Pipelines & Estágios do CRM para troca de etapa rápida
  const [pipelines, setPipelines] = useState<CrmPipelineInfo[]>([]);
  const [movendoEstagio, setMovendoEstagio] = useState(false);

  // 1. Carrega status da sessão de WhatsApp
  const carregarStatusWhatsApp = async () => {
    try {
      const url = clienteId ? `/api/whatsapp/session?cliente_id=${encodeURIComponent(clienteId)}` : '/api/whatsapp/session';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data.session?.status || 'desconectado');
      }
    } catch (err) {
      console.warn('Erro ao carregar status do WhatsApp:', err);
    }
  };

  // 2. Carrega pipelines para seleção rápida de estágio
  const carregarPipelines = async () => {
    try {
      const url = clienteId ? `/api/crm/pipelines?cliente_id=${encodeURIComponent(clienteId)}` : '/api/crm/pipelines';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPipelines(Array.isArray(data) ? data : data.pipelines || []);
      }
    } catch (err) {
      console.warn('Erro ao carregar pipelines do CRM:', err);
    }
  };

  // 3. Carrega lista unificada de conversas
  const loadConversations = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    else setRecarregando(true);

    try {
      const params = new URLSearchParams();
      if (canalFiltro !== 'todos') params.set('canal', canalFiltro);
      if (clienteId) params.set('cliente_id', clienteId);

      const url = withAccount(`/api/inbox?${params.toString()}`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const lista: ConversaUnificada[] = Array.isArray(data) ? data : [];
        setConversations(lista);

        // Atualiza a conversa selecionada se já houver uma ativa
        if (selectedConv) {
          const atualizada = lista.find((c) => c.id === selectedConv.id);
          if (atualizada) setSelectedConv(atualizada);
        }
      }
    } finally {
      setLoading(false);
      setRecarregando(false);
    }
  };

  useEffect(() => {
    loadConversations();
    carregarStatusWhatsApp();
    carregarPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalFiltro, clienteId]);

  // 4. Carrega histórico de mensagens da conversa selecionada
  const loadThread = async (conv: ConversaUnificada) => {
    setLoadingMessages(true);
    try {
      if (conv.canal === 'instagram') {
        const res = await fetch(withAccount(`/api/messages?contact_id=${conv.contato_id}`));
        if (res.ok) {
          const data = await res.json();
          const msgs: MessageItem[] = (Array.isArray(data) ? data : []).map((m: any) => ({
            id: m.id,
            conteudo: m.text || '',
            de_mim: m.direction === 'outbound',
            timestamp: m.created_at,
          }));
          setMessages(msgs);
        }
      } else {
        const res = await fetch(`/api/whatsapp/messages?telefone=${encodeURIComponent(conv.contato_id)}${clienteId ? `&cliente_id=${encodeURIComponent(clienteId)}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          const msgs: MessageItem[] = (Array.isArray(data) ? data : []).map((m: any) => ({
            id: m.id || m.message_id,
            conteudo: m.conteudo || '',
            de_mim: Boolean(m.de_mim),
            timestamp: m.timestamp_msg,
          }));
          setMessages(msgs);
        }
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedConv) return;
    loadThread(selectedConv);
    const interval = setInterval(() => loadThread(selectedConv), 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConv?.id]);

  // 5. Envio de mensagem manual
  const handleSend = async () => {
    if (!selectedConv || !input.trim() || sending) return;
    setSending(true);
    const texto = input.trim();

    try {
      if (selectedConv.canal === 'instagram') {
        const res = await fetch(withAccount('/api/messages'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: selectedConv.contato_id, text: texto }),
        });
        if (res.ok) {
          setInput('');
          loadThread(selectedConv);
          loadConversations(true);
        }
      } else {
        const res = await fetch('/api/whatsapp/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefone: selectedConv.contato_id,
            texto,
            cliente_id: clienteId,
          }),
        });
        if (res.ok) {
          setInput('');
          loadThread(selectedConv);
          loadConversations(true);
        }
      }
    } finally {
      setSending(false);
    }
  };

  // 6. Gerar QR Code do WhatsApp
  const handleGerarQrCode = async () => {
    setGerandoQrCode(true);
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId }),
      });
      const data = await res.json();
      if (data.qrCode) {
        setQrCodeModal(data.qrCode);
      }
      carregarStatusWhatsApp();
    } finally {
      setGerandoQrCode(false);
    }
  };

  // 7. Alternar modo de IA no contato do Instagram
  const handleToggleAiContato = async () => {
    if (!selectedConv || selectedConv.canal !== 'instagram') return;
    const novoModo = selectedConv.ai_modo === 'ia' ? 'humano' : 'ia';
    try {
      await fetch('/api/inbox/ai-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedConv.contato_id,
          modo: novoModo,
        }),
      });
      setSelectedConv((prev) => (prev ? { ...prev, ai_modo: novoModo } : null));
      loadConversations(true);
    } catch (err) {
      console.error('Erro ao alternar IA do contato:', err);
    }
  };

  // 8. Mover negócio de estágio diretamente do painel lateral
  const handleMoverEstagio = async (novoEstagioId: string) => {
    if (!selectedConv?.negocio_id || movendoEstagio) return;
    setMovendoEstagio(true);
    try {
      const res = await fetch(`/api/crm/negocios/${selectedConv.negocio_id}/mover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estagio_id: novoEstagioId }),
      });
      if (res.ok) {
        const todosEstagios = pipelines.flatMap((p) => p.estagios);
        const estagioAlvo = todosEstagios.find((e) => e.id === novoEstagioId);
        setSelectedConv((prev) =>
          prev
            ? {
                ...prev,
                negocio_estagio_id: novoEstagioId,
                negocio_estagio_nome: estagioAlvo?.nome || prev.negocio_estagio_nome,
              }
            : null
        );
        loadConversations(true);
      }
    } finally {
      setMovendoEstagio(false);
    }
  };

  // Filtragem da lista
  const conversasFiltradas = useMemo(() => {
    return conversations.filter((c) => {
      if (canalFiltro !== 'todos' && c.canal !== canalFiltro) return false;
      if (termoBusca.trim()) {
        const busca = termoBusca.toLowerCase();
        const nomeMatch = c.nome?.toLowerCase().includes(busca);
        const userMatch = c.username?.toLowerCase().includes(busca);
        const telMatch = c.telefone?.includes(busca);
        return nomeMatch || userMatch || telMatch;
      }
      return true;
    });
  }, [conversations, canalFiltro, termoBusca]);

  // Lista consolidada de estágios do pipeline do negócio atual
  const pipelineAtual = useMemo(() => {
    if (!selectedConv?.pipeline_id) return pipelines[0] || null;
    return pipelines.find((p) => p.id === selectedConv.pipeline_id) || pipelines[0] || null;
  }, [pipelines, selectedConv]);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-140px)]">
      {/* Banner / Barra Superior de Status & Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card rounded-2xl border border-border shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Filtros de Canal */}
          <div className="flex items-center p-1 rounded-xl bg-accent/50 border border-border/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCanalFiltro('todos')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                canalFiltro === 'todos'
                  ? 'bg-card text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setCanalFiltro('instagram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                canalFiltro === 'instagram'
                  ? 'bg-card text-pink-600 dark:text-pink-400 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
              <span>Direct Automação</span>
            </button>
            <button
              type="button"
              onClick={() => setCanalFiltro('whatsapp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                canalFiltro === 'whatsapp'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>WhatsApp</span>
            </button>
          </div>

          <Tip label="Atualizar conversas">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadConversations(true)}
              disabled={loading || recarregando}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recarregando ? 'animate-spin' : ''}`} />
            </Button>
          </Tip>
        </div>

        {/* Status da Conexão do WhatsApp */}
        <div className="flex items-center gap-2">
          {whatsappStatus === 'conectado' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Conectado</span>
            </div>
          ) : (
            <Tip label="Conectar o celular da clínica para espelhar conversas e alimentar o CRM">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarQrCode}
                disabled={gerandoQrCode}
                className="gap-1.5 text-xs font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-500" />
                <span>{gerandoQrCode ? 'Gerando QR...' : 'Conectar WhatsApp (QR Code)'}</span>
              </Button>
            </Tip>
          )}
        </div>
      </div>

      {/* Grid Principal: 3 Colunas (Lista de Conversas | Chat Central | Informações do Lead CRM) */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr_300px] gap-3 flex-1 min-h-0 overflow-hidden">
        {/* COLUNA 1: LISTA DE CONVERSAS */}
        <Card padding="none" className="rounded-2xl flex flex-col overflow-hidden border border-border">
          <div className="p-2.5 border-b border-border">
            <input
              type="text"
              placeholder="Buscar por nome, @ ou telefone..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-accent/40 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
            {loading ? (
              <SkeletonRows rows={6} className="p-3" />
            ) : conversasFiltradas.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="Nenhuma conversa"
                description={
                  canalFiltro === 'instagram'
                    ? 'Apenas mensagens vindas por automação ou IA aparecem aqui.'
                    : 'Nenhuma conversa recebida até o momento.'
                }
              />
            ) : (
              conversasFiltradas.map((conv) => {
                const isSelected = selectedConv?.id === conv.id;
                const isWhatsapp = conv.canal === 'whatsapp';

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-accent border border-primary/20 shadow-2xs'
                        : 'hover:bg-accent/50 border border-transparent'
                    }`}
                  >
                    {/* Avatar com Badge do Canal */}
                    <div className="relative shrink-0">
                      {conv.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={conv.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                            isWhatsapp ? 'bg-emerald-500/15 text-emerald-600' : 'bg-pink-500/15 text-pink-600'
                          }`}
                        >
                          {(conv.nome || conv.username || conv.contato_id)[0]?.toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-card shadow-2xs ${
                          isWhatsapp ? 'bg-emerald-500 text-white' : 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white'
                        }`}
                      >
                        {isWhatsapp ? (
                          <MessageCircle className="w-2.5 h-2.5" />
                        ) : (
                          <Instagram className="w-2.5 h-2.5" />
                        )}
                      </span>
                    </div>

                    {/* Detalhes do Contato */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground truncate">
                          {conv.nome || (conv.username ? `@${conv.username}` : `+${conv.contato_id}`)}
                        </span>
                        {conv.canal === 'instagram' && conv.ai_modo === 'ia' && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                            🤖 IA
                          </span>
                        )}
                      </div>

                      {conv.username && (
                        <span className="text-[10px] text-muted-foreground font-mono block truncate">
                          @{conv.username}
                        </span>
                      )}

                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.ultima_direcao === 'outbound' ? 'Você: ' : ''}
                        {conv.ultima_mensagem || '—'}
                      </p>

                      {conv.negocio_estagio_nome && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent font-medium text-foreground border border-border/80 truncate">
                            {conv.negocio_estagio_nome}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* COLUNA 2: CHAT CENTRAL */}
        <Card padding="none" className="rounded-2xl flex flex-col overflow-hidden border border-border">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 stroke-[1.2] mb-3 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">Nenhuma conversa selecionada</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Selecione uma conversa à esquerda para visualizar o histórico completo de mensagens ou responder ao lead.
              </p>
            </div>
          ) : (
            <>
              {/* Header do Chat */}
              <div className="p-3 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    {selectedConv.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedConv.foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-foreground">
                        {(selectedConv.nome || selectedConv.username || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-card ${
                        selectedConv.canal === 'whatsapp' ? 'bg-emerald-500 text-white' : 'bg-pink-500 text-white'
                      }`}
                    >
                      {selectedConv.canal === 'whatsapp' ? (
                        <MessageCircle className="w-2 h-2" />
                      ) : (
                        <Instagram className="w-2 h-2" />
                      )}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-foreground">
                        {selectedConv.nome || (selectedConv.username ? `@${selectedConv.username}` : `+${selectedConv.contato_id}`)}
                      </span>
                      {selectedConv.canal === 'instagram' && (
                        <span className="text-[10px] font-mono text-pink-600 dark:text-pink-400 bg-pink-500/10 px-1 py-0.2 rounded">
                          Direct
                        </span>
                      )}
                      {selectedConv.canal === 'whatsapp' && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">
                          WhatsApp
                        </span>
                      )}
                    </div>
                    {selectedConv.username && (
                      <span className="text-[11px] text-muted-foreground font-mono">@{selectedConv.username}</span>
                    )}
                  </div>
                </div>

                {/* Alternador de IA se for contato do Instagram */}
                {selectedConv.canal === 'instagram' && (
                  <button
                    type="button"
                    onClick={handleToggleAiContato}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                      selectedConv.ai_modo === 'humano'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{selectedConv.ai_modo === 'humano' ? '👤 Humano (Ligar IA)' : '🤖 IA Ativa (Assumir)'}</span>
                  </button>
                )}
              </div>

              {/* Mensagens do Chat */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-accent/10">
                {loadingMessages ? (
                  <SkeletonRows rows={4} className="p-3" />
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                    Nenhuma mensagem registrada nesta conversa.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        m.de_mim
                          ? 'self-end bg-primary text-primary-foreground rounded-br-xs'
                          : 'self-start bg-card text-foreground border border-border shadow-2xs rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.conteudo}</p>
                      <span
                        className={`text-[9px] mt-1 block text-right ${
                          m.de_mim ? 'text-primary-foreground/75' : 'text-muted-foreground'
                        }`}
                      >
                        {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Input de Envio */}
              <div className="p-2 border-t border-border flex gap-2 bg-card">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={
                    selectedConv.canal === 'whatsapp'
                      ? 'Responder via WhatsApp (OpenWA)...'
                      : 'Responder diretamente no Instagram...'
                  }
                  className="flex-1 bg-accent/40 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" onClick={handleSend} disabled={sending || !input.trim()} className="gap-1 px-3">
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </div>
            </>
          )}
        </Card>

        {/* COLUNA 3: PAINEL LATERAL DO LEAD (CRM 360°) */}
        <Card padding="sm" className="rounded-2xl flex flex-col overflow-y-auto border border-border bg-card">
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
              Selecione uma conversa para ver a ficha completa do lead e o estágio no CRM.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Cabeçalho do Lead */}
              <div className="flex flex-col items-center text-center pb-3 border-b border-border">
                {selectedConv.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedConv.foto_url} alt="" className="w-14 h-14 rounded-full object-cover mb-2 border-2 border-border" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-lg font-bold text-foreground mb-2">
                    {(selectedConv.nome || selectedConv.username || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <h4 className="font-bold text-sm text-foreground">
                  {selectedConv.nome || 'Lead sem nome'}
                </h4>
                {selectedConv.username && (
                  <a
                    href={`https://instagram.com/${selectedConv.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-pink-600 dark:text-pink-400 hover:underline font-mono mt-0.5"
                  >
                    <Instagram className="w-3 h-3" />
                    <span>@{selectedConv.username}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {/* Dados de Contato */}
              <div className="flex flex-col gap-2 text-xs">
                <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Informações de Contato
                </span>

                {selectedConv.telefone && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-accent/40 border border-border/60">
                    <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-muted-foreground block">WhatsApp</span>
                      <span className="font-mono font-semibold text-foreground truncate block">
                        +{selectedConv.telefone}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-2 rounded-xl bg-accent/40 border border-border/60">
                  <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-muted-foreground block">Origem Principal</span>
                    <span className="font-semibold text-foreground capitalize">
                      {selectedConv.canal === 'whatsapp' ? 'WhatsApp Business' : 'Instagram Automação / IA'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Estágio no Funil de Vendas do CRM */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Kanban className="w-3 h-3" />
                    <span>Estágio no CRM</span>
                  </span>
                  {selectedConv.negocio_estagio_nome && (
                    <Badge variant="brand" className="text-[10px]">
                      {selectedConv.negocio_estagio_nome}
                    </Badge>
                  )}
                </div>

                {pipelineAtual ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Mover lead para outra etapa do funil:
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {pipelineAtual.estagios.map((estagio) => {
                        const isCurrent = selectedConv.negocio_estagio_id === estagio.id;
                        return (
                          <button
                            key={estagio.id}
                            type="button"
                            disabled={isCurrent || movendoEstagio}
                            onClick={() => handleMoverEstagio(estagio.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all border ${
                              isCurrent
                                ? 'bg-primary/10 text-primary border-primary/30 font-bold'
                                : 'bg-accent/40 text-muted-foreground hover:text-foreground hover:bg-accent border-border/60'
                            }`}
                          >
                            <span className="truncate">{estagio.nome}</span>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Nenhum funil configurado ainda.
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modal / Overlay do QR Code para Conexão do WhatsApp */}
      {qrCodeModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card padding="md" className="max-w-sm w-full rounded-2xl border border-border shadow-lg flex flex-col items-center text-center">
            <h3 className="font-bold text-base text-foreground mb-1">Conectar WhatsApp da Clínica</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Abra o WhatsApp no celular, vá em <b>Aparelhos Conectados</b> e aponte a câmera para o QR Code abaixo.
            </p>

            <div className="p-3 bg-white rounded-xl shadow-xs border border-border mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeModal} alt="QR Code WhatsApp" className="w-48 h-48 object-contain" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQrCodeModal(null);
                carregarStatusWhatsApp();
              }}
              className="w-full"
            >
              Fechar
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
