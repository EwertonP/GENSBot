'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import ThemeToggle from '@/components/theme-toggle';
import {
  Settings,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  LogOut,
  Send,
  X,
  FileCode,
  Lock,
  Home,
  Users,
  BarChart3,
  HelpCircle,
} from 'lucide-react';

const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

interface Followup {
  id: string;
  delay_minutes: number;
  text: string;
  link_url?: string | null;
  link_text?: string | null;
  link_button_label?: string | null;
}

interface Automation {
  id?: string;
  name: string;
  active: boolean;
  triggers: string[];
  keywords: string[];
  match_type: 'contains' | 'exact' | 'any';
  specific_post_id?: string | null;
  public_replies: string[];
  welcome_dm: string;
  quick_reply_button?: string | null;
  link_text?: string | null;
  link_button_label?: string | null;
  link_url?: string | null;
  reminder_text?: string | null;
  reminder_delay_minutes?: number | null;
  ask_email?: boolean;
  ask_phone?: boolean;
  webhook_url?: string | null;
  followups?: Followup[];
  created_at?: string;
}

interface IgMedia {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  permalink: string;
}

interface InstagramAccountSummary {
  id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  profile_picture_url: string | null;
  token_expires_at: string | null;
}

const SELECTED_ACCOUNT_STORAGE_KEY = 'gensbot_selected_account';

export default function Dashboard() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Configurações de estado do app
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<any>(null);

  // Seletor de múltiplas contas do Instagram conectadas ao mesmo login
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [stats, setStats] = useState({ automations: 0, contacts: 0, queue: 0, events: 0 });
  const [funnel, setFunnel] = useState({ comments: 0, welcomeDms: 0, clicks: 0, leads: 0 });
  const [weeklyChart, setWeeklyChart] = useState<{ day: string; comments: number; dms: number }[]>([]);
  const [weeklyChartMax, setWeeklyChartMax] = useState(1);
  const [health, setHealth] = useState({ sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false });
  const [trends, setTrends] = useState<{ contacts: number | null; automations: number | null; queue: number | null; events: number | null }>({ contacts: null, automations: null, queue: null, events: null });
  const [failureDiagnostics, setFailureDiagnostics] = useState<{ reason: string; count: number }[]>([]);
  const [automationRanking, setAutomationRanking] = useState<{ id: string; name: string; comments: number; welcomeDms: number; clicks: number; leads: number }[]>([]);
  const [tokenHealth, setTokenHealth] = useState<{ instagram_user_id: string; instagram_username: string | null; daysRemaining: number | null; status: 'ok' | 'warning' | 'expired' | 'unknown' }[]>([]);
  const [alerts, setAlerts] = useState<{ level: 'critical' | 'warning'; message: string }[]>([]);
  const [isAggregateView, setIsAggregateView] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentQueue, setRecentQueue] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  
  // Mídias do Instagram para o seletor visual
  const [mediaList, setMediaList] = useState<IgMedia[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'carousel' | 'image'>('all');

  // Dashboard Chart States
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(3);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | 'month'>('7d');

  // Estados do formulário de automação
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'automations' | 'contacts' | 'logs' | 'chat'>('dashboard');
  const [form, setForm] = useState<Automation>({
    name: '',
    active: true,
    triggers: ['comment'],
    keywords: [],
    match_type: 'contains',
    specific_post_id: null,
    public_replies: [],
    welcome_dm: '',
    quick_reply_button: 'Quero!',
    link_text: '',
    link_button_label: 'Acessar Link',
    link_url: '',
    reminder_text: '',
    reminder_delay_minutes: 15,
    ask_email: false,
    ask_phone: false,
    webhook_url: '',
    followups: [],
  });
  
  // Live Chat States
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Estado para inputs auxiliares
  const [keywordInput, setKeywordInput] = useState('');
  const [publicReplyInput, setPublicReplyInput] = useState('');

  // Mensagens de alerta/sucesso
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Layout states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Anexa ?account=<instagram_user_id> na URL, para as rotas de API saberem
  // qual conta conectada operar (o seletor de contas no header troca esse valor).
  const withAccount = (url: string, accountIdOverride?: string | null) => {
    const id = accountIdOverride !== undefined ? accountIdOverride : selectedAccountId;
    if (!id) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}account=${encodeURIComponent(id)}`;
  };

  const fetchStatusAndData = async (accountIdOverride?: string | null) => {
    try {
      const res = await fetch(withAccount('/api/status', accountIdOverride));
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.isConnected);
        setConfig(data.config);
        setStats(data.stats);
        setRecentEvents(data.recentEvents);
        setRecentQueue(data.recentQueue);
        setContacts(data.contacts || []);
        setFunnel(data.funnel || { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 });
        setWeeklyChart(data.weeklyChart || []);
        setWeeklyChartMax(data.weeklyChartMax || 1);
        setHealth(data.health || { sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false });
        setTrends(data.trends || { contacts: null, automations: null, queue: null, events: null });
        setFailureDiagnostics(data.failureDiagnostics || []);
        setAutomationRanking(data.automationRanking || []);
        setTokenHealth(data.tokenHealth || []);
        setAlerts(data.alerts || []);
        setIsAggregateView(!!data.isAggregate);
      }

      const autRes = await fetch(withAccount('/api/automations', accountIdOverride));
      const autData = await autRes.json();
      if (autRes.ok) {
        setAutomations(autData);
      }
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      showToast('Erro ao carregar dados do painel.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Busca todas as contas do Instagram conectadas pelo usuário logado e decide
  // qual delas exibir: a que veio do redirect do OAuth, a última selecionada
  // (salva no navegador) ou, por padrão, a conectada mais recentemente.
  const loadAccounts = async (preferredAccountId?: string | null) => {
    try {
      const res = await fetch('/api/instagram/accounts');
      const data: InstagramAccountSummary[] = await res.json();
      if (!res.ok) {
        setLoading(false);
        return;
      }

      setAccounts(data);

      const stored = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY) : null;
      let nextSelected: string | null = null;

      if (preferredAccountId && data.some(a => a.instagram_user_id === preferredAccountId)) {
        nextSelected = preferredAccountId;
      } else if (stored === 'all' && data.length > 1) {
        nextSelected = 'all';
      } else if (stored && data.some(a => a.instagram_user_id === stored)) {
        nextSelected = stored;
      } else if (data.length > 0) {
        nextSelected = data[0].instagram_user_id;
      }

      setSelectedAccountId(nextSelected);
      if (typeof window !== 'undefined') {
        if (nextSelected) localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, nextSelected);
        else localStorage.removeItem(SELECTED_ACCOUNT_STORAGE_KEY);
      }

      await fetchStatusAndData(nextSelected);
    } catch (err) {
      console.error('Erro ao carregar contas conectadas:', err);
      setLoading(false);
    }
  };

  const handleSelectAccount = (accountId: string) => {
    setAccountMenuOpen(false);
    if (accountId === selectedAccountId) return;
    setSelectedAccountId(accountId);
    if (typeof window !== 'undefined') localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, accountId);
    setLoading(true);
    setMediaList([]);
    fetchStatusAndData(accountId);
  };

  useEffect(() => {
    // Get current authenticated user on load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUser(user);
      }
    });

    // Se acabou de voltar do OAuth do Instagram, a URL traz ?account=<id> da
    // conta recém-conectada — usamos isso pra já selecioná-la automaticamente.
    const params = new URLSearchParams(window.location.search);
    const accountFromRedirect = params.get('account');
    loadAccounts(accountFromRedirect);
  }, []);

  useEffect(() => {
    if (isConnected && selectedAccountId && selectedAccountId !== 'all') {
      fetch(withAccount('/api/instagram/media', selectedAccountId))
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            setMediaList(data.data);
          }
        })
        .catch(err => console.error('Erro silencioso ao carregar mídias:', err));
    }
  }, [isConnected, selectedAccountId]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchChatMessages = async (contactId: string) => {
    try {
      const res = await fetch(withAccount(`/api/messages?contact_id=${contactId}`));
      const data = await res.json();
      if (res.ok) {
        setChatMessages(data);
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens do chat:', err);
    }
  };

  useEffect(() => {
    if (selectedContactId) {
      fetchChatMessages(selectedContactId);
      const interval = setInterval(() => {
        fetchChatMessages(selectedContactId);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedContactId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !chatInput.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const res = await fetch(withAccount('/api/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedContactId,
          text: chatInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setChatInput('');
        setChatMessages(prev => [...prev, data]);
        showToast('Mensagem enviada com sucesso!', 'success');
      } else {
        showToast(data.error || 'Erro ao enviar mensagem.', 'error');
      }
    } catch (err: any) {
      showToast('Erro de rede ao enviar mensagem.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleConnectInstagram = () => {
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    if (!clientId) {
      showToast('Falta configurar o NEXT_PUBLIC_INSTAGRAM_CLIENT_ID nas variáveis de ambiente.', 'error');
      return;
    }
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const scopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
    ].join(',');

    window.location.href = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scopes}&response_type=code`;
  };

  const handleLoadMedia = async () => {
    if (mediaList.length > 0) {
      setShowMediaModal(true);
      return;
    }
    setLoadingMedia(true);
    try {
      const res = await fetch(withAccount('/api/instagram/media'));
      const data = await res.json();
      if (res.ok && data.data) {
        setMediaList(data.data);
        setShowMediaModal(true);
      } else {
        showToast(data.error || 'Erro ao carregar mídias do Instagram.', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao carregar mídias.', 'error');
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.welcome_dm) {
      showToast('Preencha pelo menos o Nome e a DM de Boas-vindas.', 'error');
      return;
    }

    try {
      const method = form.id ? 'PUT' : 'POST';
      const endpoint = form.id ? `/api/automations/${form.id}` : '/api/automations';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const savedData = await res.json();
      if (res.ok) {
        showToast(form.id ? 'Automação atualizada!' : 'Automação criada com sucesso!', 'success');
        resetForm();
        fetchStatusAndData();
      } else {
        showToast(savedData.error || 'Erro ao salvar automação.', 'error');
      }
    } catch (err) {
      showToast('Erro de rede ao salvar automação.', 'error');
    }
  };

  const handleEditAutomation = (auto: Automation) => {
    setForm(auto);
    setIsEditing(true);
    setKeywordInput(auto.keywords.join(', '));
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta automação?')) return;
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Automação excluída com sucesso.', 'success');
        fetchStatusAndData();
        if (form.id === id) resetForm();
      } else {
        showToast('Erro ao excluir automação.', 'error');
      }
    } catch (err) {
      showToast('Erro ao excluir automação.', 'error');
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      active: true,
      triggers: ['comment'],
      keywords: [],
      match_type: 'contains',
      specific_post_id: null,
      public_replies: [],
      welcome_dm: '',
      quick_reply_button: 'Quero!',
      link_text: '',
      link_button_label: 'Acessar Link',
      link_url: '',
      reminder_text: '',
      reminder_delay_minutes: 15,
      ask_email: false,
      ask_phone: false,
      webhook_url: '',
    });
    setIsEditing(false);
    setKeywordInput('');
    setPublicReplyInput('');
  };

  const handleTriggerChange = (trigger: string) => {
    setForm(prev => {
      const triggers = prev.triggers.includes(trigger)
        ? prev.triggers.filter(t => t !== trigger)
        : [...prev.triggers, trigger];
      return { ...prev, triggers };
    });
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeywordInput(value);
    const keywords = value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    setForm(prev => ({ ...prev, keywords }));
  };

  const handleAddPublicReply = () => {
    if (!publicReplyInput.trim()) return;
    setForm(prev => ({
      ...prev,
      public_replies: [...prev.public_replies, publicReplyInput.trim()],
    }));
    setPublicReplyInput('');
  };

  const handleRemovePublicReply = (index: number) => {
    setForm(prev => ({
      ...prev,
      public_replies: prev.public_replies.filter((_, i) => i !== index),
    }));
  };

  // Drenar fila manualmente (para testes rápidos)
  const handleManualDrain = async () => {
    try {
      const res = await fetch('/api/queue/drain', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Fila processada! Envia: ${data.processed?.length || 0} msgs.`, 'success');
        fetchStatusAndData();
      } else {
        showToast(data.error || 'Erro ao drenar fila.', 'error');
      }
    } catch {
      showToast('Erro ao se conectar ao worker.', 'error');
    }
  };

  // Desconecta apenas a conta atualmente selecionada no seletor, sem afetar
  // as outras contas conectadas pelo mesmo login.
  const handleDisconnect = async () => {
    if (!selectedAccountId || selectedAccountId === 'all') return;
    const account = accounts.find(a => a.instagram_user_id === selectedAccountId);
    if (!confirm(`Deseja realmente desconectar a conta @${account?.instagram_username || selectedAccountId}?`)) return;

    try {
      const res = await fetch(withAccount('/api/status'), { method: 'DELETE' });
      if (res.ok) {
        showToast('Conta desconectada com sucesso.', 'success');
        const remaining = accounts.filter(a => a.instagram_user_id !== selectedAccountId);
        setAccounts(remaining);
        const next = remaining.length > 0 ? remaining[0].instagram_user_id : null;
        setSelectedAccountId(next);
        if (typeof window !== 'undefined') {
          if (next) localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, next);
          else localStorage.removeItem(SELECTED_ACCOUNT_STORAGE_KEY);
        }
        setMediaList([]);
        fetchStatusAndData(next);
      } else {
        showToast('Erro ao desconectar a conta.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao desconectar.', 'error');
    }
  };

  const handleAppLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Adiciona uma tag a um contato e sincroniza a lista local sem recarregar tudo
  const handleAddTag = async (contactId: string, currentTags: string[], newTag: string) => {
    const tag = newTag.trim();
    if (!tag || currentTags.includes(tag)) return;
    const nextTags = [...currentTags, tag];
    try {
      const res = await fetch(withAccount(`/api/contacts/${contactId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (res.ok) {
        setContacts(prev => prev.map(c => c.instagram_id === contactId ? { ...c, tags: nextTags } : c));
      } else {
        showToast('Erro ao adicionar tag.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao adicionar tag.', 'error');
    }
  };

  const handleRemoveTag = async (contactId: string, currentTags: string[], tagToRemove: string) => {
    const nextTags = currentTags.filter(t => t !== tagToRemove);
    try {
      const res = await fetch(withAccount(`/api/contacts/${contactId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (res.ok) {
        setContacts(prev => prev.map(c => c.instagram_id === contactId ? { ...c, tags: nextTags } : c));
      } else {
        showToast('Erro ao remover tag.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao remover tag.', 'error');
    }
  };

  // Gera e baixa um CSV a partir de uma lista de objetos, direto no navegador
  const exportToCsv = (filename: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) {
      showToast('Nada para exportar ainda.', 'error');
      return;
    }
    const headers = Object.keys(rows[0]);
    const escapeCell = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
    ].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Carregando painel de automação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans antialiased overflow-x-hidden">
      {/* Toast Alert */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-card text-foreground shadow-lg transition-all duration-300 animate-slide-in`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
          <p className="text-sm font-semibold">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar aviso"
            className="p-1 -m-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Overlay para o Menu Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 1. Left Sidebar Navigation (Off-canvas no mobile) */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-sidebar text-muted-foreground flex flex-col flex-shrink-0 select-none border-r border-sidebar-border transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Brand Header */}
        <div className="px-6 pt-6 pb-4 flex items-center">
          {/* Logo enviada pelo usuário */}
          <img
            src="/logo.png"
            alt="GENS Logo"
            className="h-8 w-auto object-contain select-none"
          />
        </div>

        {/* Seletor de Conta do Instagram (perfil ativo) */}
        <div className="px-4 pb-4">
          {accounts.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={accountMenuOpen}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted hover:bg-accent transition-colors cursor-pointer text-left"
              >
                {config?.profile_picture_url ? (
                  <img
                    src={config.profile_picture_url}
                    alt="Instagram Profile"
                    className="w-11 h-11 rounded-full object-cover border-2 border-card shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0 leading-tight">
                  <p className="text-sm font-bold text-foreground truncate">@{config?.instagram_username || '...'}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {accounts.length > 1 ? `${accounts.length} contas conectadas` : 'Conta conectada'}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground flex-shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>

              {accountMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-full bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto py-1">
                      {accounts.length > 1 && (
                        <button
                          onClick={() => handleSelectAccount('all')}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer ${
                            selectedAccountId === 'all' ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground flex-1 truncate">
                            Todas as contas ({accounts.length})
                          </span>
                          {selectedAccountId === 'all' && (
                            <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      )}
                      {accounts.map(acc => {
                        const health = tokenHealth.find(t => t.instagram_user_id === acc.instagram_user_id);
                        return (
                        <button
                          key={acc.instagram_user_id}
                          onClick={() => handleSelectAccount(acc.instagram_user_id)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer ${
                            acc.instagram_user_id === selectedAccountId ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            {acc.profile_picture_url ? (
                              <img src={acc.profile_picture_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                <Instagram className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            {health && (health.status === 'warning' || health.status === 'expired') && (
                              <span
                                title={health.status === 'expired' ? 'Token expirado' : `Token expira em ${health.daysRemaining} dia(s)`}
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${health.status === 'expired' ? 'bg-destructive' : 'bg-warning'}`}
                              />
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-foreground flex-1 truncate">
                            @{acc.instagram_username || acc.instagram_user_id}
                          </span>
                          {acc.instagram_user_id === selectedAccountId && (
                            <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                        </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-border py-1">
                      <button
                        onClick={() => { setAccountMenuOpen(false); handleConnectInstagram(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent text-primary text-[11px] font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Conectar outra conta
                      </button>
                      {selectedAccountId !== 'all' && (
                        <button
                          onClick={() => { setAccountMenuOpen(false); handleDisconnect(); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent text-destructive text-[11px] font-bold cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Desconectar esta conta
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnectInstagram}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs transition-all shadow-md shadow-primary/10 cursor-pointer"
            >
              <Instagram className="w-3.5 h-3.5" />
              Conectar Instagram
            </button>
          )}
        </div>

        <div className="border-t border-sidebar-border" />

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-6">
          {/* Operações Category */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-2">Operações</span>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'chat', label: 'Live Chat Inbox', icon: MessageSquare },
              { id: 'automations', label: 'Automações', icon: Settings },
              { id: 'contacts', label: 'Contatos / Leads', icon: Users },
            ].map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsEditing(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${
                    active
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Sistema Category */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-2">Sistema</span>
            {[
              { id: 'logs', label: 'Logs de Eventos', icon: FileCode },
            ].map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsEditing(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${
                    active
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer: Usuário logado no GENSBot + Sair */}
        <div className="p-4 border-t border-sidebar-border flex flex-col gap-3">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>v1.3.0 • eGrow Edition</span>
            </div>
            <ThemeToggle />
          </div>
          {currentUser && (
            <div className="flex items-center gap-2 rounded-2xl bg-muted p-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/30 flex items-center justify-center text-primary-foreground font-bold text-[11px] flex-shrink-0">
                {(currentUser.user_metadata?.full_name || currentUser.email || '?')[0].toUpperCase()}
              </div>
              <p className="flex-1 min-w-0 text-xs text-foreground font-semibold truncate">
                {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
              </p>
              <button
                id="app-logout-button"
                onClick={handleAppLogout}
                title="Sair da conta"
                className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background w-full relative">
        
        {/* Mobile Top Bar (Só aparece em telas pequenas) */}
        <div className="md:hidden flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <img src="/logo.png" alt="GENS" className="h-6 w-auto object-contain" />
          </div>
          {/* Avatar na top bar mobile */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/30 flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md">
            {currentUser?.email?.substring(0, 1).toUpperCase()}
          </div>
        </div>

        {/* Top Header Bar */}
        <header className="hidden md:flex h-16 bg-background px-6 items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'chat' && 'Live Chat Inbox'}
              {activeTab === 'automations' && 'Automações'}
              {activeTab === 'contacts' && 'Leads & Público'}
              {activeTab === 'logs' && 'Logs de Eventos'}
            </h2>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {activeTab === 'dashboard' && 'Bem-vindo de volta! Veja o que está acontecendo com sua automação.'}
              {activeTab === 'chat' && 'Converse em tempo real e faça atendimento manual no direct do Instagram.'}
              {activeTab === 'automations' && 'Crie e configure fluxos de funil de resposta automática.'}
              {activeTab === 'contacts' && 'Pessoas que comentaram ou iniciaram conversas com o bot.'}
              {activeTab === 'logs' && 'Histórico completo dos webhooks Meta e fila de disparos.'}
            </p>
          </div>

          <button
            onClick={handleManualDrain}
            title="Forçar Processamento da Fila"
            className="p-2.5 rounded-xl bg-card hover:bg-accent border border-border shadow-xs transition-all cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        {/* 3. Tab-based Content Area */}
        <main className="flex-1 overflow-y-auto p-6 pb-14 bg-background">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-6 animate-fade-in">

              {/* 0. Alertas do Sistema */}
              {alerts.length > 0 && (
                <section className="flex flex-col gap-2">
                  {alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-xs font-medium ${
                        alert.level === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-foreground'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </section>
              )}

              {/* 1. Hero KPI Cards Grid — card neutro, cor vira só indicador pontual */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {([
                  { label: 'Leads Gerados', value: stats.contacts, change: trends.contacts, dot: 'bg-primary' },
                  { label: 'Automações Ativas', value: stats.automations, change: trends.automations, dot: 'bg-success' },
                  { label: 'Fila de Disparos', value: stats.queue, change: trends.queue, dot: 'bg-warning' },
                  { label: 'Eventos Captados', value: stats.events, change: trends.events, dot: 'bg-muted-foreground' },
                ] as const).map(card => (
                  <div key={card.label} className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all h-40">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{card.label}</span>
                      <span className={`w-1.75 h-1.75 rounded-full flex-shrink-0 ${card.dot}`} />
                    </div>

                    <div className="flex flex-col mt-2">
                      <span className="text-4xl font-bold text-foreground leading-none tabular-nums">{card.value}</span>
                      <div className="flex items-center gap-2 mt-3">
                        {card.change === null ? (
                          <span className="text-[11px] font-semibold text-muted-foreground">Novo</span>
                        ) : (
                          <span className={`text-[11px] font-semibold tabular-nums ${card.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {card.change >= 0 ? '↑' : '↓'} {Math.abs(card.change)}%
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-medium">vs 30 dias anteriores</span>
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              {/* 2. Main Analytics & Meter Charts (Inspired by Donezo & ACRU) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 2A: Interactive 7-Day Bar Chart (lg:col-span-8) */}
                <div className="lg:col-span-8 bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-foreground text-base">Desempenho de Disparos & Interações</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Volume diário de comentários detectados e DMs entregues</p>
                    </div>
                    
                    {/* Period selector buttons */}
                    <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-accent self-start sm:self-auto">
                      {(['7d', '30d', 'month'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setChartPeriod(p)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            chartPeriod === p
                              ? 'bg-accent text-primary border border-primary/25 shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Este Mês'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Bar Chart Graphic — dados reais dos últimos 7 dias */}
                  <div className="flex flex-col gap-3 pt-4">
                    {weeklyChart.every(d => d.comments === 0 && d.dms === 0) ? (
                      <div className="h-44 w-full flex items-center justify-center text-xs text-muted-foreground">
                        Ainda sem comentários ou DMs registrados nos últimos 7 dias.
                      </div>
                    ) : (
                      <div className="h-44 w-full flex items-end justify-between gap-3 px-2 relative border-b border-accent pb-2">
                        {weeklyChart.map((item, i) => {
                          const isHovered = hoveredBarIndex === i;
                          const commentsHeight = Math.max(4, Math.round((item.comments / weeklyChartMax) * 100));
                          const dmsHeight = item.comments > 0 ? Math.min(100, Math.round((item.dms / item.comments) * 100)) : 0;
                          return (
                            <div
                              key={i}
                              onMouseEnter={() => setHoveredBarIndex(i)}
                              className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer relative"
                            >
                              {/* Floating Tooltip on Hover */}
                              {isHovered && (
                                <div className="absolute -top-12 z-30 bg-accent border border-primary/40 text-foreground text-[10px] py-1.5 px-3 rounded-xl shadow-xl whitespace-nowrap animate-fade-in flex flex-col items-center pointer-events-none">
                                  <span className="font-bold text-primary">{item.day}-feira</span>
                                  <span>💬 {item.comments} com. | 📥 {item.dms} DMs</span>
                                </div>
                              )}

                              {/* Bar Pill */}
                              <div className="w-full max-w-[36px] bg-accent rounded-t-xl overflow-hidden relative flex items-end transition-all duration-300 group-hover:bg-muted" style={{ height: `${commentsHeight}%` }}>
                                <div
                                  className={`w-full transition-all duration-500 rounded-t-xl ${
                                    isHovered
                                      ? 'bg-primary/90 shadow-lg shadow-primary/20'
                                      : 'bg-primary/85 group-hover:bg-primary'
                                  }`}
                                  style={{ height: `${dmsHeight}%` }}
                                ></div>
                              </div>

                              {/* Day Label */}
                              <span className={`text-[11px] font-bold transition-colors ${isHovered ? 'text-primary' : 'text-muted-foreground'}`}>
                                {item.day}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary"></span> DMs Entregues
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-accent border border-border"></span> Comentários Processados
                        </span>
                      </div>
                      <span className="font-mono">
                        Média: {Math.round(weeklyChart.reduce((sum, d) => sum + d.dms, 0) / Math.max(1, weeklyChart.length))} disparos/dia
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2B: Semi-Donut Gauge Chart - Saúde do Bot (lg:col-span-4) */}
                <div className="lg:col-span-4 bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-foreground text-base">Saúde das Entregas</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Conformidade e taxa de sucesso da Meta API</p>
                  </div>

                  {/* 180° Semi-Donut SVG Gauge — arco proporcional à taxa de sucesso real */}
                  <div className="flex flex-col items-center justify-center my-2 relative">
                    <svg className="w-48 h-28" viewBox="0 0 100 55">
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      {health.hasData && (
                        <path
                          d="M 10 50 A 40 40 0 0 1 90 50"
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(health.sentPercent / 100) * 125.6} 125.6`}
                        />
                      )}
                    </svg>

                    <div className="absolute top-12 flex flex-col items-center text-center">
                      <span className="text-3xl font-bold text-foreground leading-none tabular-nums">
                        {health.hasData ? `${health.sentPercent}%` : '—'}
                      </span>
                      <span className="text-[10px] text-primary font-extrabold uppercase tracking-wider mt-1">Taxa de Sucesso</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-accent">
                    {!health.hasData ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Ainda não há disparos suficientes pra calcular a saúde das entregas.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary"></span> Disparos com Sucesso
                          </span>
                          <span className="font-bold text-foreground">{health.sentPercent}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-warning"></span> Na Fila / Aguardando
                          </span>
                          <span className="font-bold text-foreground">{health.pendingPercent}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-destructive"></span> Limites Meta / Falhas
                          </span>
                          <span className="font-bold text-foreground">{health.failedPercent}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* 3. Bottom Row (Funil + Activity Table) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 3A: Funil Reativo de Conversão (lg:col-span-4) */}
                <div className="lg:col-span-4 bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-5 justify-between">
                  <div>
                    <h4 className="font-bold text-foreground text-base">Funil de Conversão</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Retenção e conversão por etapa do fluxo</p>
                  </div>

                  {funnel.comments === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Ainda não há comentários registrados pra calcular o funil.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {[
                        { label: '1. Comentários Detectados', val: funnel.comments, color: 'bg-primary' },
                        { label: '2. DMs de Boas-Vindas', val: funnel.welcomeDms, color: 'bg-primary/75' },
                        { label: '3. Cliques no Botão / Link', val: funnel.clicks, color: 'bg-primary/50' },
                        { label: '4. Leads Qualificados', val: funnel.leads, color: 'bg-success' }
                      ].map((step, idx) => {
                        const percent = Math.round((step.val / funnel.comments) * 100);
                        return (
                          <div key={idx} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-muted-foreground">{step.label}</span>
                              <span className="text-foreground font-bold">{step.val} <span className="text-muted-foreground font-normal">({percent}%)</span></span>
                            </div>
                            <div className="h-3 w-full bg-accent rounded-full overflow-hidden p-0.5 border border-border">
                              <div
                                className={`h-full ${step.color} rounded-full transition-all duration-500`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3B: Histórico de Envios Recentes na Fila (lg:col-span-8) */}
                <div className="lg:col-span-8 bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-accent pb-3">
                    <div>
                      <h4 className="font-bold text-foreground text-base">Envios Pendentes & Recentes na Fila</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Histórico do pipeline de entregas em tempo real</p>
                    </div>
                    <button onClick={() => setActiveTab('logs')} className="text-xs font-bold text-primary hover:text-primary/90 transition-colors cursor-pointer">
                      Ver todos os logs →
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                      <thead className="text-xs uppercase text-muted-foreground font-bold border-b border-accent">
                        <tr>
                          <th className="py-2.5 px-3">Contato</th>
                          <th className="py-2.5 px-3">Tipo de Ação</th>
                          <th className="py-2.5 px-3">Horário</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent">
                        {recentQueue.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum disparo na fila recentemente.</td>
                          </tr>
                        ) : (
                          recentQueue.slice(0, 5).map(item => (
                            <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                              <td className="py-3 px-3 font-mono text-xs text-foreground font-bold flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-accent border border-border flex items-center justify-center text-[10px] text-primary">
                                  @
                                </div>
                                <span>@{item.contact_id.substring(0, 10)}...</span>
                              </td>
                              <td className="py-3 px-3 font-semibold text-foreground text-xs">
                                {item.type === 'private_reply' && 'DM de Boas-Vindas'}
                                {item.type === 'link_dm' && 'DM com Link'}
                                {item.type === 'reminder_dm' && 'DM de Lembrete'}
                              </td>
                              <td className="py-3 px-3 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleTimeString('pt-BR')}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                  item.status === 'sent' && 'bg-success/15 text-success'
                                } ${
                                  item.status === 'pending' && 'bg-warning/20 text-warning-foreground'
                                } ${
                                  item.status === 'failed' && 'bg-destructive/10 text-destructive'
                                }`}>
                                  {item.status === 'sent' && 'Enviado'}
                                  {item.status === 'pending' && 'Pendente'}
                                  {item.status === 'failed' && 'Falhou'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* 4. Diagnóstico de Falhas + Ranking de Automações */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div>
                    <h4 className="font-bold text-foreground text-base">Diagnóstico de Falhas</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Motivos mais comuns de falha nos últimos 90 dias</p>
                  </div>
                  {failureDiagnostics.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma falha registrada. 🎉</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {failureDiagnostics.map((f, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-muted-foreground flex-1">{f.reason}</span>
                          <span className="font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex-shrink-0">{f.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6 bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div>
                    <h4 className="font-bold text-foreground text-base">Ranking de Automações</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Quais automações mais convertem leads</p>
                  </div>
                  {automationRanking.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma automação com interações ainda.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {automationRanking.map((auto, i) => (
                        <div key={auto.id} className="flex items-center gap-3 text-xs">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <span className="text-foreground font-semibold flex-1 truncate">{auto.name}</span>
                          <span className="text-muted-foreground flex-shrink-0">{auto.comments} com. · {auto.clicks} cliques</span>
                          <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">{auto.leads} leads</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
          {/* TAB: LIVE CHAT */}
          {activeTab === 'chat' && isAggregateView && (
            <div className="bg-card border border-accent rounded-2xl p-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-bold text-foreground">Selecione uma conta específica</p>
              <p className="text-xs text-muted-foreground mt-1">O Live Chat funciona com uma conta do Instagram por vez. Escolha uma no seletor da sidebar.</p>
            </div>
          )}
          {activeTab === 'chat' && !isAggregateView && (
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6 bg-card border border-accent rounded-2xl overflow-hidden shadow-xs h-[calc(100vh-170px)]">
              {/* Left Contacts List */}
              <div className={`lg:col-span-4 border-r border-accent h-full overflow-hidden bg-background ${selectedContactId ? 'hidden lg:flex flex-col' : 'flex flex-col'}`}>
                <div className="p-4 border-b border-accent bg-card">
                  <h3 className="font-bold text-foreground text-sm">Conversas Recentes</h3>
                  <p className="text-[10px] text-muted-foreground">Clique para abrir o histórico de mensagens</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                  {contacts.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">Nenhum contato ativo.</div>
                  ) : (
                    contacts.map(c => {
                      const isSelected = selectedContactId === c.instagram_id;
                      const displayName = c.full_name || c.username || 'User';
                      const initials = displayName.slice(0, 2).toUpperCase();
                      return (
                        <div
                          key={c.instagram_id}
                          onClick={() => setSelectedContactId(c.instagram_id)}
                          className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
                            isSelected
                              ? 'bg-accent border-border shadow-sm'
                              : 'bg-transparent border-transparent hover:bg-accent/50'
                          }`}
                        >
                          {/* Circular Avatar */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-2xs'
                              : 'bg-accent text-foreground border border-border'
                          }`}>
                            {initials}
                          </div>

                          {/* Contact Info details */}
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`text-xs font-bold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                {c.full_name || `@${c.username || c.instagram_id}`}
                              </span>
                              {c.conversation_state && c.conversation_state !== 'idle' && (
                                <span className="text-[8px] bg-accent text-primary border border-primary/20 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                                  Fila
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate font-mono">
                              @{c.username || c.instagram_id}
                            </span>
                            {(c.email || c.phone) && (
                              <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground font-medium pt-0.5">
                                {c.email && <span className="truncate">📧 {c.email}</span>}
                                {c.phone && <span className="truncate">📱 {c.phone}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Chat Pane */}
              <div className={`lg:col-span-8 h-full overflow-hidden bg-background ${!selectedContactId ? 'hidden lg:flex flex-col' : 'flex flex-col'}`}>
                {selectedContactId ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-accent flex items-center justify-between bg-card gap-3">
                      <div className="flex items-center gap-3">
                        {/* Botão voltar no mobile */}
                        <button
                          onClick={() => setSelectedContactId(null)}
                          aria-label="Voltar para a lista de conversas"
                          className="lg:hidden p-1.5 -ml-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <div>
                          <h4 className="font-bold text-foreground text-sm">
                            @{contacts.find(c => c.instagram_id === selectedContactId)?.username || selectedContactId}
                          </h4>
                          <span className="text-[9px] text-muted-foreground font-medium">
                            ID: {selectedContactId}
                          </span>
                        </div>
                      </div>
                      
                      {/* State status badge */}
                      {(() => {
                        const c = contacts.find(c => c.instagram_id === selectedContactId);
                        if (!c) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                              {c.conversation_state === 'idle' ? 'Disponível' : c.conversation_state === 'waiting_email' ? 'Lendo E-mail' : 'Lendo Fone'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Chat Message list */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-20 text-xs text-muted-foreground">Nenhuma mensagem registrada nesta conversa.</div>
                      ) : (
                        chatMessages.map(msg => {
                          const isInbound = msg.direction === 'inbound';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                            >
                              <div
                                className={`p-3.5 rounded-2xl text-xs max-w-[75%] leading-relaxed ${
                                  isInbound
                                    ? 'bg-accent text-foreground rounded-tl-xs border border-border'
                                    : 'bg-primary text-primary-foreground font-semibold rounded-tr-xs shadow-xs'
                                }`}
                              >
                                {msg.text}
                              </div>
                              <span className="text-[9px] text-muted-foreground font-medium mt-1 px-1">
                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Chat Input form */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-accent flex items-center gap-2 bg-card">
                      <input
                        type="text"
                        placeholder="Digite uma mensagem para enviar..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        className="flex-1 bg-accent border border-border focus:border-primary rounded-full px-4 py-2.5 text-xs focus:outline-none text-foreground placeholder-muted-foreground transition-all"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !chatInput.trim()}
                        className="p-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
                      >
                        <Send className="w-4.5 h-4.5 text-primary-foreground" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10 bg-background">
                    <div className="p-4 rounded-full bg-card text-primary border border-border">
                      <MessageSquare className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Selecione uma conversa</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                        Escolha um contato na lista à esquerda para carregar o histórico de mensagens e responder diretamente.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUTOMATIONS */}
          {activeTab === 'automations' && isAggregateView && (
            <div className="bg-card border border-accent rounded-2xl p-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-bold text-foreground">Selecione uma conta específica</p>
              <p className="text-xs text-muted-foreground mt-1">Automações são criadas e editadas por conta. Escolha uma no seletor da sidebar pra gerenciar.</p>
            </div>
          )}
          {activeTab === 'automations' && !isAggregateView && (
            <div className="w-full">
              {!isEditing ? (
                /* Screen 1: List of Automations (Full Width) */
                <div className="flex flex-col gap-6 max-w-6xl mx-auto animate-fade-in">
                  <div className="flex items-center justify-between border-b border-accent pb-5">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Minhas Automações</h3>
                      <p className="text-xs text-muted-foreground mt-1">Gerencie, crie e ative seus fluxos de resposta direta e reativa.</p>
                    </div>
                    <button
                      onClick={() => {
                        resetForm();
                        setIsEditing(true);
                      }}
                      className="flex items-center gap-2 text-xs font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-full transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Criar Novo Fluxo
                    </button>
                  </div>

                  {automations.length === 0 ? (
                    <div className="bg-card border border-accent rounded-2xl p-16 text-center flex flex-col items-center gap-6 shadow-sm">
                      <div className="p-4 rounded-full bg-accent text-muted-foreground border border-border">
                        <Settings className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-base">Nenhuma automação cadastrada</h4>
                        <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                          Comece agora mesmo! Crie seu primeiro fluxo de automação para responder comentários automaticamente.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {automations.map(auto => {
                        const postMedia = auto.specific_post_id ? mediaList.find(m => m.id === auto.specific_post_id) : null;
                        return (
                          <div
                            key={auto.id}
                            onClick={() => handleEditAutomation(auto)}
                            className="bg-card border border-accent hover:border-border p-5 rounded-2xl cursor-pointer group transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow-md relative overflow-hidden"
                          >
                            <div className="flex items-start justify-between gap-3">
                              {auto.specific_post_id && (
                                <div className="w-14 h-14 rounded-lg bg-accent overflow-hidden relative border border-border flex-shrink-0">
                                  {postMedia ? (
                                    <img
                                      src={postMedia.thumbnail_url || postMedia.media_url}
                                      alt="Post Capa"
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-muted-foreground bg-accent text-center leading-3 p-1">
                                      Post Selec.
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <span className="font-extrabold text-foreground text-base truncate block group-hover:text-primary transition-colors">{auto.name}</span>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    auto.active
                                      ? 'bg-accent text-primary border border-primary/25'
                                      : 'bg-accent text-muted-foreground border border-border'
                                  }`}>
                                    {auto.active ? 'Ativo' : 'Pausado'}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAutomation(auto.id!);
                                }}
                                className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex flex-col gap-2 pt-3 border-t border-accent text-xs">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Gatilho:</span>
                                <div className="flex gap-1 flex-wrap">
                                  {auto.triggers.map(t => {
                                    let label = 'DM';
                                    if (t === 'comment') label = 'Comentários';
                                    if (t === 'story') label = 'Stories';
                                    return (
                                      <span key={t} className="text-[9px] bg-accent text-primary font-extrabold px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-wider">
                                        {label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              {auto.keywords.length > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Palavras-chave:</span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {auto.keywords.slice(0, 2).map((kw, i) => (
                                      <span key={i} className="text-[9px] bg-accent border border-border text-muted-foreground px-1.5 py-0.5 rounded font-mono font-bold">
                                        {kw}
                                      </span>
                                    ))}
                                    {auto.keywords.length > 2 && (
                                      <span className="text-[9px] text-muted-foreground font-extrabold">+ {auto.keywords.length - 2}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Screen 2: Visual Flow Editor Screen (Full Width with iPhone Preview Mockup) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in max-w-7xl mx-auto">
                  
                  {/* Left Column: Flow Builder Editor Form */}
                  <div className="lg:col-span-8">
                    <form onSubmit={handleSaveAutomation} className="flex flex-col gap-6">
                      
                      {/* Header of Flow Editor */}
                      <div className="bg-card border border-accent rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nome do Fluxo (ex: Capturar Leads)"
                            className="font-extrabold text-foreground text-lg focus:outline-none border-b border-border focus:border-primary pb-1 w-full max-w-sm transition-all bg-transparent"
                          />
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1.5">Configuração do Sequenciamento</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 flex-shrink-0 w-full md:w-auto">
                          {/* Active toggle */}
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.active}
                              onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-foreground after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-foreground after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
                            <span className="text-xs font-bold text-muted-foreground">{form.active ? 'Ativo' : 'Pausado'}</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full hover:bg-accent border border-border transition-all cursor-pointer animate-fade-in"
                          >
                            Voltar
                          </button>

                          <button
                            type="submit"
                            className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs shadow-md cursor-pointer transition-all"
                          >
                            Salvar Fluxo
                          </button>
                        </div>
                      </div>


                    {/* VERTICAL FLOW STEP CARDS CONTAINER */}
                    <div className="flex flex-col gap-6 relative pl-9 before:content-[''] before:absolute before:left-[17px] before:top-4 before:bottom-4 before:w-[2px] before:bg-border">
                      {/* Step 1: Gatilho / Trigger Card */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          1
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Configuração de Gatilhos de Entrada</h4>
                        </div>

                        {/* Fontes do Gatilho */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-muted-foreground">Fontes do Gatilho (Selecione um ou mais)</label>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {[
                              { id: 'comment', label: 'Comentários em Posts' },
                              { id: 'dm', label: 'Mensagens Diretas (DMs)' },
                              { id: 'story', label: 'Respostas aos Meus Stories' },
                              { id: 'story_mention', label: 'Menção nos Stories (Tag)' }
                            ].map(trigger => {
                              const active = form.triggers.includes(trigger.id);
                              return (
                                <button
                                  type="button"
                                  key={trigger.id}
                                  onClick={() => {
                                    const nextTriggers = form.triggers.includes(trigger.id)
                                      ? form.triggers.filter(t => t !== trigger.id)
                                      : [...form.triggers, trigger.id];
                                    if (nextTriggers.length > 0) {
                                      setForm(prev => ({ ...prev, triggers: nextTriggers }));
                                    }
                                  }}
                                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                                    active
                                      ? 'bg-primary border-primary text-primary-foreground shadow-2xs'
                                      : 'bg-accent border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                  }`}
                                >
                                  {trigger.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Palavras-chave (Separadas por vírgula)</label>
                            <input
                              type="text"
                              required
                              placeholder="ex: quero, cupom, info"
                              value={form.keywords.join(', ')}
                              onChange={handleKeywordsChange}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Tipo de Correspondência (Match Type)</label>
                            <select
                              value={form.match_type}
                              onChange={e => setForm(prev => ({ ...prev, match_type: e.target.value as any }))}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground font-semibold cursor-pointer transition-all"
                            >
                              <option value="contains">Contém a palavra-chave</option>
                              <option value="exact">Exato (Palavra-chave exata)</option>
                              <option value="any">Qualquer comentário (Ignora palavra-chave)</option>
                            </select>
                          </div>
                        </div>

                        {/* Post target selector */}
                        <div className="flex flex-col gap-1.5 pt-1">
                          <label className="text-xs font-bold text-muted-foreground">Publicação Alvo (Opcional)</label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleLoadMedia}
                              className="px-4 py-2.5 rounded-xl border border-border bg-accent hover:bg-muted text-foreground text-xs font-bold cursor-pointer transition-all flex items-center gap-2"
                            >
                              {form.specific_post_id ? 'Trocar Publicação Selecionada' : 'Selecionar Post Específico'}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            {form.specific_post_id && (() => {
                              const selectedMedia = mediaList.find(m => m.id === form.specific_post_id);
                              return (
                                <div className="flex items-center gap-3 bg-accent border border-border rounded-xl p-2 animate-fade-in text-foreground">
                                  {selectedMedia && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden relative border border-border flex-shrink-0">
                                      <img
                                        src={selectedMedia.thumbnail_url || selectedMedia.media_url}
                                        alt="Selected Post"
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold text-muted-foreground font-mono truncate max-w-[150px]">
                                      ID: {form.specific_post_id}
                                    </span>
                                    {selectedMedia?.caption && (
                                      <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">
                                        {selectedMedia.caption}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, specific_post_id: null }))}
                                    className="text-xs text-muted-foreground hover:text-destructive font-bold ml-2 cursor-pointer"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Resposta Pública Card */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          2
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Resposta Automática no Post (Comentário público)</h4>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-muted-foreground">Escreva uma frase de resposta e clique em Adicionar</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="ex: Te chamei no direct! Dá uma olhada lá."
                              value={publicReplyInput}
                              onChange={e => setPublicReplyInput(e.target.value)}
                              className="flex-1 bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground"
                            />
                            <button
                              type="button"
                              onClick={handleAddPublicReply}
                              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
                            >
                              Adicionar
                            </button>
                          </div>
                          {/* Sugestões de Respostas Rápidas */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[
                              "Te chamei no direct! Dá uma olhada lá.",
                              "Link enviado na sua DM! 🚀",
                              "Acabei de enviar no seu direct, confere lá!",
                              "Oi! Dá uma olhadinha nas suas mensagens.",
                              "Já mandei no seu privado! 😉"
                            ].map((preset, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (!form.public_replies.includes(preset)) {
                                    setForm(prev => ({ ...prev, public_replies: [...prev.public_replies, preset] }));
                                    showToast('Resposta rápida adicionada!', 'success');
                                  } else {
                                    showToast('Essa resposta já foi adicionada!', 'error');
                                  }
                                }}
                                className="text-[10px] bg-accent text-muted-foreground hover:bg-border hover:text-foreground px-3 py-1.5 rounded-full border border-border transition-colors cursor-pointer select-none"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* List of responses */}
                        {form.public_replies.length > 0 && (
                          <div className="flex flex-col gap-2 bg-accent/50 p-3.5 rounded-xl border border-border max-h-[160px] overflow-y-auto">
                            {form.public_replies.map((reply, index) => (
                              <div key={index} className="flex items-center justify-between gap-3 text-xs bg-accent py-2 px-3.5 rounded-xl border border-border shadow-xs animate-fade-in text-foreground">
                                <span className="truncate font-semibold">{reply}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePublicReply(index)}
                                  className="text-muted-foreground hover:text-destructive font-bold flex-shrink-0 cursor-pointer text-[10px]"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Step 3: Mensagem DM com Quick Reply Card */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          3
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Mensagem Privada Inicial (DM no Direct)</h4>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Conteúdo do primeiro Direct</label>
                            <textarea
                              required
                              placeholder="Olá! Vi seu interesse no post. Para receber o seu link de acesso, clique no botão de resposta rápida abaixo:"
                              value={form.welcome_dm}
                              onChange={e => setForm(prev => ({ ...prev, welcome_dm: e.target.value }))}
                              rows={3}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all resize-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Texto do Botão de Resposta Rápida (Máx 20 caracteres)</label>
                            <input
                              type="text"
                              maxLength={20}
                              placeholder="Ex: Sim, quero!"
                              value={form.quick_reply_button || ''}
                              onChange={e => setForm(prev => ({ ...prev, quick_reply_button: e.target.value || null }))}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all font-semibold"
                            />
                          </div>

                          {/* Lead Capture Options */}
                          <div className="border-t border-border pt-4 mt-2 flex flex-col gap-3">
                            <span className="text-xs font-bold text-foreground">Captura de Leads & Integração (Opcional)</span>
                            <div className="grid grid-cols-2 gap-4">
                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.ask_email || false}
                                  onChange={e => setForm(prev => ({ ...prev, ask_email: e.target.checked }))}
                                  className="rounded border-border bg-accent text-primary focus:ring-primary/20 w-4 h-4"
                                />
                                <span className="text-xs text-muted-foreground font-semibold">Solicitar E-mail</span>
                              </label>

                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.ask_phone || false}
                                  onChange={e => setForm(prev => ({ ...prev, ask_phone: e.target.checked }))}
                                  className="rounded border-border bg-accent text-primary focus:ring-primary/20 w-4 h-4"
                                />
                                <span className="text-xs text-muted-foreground font-semibold">Solicitar Telefone</span>
                              </label>
                            </div>

                            {(form.ask_email || form.ask_phone) && (
                              <div className="flex flex-col gap-1.5 animate-fade-in mt-1">
                                <label className="text-[11px] font-bold text-muted-foreground">URL do Webhook Externo (POST para Make/Zapier)</label>
                                <input
                                  type="url"
                                  placeholder="https://hook.us1.make.com/..."
                                  value={form.webhook_url || ''}
                                  onChange={e => setForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                                  className="bg-accent border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-4 py-2 text-xs focus:outline-none text-foreground placeholder-muted-foreground font-mono"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Conditional Connector Dotted Line */}
                      <div className="relative my-1.5 z-10 pointer-events-none select-none">
                        <span className="text-[9px] font-extrabold text-primary bg-accent border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-wider shadow-2xs absolute left-[-26px] translate-x-[-12%] top-[-8px] whitespace-nowrap animate-fade-in">
                          Click
                        </span>
                      </div>

                      {/* Step 4: Card de Link DM */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          4
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Envio do Link (Mensagem de Texto)</h4>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Texto de Apoio (Mensagem com o Link)</label>
                            <textarea
                              placeholder="Perfeito! Aqui está o seu link exclusivo para acessar o conteúdo completo:"
                              value={form.link_text || ''}
                              onChange={e => setForm(prev => ({ ...prev, link_text: e.target.value || null }))}
                              rows={2}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all resize-none font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground">URL do Link</label>
                              <input
                                type="url"
                                placeholder="https://sualandingpage.com"
                                value={form.link_url || ''}
                                onChange={e => setForm(prev => ({ ...prev, link_url: e.target.value || null }))}
                                className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground font-mono font-bold"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground">Texto do Botão</label>
                              <input
                                type="text"
                                placeholder="Acessar Link"
                                maxLength={20}
                                value={form.link_button_label || ''}
                                onChange={e => setForm(prev => ({ ...prev, link_button_label: e.target.value || null }))}
                                className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground font-bold"
                              />
                            </div>
                          </div>

                          {/* Preview Card */}
                          <div className="border border-border rounded-xl p-4 bg-accent/50 flex flex-col gap-2.5 max-w-sm">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Visualização do Envio</span>
                            <div className="bg-card border border-accent rounded-2xl p-3.5 text-xs text-foreground max-w-xs break-words leading-relaxed font-medium flex flex-col gap-3">
                              <p>{form.link_text || 'Aqui está o seu link:'}</p>
                              {form.link_url && (
                                <div className="mt-1 w-full flex justify-center border-t border-border pt-3">
                                  <span className="text-primary font-bold text-center block w-full">{form.link_button_label || 'Acessar Link'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Optional Connector */}
                      <div className="relative my-1.5 z-10 pointer-events-none select-none">
                        <span className="text-[9px] font-extrabold text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-md uppercase tracking-wider shadow-2xs absolute left-[-26px] translate-x-[-12%] top-[-8px] whitespace-nowrap">
                          Aguardar
                        </span>
                      </div>

                      {/* Sequence Builder Step */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground mt-1.5">
                        <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          5
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Sequência de Follow-ups (Opcional)</h4>
                        </div>
                        <p className="text-muted-foreground text-xs font-semibold mb-2">
                          Crie uma sequência de mensagens para serem enviadas automaticamente. O tempo total acumulado não pode ultrapassar 24 horas.
                        </p>

                        <div className="flex flex-col gap-4">
                          {form.followups && form.followups.map((followup, index) => (
                            <div key={followup.id} className="border border-border bg-accent p-4 rounded-xl flex flex-col gap-3 relative animate-fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  const newFollowups = form.followups?.filter((_, i) => i !== index);
                                  setForm(prev => ({ ...prev, followups: newFollowups }));
                                }}
                                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive cursor-pointer p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              
                              <div className="flex flex-col gap-1.5 pr-8">
                                <label className="text-xs font-bold text-muted-foreground">Mensagem {index + 1}</label>
                                <textarea
                                  placeholder="Digite a mensagem..."
                                  value={followup.text}
                                  onChange={e => {
                                    const newFollowups = [...(form.followups || [])];
                                    newFollowups[index].text = e.target.value;
                                    setForm(prev => ({ ...prev, followups: newFollowups }));
                                  }}
                                  rows={2}
                                  className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground resize-none"
                                />
                              </div>
                              
                              <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-muted-foreground">Aguardar (Minutos)</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={followup.delay_minutes}
                                    onChange={e => {
                                      const newFollowups = [...(form.followups || [])];
                                      newFollowups[index].delay_minutes = parseInt(e.target.value) || 1;
                                      setForm(prev => ({ ...prev, followups: newFollowups }));
                                    }}
                                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-muted-foreground">URL (Opcional)</label>
                                  <input
                                    type="url"
                                    placeholder="https://..."
                                    value={followup.link_url || ''}
                                    onChange={e => {
                                      const newFollowups = [...(form.followups || [])];
                                      newFollowups[index].link_url = e.target.value;
                                      setForm(prev => ({ ...prev, followups: newFollowups }));
                                    }}
                                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground font-mono"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-muted-foreground">Texto do Botão</label>
                                  <input
                                    type="text"
                                    placeholder="Acessar"
                                    maxLength={20}
                                    value={followup.link_button_label || ''}
                                    onChange={e => {
                                      const newFollowups = [...(form.followups || [])];
                                      newFollowups[index].link_button_label = e.target.value;
                                      setForm(prev => ({ ...prev, followups: newFollowups }));
                                    }}
                                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const totalMinutes = form.followups?.reduce((acc, f) => acc + f.delay_minutes, 0) || 0;
                              if (totalMinutes >= 1440) {
                                showToast('A sequência não pode ultrapassar 24h (1440 min).', 'error');
                                return;
                              }
                              setForm(prev => ({
                                ...prev,
                                followups: [
                                  ...(prev.followups || []),
                                  { id: Math.random().toString(36).substr(2, 9), delay_minutes: 15, text: '', link_url: '' }
                                ]
                              }));
                            }}
                            className="flex items-center justify-center gap-2 border border-dashed border-muted-foreground text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground hover:border-primary px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar Mensagem à Sequência
                          </button>
                        </div>
                      </div>
                    </div>
                    </form>
                  </div>

                  {/* Right Column: Phone Simulator Mockup */}
                  <div className="lg:col-span-4 sticky top-6 flex flex-col items-center gap-3">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest bg-card border border-accent px-3 py-1.5 rounded-full shadow-xs">
                      Visualização em Tempo Real (Direct)
                    </span>
                    
                    <div className="w-[300px] h-[580px] border-[10px] border-border rounded-[48px] bg-black shadow-2xl relative flex flex-col overflow-hidden select-none">
                      {/* iPhone top notch/camera */}
                      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-border rounded-full z-20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-card ml-8 border border-accent"></div>
                      </div>
                      
                      {/* Status Bar */}
                      <div className="flex justify-between items-center px-6 pt-3.5 pb-1 text-[9px] font-bold text-foreground bg-background/90 z-10">
                        <span>09:41</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[7px]">5G</span>
                          <div className="w-4 h-2 border border-foreground/60 rounded-[3px] p-[1px] flex items-center">
                            <div className="w-full h-full bg-foreground rounded-[1px]"></div>
                          </div>
                        </div>
                      </div>

                      {/* Direct Chat Header */}
                      <div className="flex items-center justify-between border-b border-accent bg-card px-4 py-2 text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center">
                            <Instagram className="w-4.5 h-4.5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-extrabold leading-none">@{config?.instagram_username || 'cliente'}</p>
                            <p className="text-[8px] text-muted-foreground mt-0.5 leading-none">InstaFlow Bot</p>
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Simulador</span>
                      </div>

                      {/* Chat Message Thread Body */}
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-background scrollbar-none">
                        
                        {/* 1. Comment Trigger simulation */}
                        {form.specific_post_id && (
                          <div className="border border-accent rounded-xl p-2.5 bg-card/80 flex flex-col gap-1.5 max-w-[240px] text-left self-start">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              💬 Comentário no Post
                            </span>
                            <p className="text-[10px] text-foreground">
                              <span className="font-bold text-primary">@seguidor</span> comentou: "{keywordInput.split(',')[0] || 'quero'}"
                            </p>
                          </div>
                        )}

                        {/* 2. Direct message reply simulation */}
                        {form.welcome_dm && (
                          <div className="flex flex-col gap-1.5 self-start max-w-[220px] text-left mt-1">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider pl-1">📥 Mensagem Recebida (DM)</span>
                            <div className="bg-accent border border-border text-foreground text-[10px] p-2.5 rounded-2xl rounded-tl-none leading-relaxed font-medium">
                              {form.welcome_dm}
                            </div>
                          </div>
                        )}

                        {/* 3. Quick Reply simulated button */}
                        {form.quick_reply_button && (
                          <div className="flex flex-col gap-1 self-center w-full max-w-[180px] mt-0.5">
                            <div className="bg-card border border-primary hover:bg-primary/10 text-primary text-[9px] py-1.5 px-3 rounded-full text-center font-extrabold cursor-pointer transition-all">
                              {form.quick_reply_button}
                            </div>
                            <span className="text-[7px] text-muted-foreground text-center italic mt-0.5">(Seguidor clica acima)</span>
                          </div>
                        )}

                        {/* 4. Contact prompts simulation (if asked) */}
                        {(form.ask_email || form.ask_phone) && (
                          <div className="flex flex-col gap-2 mt-2">
                            {form.ask_email && (
                              <>
                                <div className="bg-accent border border-border text-foreground text-[10px] p-2.5 rounded-2xl rounded-tl-none max-w-[220px] text-left self-start font-medium">
                                  Por favor, digite seu e-mail para receber o acesso:
                                </div>
                                <div className="bg-primary text-primary-foreground text-[10px] p-2.5 rounded-2xl rounded-tr-none max-w-[180px] text-right self-end font-bold">
                                  exemplo@email.com
                                </div>
                              </>
                            )}
                            {form.ask_phone && (
                              <>
                                <div className="bg-accent border border-border text-foreground text-[10px] p-2.5 rounded-2xl rounded-tl-none max-w-[220px] text-left self-start font-medium">
                                  Por favor, informe seu WhatsApp para contato:
                                </div>
                                <div className="bg-primary text-primary-foreground text-[10px] p-2.5 rounded-2xl rounded-tr-none max-w-[180px] text-right self-end font-bold">
                                  +55 11 99999-9999
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* 5. Link Delivery simulation */}
                        {form.link_text && (
                          <div className="flex flex-col gap-1.5 self-start max-w-[220px] text-left mt-2 w-full">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider pl-1">🔗 Envio do Link</span>
                            <div className="bg-accent border border-border text-foreground text-[10px] p-2.5 rounded-2xl rounded-tl-none leading-relaxed font-medium break-words flex flex-col gap-2">
                              <p>{form.link_text}</p>
                              {form.link_url && (
                                <div className="mt-1 w-full flex justify-center border-t border-border pt-2">
                                  <span className="text-primary font-bold text-center block w-full">{form.link_button_label || 'Acessar Link'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sequência (Follow-ups) */}
                        {form.followups && form.followups.map((f, i) => (
                          <div key={f.id} className="flex flex-col gap-1.5 self-start max-w-[220px] text-left mt-2 w-full">
                            <span className="text-[8px] font-bold text-destructive uppercase tracking-wider pl-1 flex items-center gap-1">
                              ⏰ Sequência ({f.delay_minutes}m depois)
                            </span>
                            <div className="bg-accent border border-border text-foreground text-[10px] p-2.5 rounded-2xl rounded-tl-none leading-relaxed font-medium break-words flex flex-col gap-2">
                              <p>{f.text}</p>
                              {f.link_url && (
                                <div className="mt-1 w-full flex justify-center border-t border-border pt-2">
                                  <span className="text-primary font-bold text-center block w-full">{f.link_button_label || 'Acessar Link'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* 6. Reminder Delivery simulation */}
                        {form.reminder_text && (
                          <div className="flex flex-col gap-1.5 self-start max-w-[220px] text-left mt-2">
                            <span className="text-[8px] font-bold text-destructive uppercase tracking-wider pl-1 flex items-center gap-1">
                              ⏰ Lembrete ({form.reminder_delay_minutes || 15}m depois)
                            </span>
                            <div className="bg-accent border border-border text-foreground text-[10px] p-2.5 rounded-2xl rounded-tl-none leading-relaxed font-medium italic">
                              {form.reminder_text}
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Phone Simulated Message Input Area */}
                      <div className="border-t border-accent bg-card p-2.5 flex items-center gap-2">
                        <div className="flex-1 bg-accent rounded-full px-3 py-1.5 text-[9px] text-muted-foreground border border-border text-left">
                          Enviar mensagem...
                        </div>
                        <div className="p-1.5 rounded-full bg-primary text-primary-foreground">
                          <Send className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (() => {
            const allTags = Array.from(new Set(contacts.flatMap(c => c.tags || []))).sort();
            const filteredContacts = tagFilter ? contacts.filter(c => (c.tags || []).includes(tagFilter)) : contacts;
            return (
            <div className="bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-foreground text-base">Audiência Cadastrada</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Lista de usuários que interagiram com as suas automações.</p>
                </div>
                <div className="flex items-center gap-2">
                  {allTags.length > 0 && (
                    <select
                      value={tagFilter}
                      onChange={e => setTagFilter(e.target.value)}
                      className="bg-accent border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="">Todas as tags</option>
                      {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                  )}
                  <button
                    onClick={() => exportToCsv('contatos.csv', filteredContacts.map(c => ({
                      nome: c.name || '',
                      username: c.username || '',
                      instagram_id: c.instagram_id,
                      email: c.email || '',
                      telefone: c.phone || '',
                      tags: (c.tags || []).join('; '),
                      ultima_interacao: c.last_response_at || '',
                      cadastrado_em: c.first_contact_at || c.created_at || '',
                    })))}
                    className="flex items-center gap-1.5 bg-accent hover:bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>
                  <span className="bg-accent border border-primary/25 text-primary font-bold text-xs px-3 py-1.5 rounded-xl">
                    {filteredContacts.length} Contatos
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-muted-foreground">
                  <thead className="text-xs uppercase text-muted-foreground font-bold border-b border-accent">
                    <tr>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Instagram</th>
                      <th className="py-3 px-4">ID do Usuário</th>
                      <th className="py-3 px-4">Dados Capturados</th>
                      <th className="py-3 px-4">Tags</th>
                      <th className="py-3 px-4">Última Interação</th>
                      <th className="py-3 px-4">Cadastrado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-accent">
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">Nenhum contato cadastrado no banco de dados até o momento.</td>
                      </tr>
                    ) : (
                      filteredContacts.map(item => (
                        <tr key={item.instagram_id || item.id} className="hover:bg-card/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-foreground text-sm">
                            {item.name || <span className="text-muted-foreground font-normal italic">Não informado</span>}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-primary">
                            {item.username ? (
                              <a
                                href={`https://instagram.com/${item.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline inline-flex items-center gap-1"
                              >
                                @{item.username}
                                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">Desconhecido</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{item.instagram_id}</td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            <div className="flex flex-col gap-0.5">
                              {item.email && <span className="text-muted-foreground">📧 {item.email}</span>}
                              {item.phone && <span className="text-muted-foreground">📱 {item.phone}</span>}
                              {!item.email && !item.phone && <span className="text-muted-foreground italic">Nenhum</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                              {(item.tags || []).map((tag: string) => (
                                <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                                  {tag}
                                  <button onClick={() => handleRemoveTag(item.instagram_id, item.tags || [], tag)} className="hover:text-destructive cursor-pointer">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                              {editingTagsFor === item.instagram_id ? (
                                <input
                                  autoFocus
                                  value={tagInputValue}
                                  onChange={e => setTagInputValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleAddTag(item.instagram_id, item.tags || [], tagInputValue);
                                      setTagInputValue('');
                                      setEditingTagsFor(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingTagsFor(null);
                                      setTagInputValue('');
                                    }
                                  }}
                                  onBlur={() => { setEditingTagsFor(null); setTagInputValue(''); }}
                                  placeholder="nova tag..."
                                  className="w-20 bg-accent border border-border rounded-full px-2 py-0.5 text-[10px] focus:outline-none focus:border-primary"
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingTagsFor(item.instagram_id)}
                                  className="w-5 h-5 rounded-full bg-accent hover:bg-muted flex items-center justify-center text-muted-foreground cursor-pointer"
                                  title="Adicionar tag"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            {item.last_response_at ? new Date(item.last_response_at).toLocaleString('pt-BR') : 'Sem interação'}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            {new Date(item.first_contact_at || item.created_at).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}

          {/* TAB 4: LOGS */}
          {activeTab === 'logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Eventos Recentes */}
              <div className="bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-foreground">
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Webhooks da Meta (Payload Bruto)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Logs em tempo real dos pacotes de eventos entregues pela Meta.</p>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {recentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10">Nenhum evento captado até o momento.</p>
                  ) : (
                    recentEvents.map(evt => (
                      <div key={evt.id} className="bg-accent border border-border p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">
                            ID: {evt.id.substring(0, 8)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(evt.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <pre className="text-[10px] text-foreground font-mono bg-card p-2.5 rounded-lg border border-border overflow-x-auto max-h-[120px]">
                          {JSON.stringify(evt.payload, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Fila de Disparos Completa */}
              <div className="bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Fila de Disparos de DMs
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Histórico e status do pipeline de entrega de mensagens.</p>
                  </div>
                  <button
                    onClick={() => exportToCsv('fila_de_disparos.csv', recentQueue.map(item => ({
                      contato: item.contact_id,
                      tipo: item.type,
                      status: item.status,
                      erro: item.error_message || '',
                      criado_em: item.created_at,
                      enviado_em: item.sent_at || '',
                    })))}
                    className="flex items-center gap-1.5 bg-accent hover:bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer transition-colors flex-shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {recentQueue.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10">Nenhuma mensagem enfileirada no banco.</p>
                  ) : (
                    recentQueue.map(item => (
                      <div key={item.id} className="bg-accent border border-border p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">
                            Destino ID: {item.contact_id.substring(0, 10)}...
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="text-xs font-semibold text-foreground">
                            {item.type === 'private_reply' && 'Resposta Privada'}
                            {item.type === 'link_dm' && 'DM de Link'}
                            {item.type === 'reminder_dm' && 'DM de Lembrete'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            item.status === 'sent' && 'bg-card text-primary border border-primary/25'
                          } ${
                            item.status === 'pending' && 'bg-card text-muted-foreground border border-border'
                          } ${
                            item.status === 'failed' && 'bg-card text-destructive border border-destructive/25'
                          }`}>
                            {item.status === 'sent' && 'Enviado'}
                            {item.status === 'pending' && 'Pendente'}
                            {item.status === 'failed' && 'Falhou'}
                          </span>
                        </div>
                        {item.error_message && (
                          <div className="text-[10px] text-destructive bg-card p-2 rounded-lg border border-destructive/25 font-mono mt-1">
                            Erro: {item.error_message}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Visual Post Selector Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xs p-4 animate-fade-in text-foreground">
          <div className="bg-card border border-accent rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-accent flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-base">Selecionar Post ou Reels</h4>
                <p className="text-xs text-muted-foreground">Escolha a publicação para esta automação.</p>
              </div>
              <button
                onClick={() => setShowMediaModal(false)}
                aria-label="Fechar seleção de publicação"
                className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Tabs */}
            <div className="flex border-b border-accent bg-card px-5 py-3 gap-2 overflow-x-auto select-none scrollbar-none">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'video', label: 'Reels' },
                { id: 'carousel', label: 'Carrossel' },
                { id: 'image', label: 'Post Estático' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMediaFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    mediaFilter === tab.id
                      ? 'bg-accent border border-primary/25 text-primary font-bold'
                      : 'bg-card border border-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal List (Lista 1 por linha com miniatura grande ao lado) */}
            <div className="p-5 overflow-y-auto flex-1 bg-background flex flex-col gap-4">
              {mediaList
                .filter(media => {
                  if (mediaFilter === 'all') return true;
                  if (mediaFilter === 'video') return media.media_type === 'VIDEO';
                  if (mediaFilter === 'carousel') return media.media_type === 'CAROUSEL_ALBUM';
                  if (mediaFilter === 'image') return media.media_type === 'IMAGE';
                  return true;
                })
                .map(media => {
                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        setForm(prev => ({ ...prev, specific_post_id: media.id }));
                        setShowMediaModal(false);
                        showToast('Post selecionado com sucesso!', 'success');
                      }}
                      className="bg-card border border-accent hover:border-primary rounded-2xl p-4 cursor-pointer group transition-all flex flex-row gap-5 items-start shadow-sm hover:shadow-md text-foreground"
                    >
                      {/* Esquerda: Imagem Grande (Capa) */}
                      <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-xl bg-accent relative overflow-hidden flex-shrink-0 border border-border">
                        <img
                          src={media.thumbnail_url || media.media_url}
                          alt="Instagram thumbnail"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute top-2 right-2 bg-background/70 backdrop-blur-md border border-foreground/10 px-2 py-0.5 rounded-lg">
                          <span className="text-[9px] text-primary font-extrabold uppercase tracking-widest">
                            {media.media_type === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : media.media_type === 'VIDEO' ? 'REELS' : 'FOTO'}
                          </span>
                        </div>
                      </div>

                      {/* Direita: Detalhes e Legenda */}
                      <div className="flex-1 flex flex-col gap-2 min-w-0 py-1">
                        <span className="text-[10px] text-muted-foreground font-mono">ID: {media.id}</span>
                        <p className="text-sm text-foreground/90 line-clamp-4 sm:line-clamp-5 leading-relaxed">
                          {media.caption || 'Sem legenda'}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 md:left-72 right-0 py-3 bg-card border-t border-border px-6 text-[10px] text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1 select-none z-30">
        <p>© 2026 GENSBot. Todos os direitos reservados.</p>
        <div className="flex items-center gap-4">
          <a href="/privacidade" target="_blank" className="hover:text-foreground transition-colors">
            Política de Privacidade
          </a>
          <a href="/exclusao-de-dados" target="_blank" className="hover:text-foreground transition-colors">
            Exclusão de Dados
          </a>
        </div>
      </footer>
    </div>
  );
}
