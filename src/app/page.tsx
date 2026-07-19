'use client';

import React, { useState, useEffect } from 'react';
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

export default function Dashboard() {
  // Configurações de estado do app
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState({ automations: 0, contacts: 0, queue: 0, events: 0 });
  const [funnel, setFunnel] = useState({ comments: 0, welcomeDms: 0, clicks: 0, leads: 0 });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentQueue, setRecentQueue] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  
  // Mídias do Instagram para o seletor visual
  const [mediaList, setMediaList] = useState<IgMedia[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'carousel' | 'image'>('all');

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

  const fetchStatusAndData = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.isConnected);
        setConfig(data.config);
        setStats(data.stats);
        setRecentEvents(data.recentEvents);
        setRecentQueue(data.recentQueue);
        setContacts(data.contacts || []);
        setFunnel(data.funnel || { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 });
      }
      
      const autRes = await fetch('/api/automations');
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

  useEffect(() => {
    fetchStatusAndData();
  }, []);

  useEffect(() => {
    if (isConnected) {
      fetch('/api/instagram/media')
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            setMediaList(data.data);
          }
        })
        .catch(err => console.error('Erro silencioso ao carregar mídias:', err));
    }
  }, [isConnected]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchChatMessages = async (contactId: string) => {
    try {
      const res = await fetch(`/api/messages?contact_id=${contactId}`);
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
      const res = await fetch('/api/messages', {
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
      const res = await fetch('/api/instagram/media');
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
      const res = await fetch('/api/cron/drain', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Fila processada! Envia: ${data.processed?.length || 0} msgs.`, 'success');
        fetchStatusAndData();
      } else {
        showToast(data.error || 'Erro ao drenar fila.', 'error');
      }
    } catch {
      showToast('Erro ao se conectar ao worker.', 'error');
    }
  };

  // Desconectar o Instagram limpando o banco
  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar esta conta do Instagram?')) return;
    try {
      const res = await fetch('/api/status', { method: 'DELETE' });
      if (res.ok) {
        showToast('Conta desconectada com sucesso.', 'success');
        fetchStatusAndData();
      } else {
        showToast('Erro ao desconectar a conta.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao desconectar.', 'error');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#07060E] text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 animate-spin text-purple-500" />
          <p className="text-zinc-400 font-medium">Carregando painel de automação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex font-sans antialiased">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg transition-all duration-300 animate-slide-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          )}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 bg-white text-slate-700 flex flex-col flex-shrink-0 select-none border-r border-slate-100">
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-650 flex items-center justify-center shadow-md shadow-violet-900/10">
            <MessageSquare className="w-4.5 h-4.5 text-white fill-white/10" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800 tracking-tight">InstaFlow</h1>
            <p className="text-[9px] text-violet-600 font-bold tracking-wider uppercase">eGrow Style</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-6">
          {/* Operações Category */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Operações</span>
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
                      ? 'bg-violet-50 text-violet-705 shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Sistema Category */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Sistema</span>
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
                      ? 'bg-violet-50 text-violet-705 shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer / Help */}
        <div className="p-4 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
          <HelpCircle className="w-4 h-4 text-slate-350" />
          <span>v1.3.0 • eGrow Edition</span>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'chat' && 'Live Chat Inbox'}
              {activeTab === 'automations' && 'Automações'}
              {activeTab === 'contacts' && 'Leads & Público'}
              {activeTab === 'logs' && 'Logs de Eventos'}
            </h2>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {activeTab === 'dashboard' && 'Bem-vindo de volta! Veja o que está acontecendo com sua automação.'}
              {activeTab === 'chat' && 'Converse em tempo real e faça atendimento manual no direct do Instagram.'}
              {activeTab === 'automations' && 'Crie e configure fluxos de funil de resposta automática.'}
              {activeTab === 'contacts' && 'Pessoas que comentaram ou iniciaram conversas com o bot.'}
              {activeTab === 'logs' && 'Histórico completo dos webhooks Meta e fila de disparos.'}
            </p>
          </div>

          {/* Connection Status Badge in Pill */}
          <div className="flex items-center gap-3">
            {isConnected && config ? (
              <div className="flex items-center gap-3 border border-slate-200 rounded-full py-1 pl-1 pr-3 bg-white shadow-xs">
                {config.profile_picture_url ? (
                  <img
                    src={config.profile_picture_url}
                    alt="Instagram Profile"
                    className="w-6.5 h-6.5 rounded-full object-cover border border-slate-100"
                  />
                ) : (
                  <div className="w-6.5 h-6.5 rounded-full bg-slate-100 flex items-center justify-center">
                    <Instagram className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                )}
                <div className="text-left leading-none">
                  <p className="text-[11px] font-bold text-slate-700">@{config.instagram_username}</p>
                  <p className="text-[9px] text-slate-405 mt-0.5">Conectado</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  title="Desconectar Conta"
                  className="ml-1 p-1 rounded-full hover:bg-slate-105 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectInstagram}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white font-bold text-xs transition-all shadow-md shadow-violet-500/10 cursor-pointer"
              >
                <Instagram className="w-3.5 h-3.5" />
                Conectar Instagram
              </button>
            )}

            <button
              onClick={handleManualDrain}
              title="Forçar Processamento da Fila"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-650" />
            </button>
          </div>
        </header>

        {/* 3. Tab-based Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#FAFAFC]">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-6">
              {/* Metric Cards Grid with Sparklines */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    label: 'Total de Automações',
                    val: stats.automations,
                    sub: 'vs últimos 30 dias',
                    trend: '↑ 14.3%',
                    colorHex: '#7C3AED',
                    wavePath: 'M0,35 Q20,10 40,30 T80,15 T120,35 T160,10'
                  },
                  {
                    label: 'Leads Gerados',
                    val: stats.contacts,
                    sub: 'vs últimos 30 dias',
                    trend: '↑ 24.5%',
                    colorHex: '#10B981',
                    wavePath: 'M0,30 Q20,40 40,15 T80,25 T120,5 T160,20'
                  },
                  {
                    label: 'Fila de Envios',
                    val: stats.queue,
                    sub: 'vs últimos 30 dias',
                    trend: '↑ 5.2%',
                    colorHex: '#F59E0B',
                    wavePath: 'M0,20 Q20,5 40,25 T80,10 T120,30 T160,5'
                  },
                  {
                    label: 'Eventos Captados',
                    val: stats.events,
                    sub: 'vs últimos 30 dias',
                    trend: '↑ 32.8%',
                    colorHex: '#3B82F6',
                    wavePath: 'M0,35 Q20,15 40,35 T80,10 T120,25 T160,15'
                  },
                ].map((item, idx) => {
                  return (
                    <div key={idx} className="bg-white border border-slate-150 rounded-2xl p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group hover:border-slate-350 transition-all h-36">
                      <div className="flex flex-col gap-1 Z-10">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.label}</span>
                        <div className="flex items-baseline gap-2.5 mt-1">
                          <span className="text-2xl font-black text-slate-800 leading-tight">{item.val}</span>
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold">
                            {item.trend}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">{item.sub}</span>
                      </div>
                      
                      {/* Premium Glowing Wave Chart Sparkline */}
                      <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden opacity-60 pointer-events-none select-none">
                        <svg className="w-full h-full" viewBox="0 0 150 40" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={item.colorHex} stopOpacity="0.25"/>
                              <stop offset="100%" stopColor={item.colorHex} stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path
                            d={item.wavePath}
                            fill={`url(#grad-${idx})`}
                            stroke={item.colorHex}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* Dashboard Layout columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connection Box / Banner */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[250px]">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Integração Oficial</span>
                    <h3 className="text-xl font-bold text-slate-800">Conecte o Instagram e inicie seu funil reativo</h3>
                    <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                      O InstaFlow monitora comentários e envia DMs estruturadas de forma automática para quem comentar nos seus posts do Instagram. O sistema respeita as regras de conformidade da Meta e o limite de segurança de disparos.
                    </p>
                  </div>
                  
                  <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-100">
                    {isConnected && config ? (
                      <div className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Sua conta comercial está vinculada e escutando webhooks!</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleConnectInstagram}
                        className="w-full sm:w-auto px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white font-bold text-sm shadow-md shadow-violet-500/10 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Instagram className="w-4 h-4" />
                        Vincular Conta do Instagram
                      </button>
                    )}
                  </div>
                </div>

                {/* Funil de Conversão Card */}
                <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                  <h4 className="font-bold text-slate-800 text-sm">Funil de Conversão (Leads)</h4>
                  <div className="flex flex-col gap-3.5">
                    {[
                      { label: 'Comentários Acionados', val: funnel.comments, color: 'bg-violet-500' },
                      { label: 'DMs de Boas-Vindas', val: funnel.welcomeDms, color: 'bg-indigo-500' },
                      { label: 'Cliques no Botão', val: funnel.clicks, color: 'bg-blue-500' },
                      { label: 'Leads Qualificados', val: funnel.leads, color: 'bg-emerald-500' }
                    ].map((step, idx, arr) => {
                      const maxVal = arr[0].val || 1;
                      const percent = Math.round((step.val / maxVal) * 100) || 0;
                      return (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-500">{step.label}</span>
                            <span className="text-slate-800 font-bold">{step.val} <span className="text-slate-400 font-medium">({percent}%)</span></span>
                          </div>
                          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${step.color} rounded-full transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Activity Overview */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Envios Pendentes / Recentes na Fila</h4>
                  <button onClick={() => setActiveTab('logs')} className="text-xs font-bold text-blue-600 hover:text-blue-500 transition-colors">
                    Ver todos os logs →
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-600">
                    <thead className="text-xs uppercase text-slate-400 font-bold border-b border-slate-100">
                      <tr>
                        <th className="py-2.5">Contato ID</th>
                        <th className="py-2.5">Tipo</th>
                        <th className="py-2.5">Agendado</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentQueue.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">Nenhum disparo na fila recentemente.</td>
                        </tr>
                      ) : (
                        recentQueue.slice(0, 5).map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-3 font-mono text-xs text-slate-400">@{item.contact_id.substring(0, 10)}...</td>
                            <td className="py-3 font-semibold text-slate-700">
                              {item.type === 'private_reply' && 'DM de Boas-Vindas'}
                              {item.type === 'link_dm' && 'DM com Link'}
                              {item.type === 'reminder_dm' && 'DM de Lembrete'}
                            </td>
                            <td className="py-3 text-xs text-slate-500">{new Date(item.created_at).toLocaleTimeString('pt-BR')}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'sent' && 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              } ${
                                item.status === 'pending' && 'bg-slate-50 text-slate-500 border border-slate-200'
                              } ${
                                item.status === 'failed' && 'bg-rose-50 text-rose-600 border border-rose-100'
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
          )}
          {/* TAB: LIVE CHAT */}
          {activeTab === 'chat' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-xs h-[calc(100vh-170px)]">
              {/* Left Contacts List */}
              <div className="lg:col-span-4 border-r border-slate-100 flex flex-col h-full overflow-hidden bg-slate-50/50">
                <div className="p-4 border-b border-slate-100 bg-white">
                  <h3 className="font-bold text-slate-800 text-sm">Conversas Recentes</h3>
                  <p className="text-[10px] text-slate-400">Clique para abrir o histórico de mensagens</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
                  {contacts.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400">Nenhum contato ativo.</div>
                  ) : (
                    contacts.map(c => {
                      const isSelected = selectedContactId === c.instagram_id;
                      return (
                        <div
                          key={c.instagram_id}
                          onClick={() => setSelectedContactId(c.instagram_id)}
                          className={`p-3.5 rounded-xl cursor-pointer transition-all flex flex-col gap-1 ${
                            isSelected
                              ? 'bg-white border border-violet-100 shadow-xs ring-1 ring-violet-500/5'
                              : 'hover:bg-slate-100/70 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
                              @{c.username || c.instagram_id}
                            </span>
                            {c.conversation_state && c.conversation_state !== 'idle' && (
                              <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 font-bold px-1.5 py-0.5 rounded-full">
                                {c.conversation_state === 'waiting_email' ? 'Aguardando E-mail' : 'Aguardando Fone'}
                              </span>
                            )}
                          </div>
                          {(c.email || c.phone) ? (
                            <div className="flex flex-col gap-0.5 text-[9px] text-slate-400 font-medium">
                              {c.email && <span>📧 {c.email}</span>}
                              {c.phone && <span>📱 {c.phone}</span>}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400">Sem dados de contato</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Chat Pane */}
              <div className="lg:col-span-8 flex flex-col h-full overflow-hidden bg-white">
                {selectedContactId ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          @{contacts.find(c => c.instagram_id === selectedContactId)?.username || selectedContactId}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-medium">
                          ID: {selectedContactId}
                        </span>
                      </div>
                      
                      {/* State status badge */}
                      {(() => {
                        const c = contacts.find(c => c.instagram_id === selectedContactId);
                        if (!c) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {c.conversation_state === 'idle' ? 'Disponível' : c.conversation_state === 'waiting_email' ? 'Lendo E-mail' : 'Lendo Fone'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Chat Message list */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#FAFAFC]/60">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-20 text-xs text-slate-400">Nenhuma mensagem registrada nesta conversa.</div>
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
                                    ? 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200'
                                    : 'bg-gradient-to-r from-violet-600 to-indigo-650 text-white rounded-tr-xs shadow-xs'
                                }`}
                              >
                                {msg.text}
                              </div>
                              <span className="text-[9px] text-slate-400 font-medium mt-1 px-1">
                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Chat Input form */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex items-center gap-2 bg-white">
                      <input
                        type="text"
                        placeholder="Digite uma mensagem para enviar..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 focus:border-violet-500 rounded-full px-4 py-2.5 text-xs focus:outline-none text-slate-800 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !chatInput.trim()}
                        className="p-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
                      >
                        <Send className="w-4.5 h-4.5 text-white" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
                    <div className="p-4 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                      <MessageSquare className="w-8 h-8 text-violet-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700">Selecione uma conversa</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                        Escolha um contato na lista à esquerda para carregar o histórico de mensagens e responder diretamente.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUTOMATIONS */}
          {activeTab === 'automations' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Side: List of Automations */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800">Minhas Automações</h3>
                  <button
                    onClick={() => {
                      resetForm();
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white px-4 py-2 rounded-full transition-all shadow-sm shadow-violet-500/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Novo Fluxo
                  </button>
                </div>

                {automations.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center gap-4 shadow-sm">
                    <div className="p-3.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200">
                      <Settings className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm">Nenhuma automação cadastrada</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                        Crie o seu primeiro fluxo usando o botão superior "Novo Fluxo".
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {automations.map(auto => {
                      const postMedia = auto.specific_post_id ? mediaList.find(m => m.id === auto.specific_post_id) : null;
                      return (
                        <div
                          key={auto.id}
                          onClick={() => handleEditAutomation(auto)}
                          className={`bg-white border p-4 rounded-2xl cursor-pointer group transition-all flex gap-3 shadow-sm items-start ${
                            form.id === auto.id && isEditing
                              ? 'border-violet-500 ring-2 ring-violet-500/10'
                              : 'border-slate-200 hover:border-slate-350'
                          }`}
                        >
                          {/* Quadradinho da imagem da publicação alvo se houver */}
                          {auto.specific_post_id && (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden relative border border-slate-150 flex-shrink-0 mt-0.5">
                              {postMedia ? (
                                <img
                                  src={postMedia.thumbnail_url || postMedia.media_url}
                                  alt="Post Capa"
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-400 bg-slate-50 text-center leading-3 p-0.5">
                                  Post Selec.
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-sm truncate flex-1">{auto.name}</span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                  auto.active
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                                }`}>
                                  {auto.active ? 'Ativo' : 'Pausado'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAutomation(auto.id!);
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Badges de Gatilhos */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {auto.triggers.map(t => {
                                let label = 'DM';
                                if (t === 'comment') label = 'Comentários';
                                if (t === 'story') label = 'Stories';
                                return (
                                  <span key={t} className="text-[9px] bg-violet-50 text-violet-750 font-extrabold px-1.5 py-0.5 rounded-md border border-violet-100 uppercase tracking-wider">
                                    {label}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Summary of Keywords */}
                            {auto.keywords.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                {auto.keywords.slice(0, 3).map((kw, i) => (
                                  <span key={i} className="text-[9px] bg-slate-50 border border-slate-200 text-slate-550 px-1.5 py-0.5 rounded font-medium font-mono">
                                    {kw}
                                  </span>
                                ))}
                                {auto.keywords.length > 3 && (
                                  <span className="text-[9px] text-slate-400 font-bold">+ {auto.keywords.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-400 italic">Sem palavra-chave</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Side: Visual Flow Builder Sequence Editor */}
              <div className="lg:col-span-8">
                {isEditing ? (
                  <form onSubmit={handleSaveAutomation} className="flex flex-col gap-6">
                    
                    {/* Header of Flow Editor */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                      <div>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nome do Fluxo (ex: Capturar Leads)"
                          className="font-bold text-slate-800 text-lg focus:outline-none border-b border-transparent focus:border-blue-500 pb-0.5"
                        />
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Configuração do Sequenciamento</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Active toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={form.active}
                            onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600 relative"></div>
                          <span className="text-xs font-bold text-slate-600">{form.active ? 'Ativo' : 'Pausado'}</span>
                        </label>

                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white font-bold text-sm shadow-md shadow-violet-500/10 cursor-pointer transition-all"
                        >
                          Salvar Fluxo
                        </button>
                      </div>
                    </div>

                    {/* VERTICAL FLOW STEP CARDS CONTAINER */}
                    <div className="flex flex-col gap-4 relative">
                      
                      {/* Step 1: Gatilho / Trigger Card */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-slate-250 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs border border-violet-100">
                            1
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Configuração de Gatilhos de Entrada</h4>
                        </div>

                        {/* Fontes do Gatilho */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-500">Fontes do Gatilho (Selecione um ou mais)</label>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {[
                              { id: 'comment', label: 'Comentários em Posts' },
                              { id: 'dm', label: 'Mensagens Diretas (DMs)' },
                              { id: 'story', label: 'Respostas / Menções nos Stories' }
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
                                      ? 'bg-violet-50 border-violet-200 text-violet-700 shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
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
                            <label className="text-xs font-bold text-slate-500">Palavras-chave (Separadas por vírgula)</label>
                            <input
                              type="text"
                              required
                              placeholder="ex: quero, cupom, info"
                              value={form.keywords.join(', ')}
                              onChange={handleKeywordsChange}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400 transition-all font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">Tipo de Correspondência (Match Type)</label>
                            <select
                              value={form.match_type}
                              onChange={e => setForm(prev => ({ ...prev, match_type: e.target.value as any }))}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-700 font-semibold cursor-pointer transition-all"
                            >
                              <option value="contains">Contém a palavra-chave</option>
                              <option value="exact">Exato (Palavra-chave exata)</option>
                              <option value="any">Qualquer comentário (Ignora palavra-chave)</option>
                            </select>
                          </div>
                        </div>

                        {/* Post target selector */}
                        <div className="flex flex-col gap-1.5 pt-1">
                          <label className="text-xs font-bold text-slate-500">Publicação Alvo (Opcional)</label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleLoadMedia}
                              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-all flex items-center gap-2"
                            >
                              {form.specific_post_id ? 'Trocar Publicação Selecionada' : 'Selecionar Post Específico'}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            {form.specific_post_id && (() => {
                              const selectedMedia = mediaList.find(m => m.id === form.specific_post_id);
                              return (
                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-150 rounded-xl p-2 animate-fade-in">
                                  {selectedMedia && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden relative border border-slate-100 flex-shrink-0">
                                      <img
                                        src={selectedMedia.thumbnail_url || selectedMedia.media_url}
                                        alt="Selected Post"
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold text-slate-700 font-mono truncate max-w-[150px]">
                                      ID: {form.specific_post_id}
                                    </span>
                                    {selectedMedia?.caption && (
                                      <span className="text-[9px] text-slate-405 truncate max-w-[180px]">
                                        {selectedMedia.caption}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, specific_post_id: null }))}
                                    className="text-xs text-rose-500 hover:text-rose-600 font-bold ml-2 cursor-pointer"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Connector Arrow */}
                      <div className="flex justify-center h-4 items-center -my-2.5 z-10 pointer-events-none">
                        <div className="h-6 w-[2px] bg-slate-200 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-l-4 after:border-r-4 after:border-t-[6px] after:border-l-transparent after:border-r-transparent after:border-t-slate-350"></div>
                      </div>

                      {/* Step 2: Resposta Pública Card */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4 relative hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                            2
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Resposta Automática no Post (Comentário público)</h4>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-500">Escreva uma frase de resposta e clique em Adicionar</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="ex: Te chamei no direct! Dá uma olhada lá."
                              value={publicReplyInput}
                              onChange={e => setPublicReplyInput(e.target.value)}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-850 placeholder-slate-400"
                            />
                            <button
                              type="button"
                              onClick={handleAddPublicReply}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>

                        {/* List of responses */}
                        {form.public_replies.length > 0 && (
                          <div className="flex flex-col gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 max-h-[160px] overflow-y-auto">
                            {form.public_replies.map((reply, index) => (
                              <div key={index} className="flex items-center justify-between gap-3 text-xs bg-white py-2 px-3.5 rounded-xl border border-slate-150 shadow-xs">
                                <span className="text-slate-700 truncate">{reply}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePublicReply(index)}
                                  className="text-slate-400 hover:text-rose-500 font-bold flex-shrink-0 cursor-pointer"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Connector Arrow */}
                      <div className="flex justify-center h-4 items-center -my-2.5 z-10 pointer-events-none">
                        <div className="h-6 w-[2px] bg-slate-200 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-l-4 after:border-r-4 after:border-t-[6px] after:border-l-transparent after:border-r-transparent after:border-t-slate-350"></div>
                      </div>

                      {/* Step 3: Mensagem DM com Quick Reply Card */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-slate-250 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs border border-violet-100">
                            3
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Mensagem Privada Inicial (DM no Direct)</h4>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">Conteúdo do primeiro Direct</label>
                            <textarea
                              required
                              placeholder="Olá! Vi seu interesse no post. Para receber o seu link de acesso, clique no botão de resposta rápida abaixo:"
                              value={form.welcome_dm}
                              onChange={e => setForm(prev => ({ ...prev, welcome_dm: e.target.value }))}
                              rows={3}
                              className="bg-slate-50 border border-slate-150 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 text-slate-800 placeholder-slate-450 transition-all resize-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">Texto do Botão de Resposta Rápida (Máx 20 caracteres)</label>
                            <input
                              type="text"
                              maxLength={20}
                              placeholder="Ex: Sim, quero!"
                              value={form.quick_reply_button || ''}
                              onChange={e => setForm(prev => ({ ...prev, quick_reply_button: e.target.value || null }))}
                              className="bg-slate-50 border border-slate-150 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 text-slate-800 placeholder-slate-400 transition-all font-semibold"
                            />
                          </div>

                          {/* Lead Capture Options */}
                          <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col gap-3">
                            <span className="text-xs font-bold text-slate-700">Captura de Leads & Integração (Opcional)</span>
                            <div className="grid grid-cols-2 gap-4">
                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.ask_email || false}
                                  onChange={e => setForm(prev => ({ ...prev, ask_email: e.target.checked }))}
                                  className="rounded border-slate-350 text-violet-650 focus:ring-violet-500 w-4 h-4"
                                />
                                <span className="text-xs text-slate-600 font-semibold">Solicitar E-mail</span>
                              </label>

                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.ask_phone || false}
                                  onChange={e => setForm(prev => ({ ...prev, ask_phone: e.target.checked }))}
                                  className="rounded border-slate-350 text-violet-650 focus:ring-violet-500 w-4 h-4"
                                />
                                <span className="text-xs text-slate-600 font-semibold">Solicitar Telefone</span>
                              </label>
                            </div>

                            {(form.ask_email || form.ask_phone) && (
                              <div className="flex flex-col gap-1.5 animate-fade-in mt-1">
                                <label className="text-[11px] font-bold text-slate-500">URL do Webhook Externo (POST para Make/Zapier)</label>
                                <input
                                  type="url"
                                  placeholder="https://hook.us1.make.com/..."
                                  value={form.webhook_url || ''}
                                  onChange={e => setForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                                  className="bg-slate-50 border border-slate-150 focus:border-violet-500 rounded-xl px-4 py-2 text-xs focus:outline-none text-slate-800 placeholder-slate-400 font-mono"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Conditional Connector Dotted Line */}
                      <div className="flex flex-col items-center -my-3 z-10 pointer-events-none select-none">
                        <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                          Se o usuário clicar no botão
                        </span>
                        <div className="h-6 w-[2px] border-l border-dashed border-blue-400 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-l-4 after:border-r-4 after:border-t-[6px] after:border-l-transparent after:border-r-transparent after:border-t-blue-500"></div>
                      </div>

                      {/* Step 4: Card de Link DM */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4 relative hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                            4
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Card de Envio do Link de Acesso</h4>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">Texto do Link</label>
                            <textarea
                              placeholder="Perfeito! Aqui está o seu link exclusivo para acessar o conteúdo completo:"
                              value={form.link_text || ''}
                              onChange={e => setForm(prev => ({ ...prev, link_text: e.target.value || null }))}
                              rows={2}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-450 transition-all resize-none"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-500">Rótulo do Botão (Ex: Acessar Conteúdo)</label>
                              <input
                                type="text"
                                maxLength={20}
                                placeholder="Acessar Conteúdo"
                                value={form.link_button_label || ''}
                                onChange={e => setForm(prev => ({ ...prev, link_button_label: e.target.value || null }))}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400 font-semibold"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-500">URL do Link</label>
                              <input
                                type="url"
                                placeholder="https://sualandingpage.com"
                                value={form.link_url || ''}
                                onChange={e => setForm(prev => ({ ...prev, link_url: e.target.value || null }))}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400 font-mono"
                              />
                            </div>
                          </div>

                          {/* Preview Card */}
                          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col gap-2.5 max-w-sm">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Visualização do Card DM</span>
                            <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-xs flex flex-col">
                              {/* Abstract image gradient */}
                              <div className="h-28 w-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 flex items-center justify-center text-white/90 text-sm font-semibold select-none">
                                Miniatura do Card
                              </div>
                              <div className="p-3 flex flex-col gap-1 border-b border-slate-100">
                                <span className="font-bold text-slate-700 text-xs truncate">{form.link_text || 'Aqui está o seu link:'}</span>
                                <span className="text-[10px] text-slate-400">Toque no botão para acessar</span>
                              </div>
                              <div className="text-center py-2 text-blue-500 font-bold text-xs select-none">
                                {form.link_button_label || 'Acessar Link'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Optional Connector */}
                      <div className="flex justify-center h-4 items-center -my-2.5 z-10 pointer-events-none">
                        <div className="h-6 w-[2px] bg-slate-200 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-l-4 after:border-r-4 after:border-t-[6px] after:border-l-transparent after:border-r-transparent after:border-t-slate-350"></div>
                      </div>

                      {/* Step 5: Lembrete Card (Opcional) */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4 relative hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-100">
                            5
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Lembrete Automático (Follow-up de Contingência)</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="flex flex-col gap-1.5 md:col-span-3">
                            <label className="text-xs font-bold text-slate-500">Mensagem de Lembrete</label>
                            <textarea
                              placeholder="Passando para avisar que o seu link expira logo. Já conseguiu dar uma olhada no conteúdo?"
                              value={form.reminder_text || ''}
                              onChange={e => setForm(prev => ({ ...prev, reminder_text: e.target.value || null }))}
                              rows={2}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-450 transition-all resize-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5 md:col-span-1">
                            <label className="text-xs font-bold text-slate-500">Tempo (Minutos)</label>
                            <input
                              type="number"
                              min={1}
                              placeholder="Minutos"
                              value={form.reminder_delay_minutes || ''}
                              onChange={e => setForm(prev => ({ ...prev, reminder_delay_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400 font-bold"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </form>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center flex flex-col items-center gap-4 shadow-sm min-h-[400px] justify-center">
                    <div className="p-4 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
                      <MessageSquare className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700">Fluxo de Automação Reativo</h4>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                        Selecione uma das suas automações listadas na barra lateral esquerda para editar a sequência de ações, ou clique em **Novo Fluxo** para desenhar um funil a partir do zero.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Audiência Cadastrada</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Lista de usuários que interagiram com as suas automações.</p>
                </div>
                <span className="bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs px-3 py-1.5 rounded-xl">
                  {contacts.length} Contatos no Total
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600">
                  <thead className="text-xs uppercase text-slate-400 font-bold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Instagram</th>
                      <th className="py-3 px-4">ID do Usuário</th>
                      <th className="py-3 px-4">Dados Capturados</th>
                      <th className="py-3 px-4">Última Interação</th>
                      <th className="py-3 px-4">Cadastrado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">Nenhum contato cadastrado no banco de dados até o momento.</td>
                      </tr>
                    ) : (
                      contacts.map(item => (
                        <tr key={item.instagram_id || item.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">
                            {item.name || <span className="text-slate-400 font-normal italic">Não informado</span>}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-violet-600">
                            {item.username ? (
                              <a
                                href={`https://instagram.com/${item.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline inline-flex items-center gap-1"
                              >
                                @{item.username}
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">Desconhecido</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{item.instagram_id}</td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            <div className="flex flex-col gap-0.5">
                              {item.email && <span className="text-slate-500">📧 {item.email}</span>}
                              {item.phone && <span className="text-slate-500">📱 {item.phone}</span>}
                              {!item.email && !item.phone && <span className="text-slate-450 italic">Nenhum</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {item.last_response_at ? new Date(item.last_response_at).toLocaleString('pt-BR') : 'Sem interação'}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {new Date(item.first_contact_at || item.created_at).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LOGS */}
          {activeTab === 'logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Eventos Recentes */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Webhooks da Meta (Payload Bruto)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Logs em tempo real dos pacotes de eventos entregues pela Meta.</p>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {recentEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">Nenhum evento captado até o momento.</p>
                  ) : (
                    recentEvents.map(evt => (
                      <div key={evt.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded font-mono">
                            ID: {evt.id.substring(0, 8)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(evt.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <pre className="text-[10px] text-slate-600 font-mono bg-white p-2.5 rounded-lg border border-slate-150 overflow-x-auto max-h-[120px]">
                          {JSON.stringify(evt.payload, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Fila de Disparos Completa */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Fila de Disparos de DMs
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Histórico e status do pipeline de entrega de mensagens.</p>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {recentQueue.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">Nenhuma mensagem enfileirada no banco.</p>
                  ) : (
                    recentQueue.map(item => (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded font-mono">
                            Destino ID: {item.contact_id.substring(0, 10)}...
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.created_at).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="text-xs font-semibold text-slate-700">
                            {item.type === 'private_reply' && 'Resposta Privada'}
                            {item.type === 'link_dm' && 'DM de Link'}
                            {item.type === 'reminder_dm' && 'DM de Lembrete'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            item.status === 'sent' && 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          } ${
                            item.status === 'pending' && 'bg-slate-100 text-slate-500 border border-slate-200'
                          } ${
                            item.status === 'failed' && 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {item.status === 'sent' && 'Enviado'}
                            {item.status === 'pending' && 'Pendente'}
                            {item.status === 'failed' && 'Falhou'}
                          </span>
                        </div>
                        {item.error_message && (
                          <div className="text-[10px] text-rose-500 bg-rose-50/50 p-2 rounded-lg border border-rose-100 font-mono mt-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-base">Selecionar Post ou Reels</h4>
                <p className="text-xs text-slate-500">Escolha a publicação para esta automação.</p>
              </div>
              <button
                onClick={() => setShowMediaModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50 px-5 py-3 gap-2 overflow-x-auto select-none scrollbar-none">
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
                      ? 'bg-violet-50 border border-violet-200 text-violet-700 font-bold'
                      : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Grid */}
            <div className="p-5 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 items-start">
              {mediaList
                .filter(media => {
                  if (mediaFilter === 'all') return true;
                  if (mediaFilter === 'video') return media.media_type === 'VIDEO';
                  if (mediaFilter === 'carousel') return media.media_type === 'CAROUSEL_ALBUM';
                  if (mediaFilter === 'image') return media.media_type === 'IMAGE';
                  return true;
                })
                .map(media => {
                  const isVideo = media.media_type === 'VIDEO';
                  
                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        setForm(prev => ({ ...prev, specific_post_id: media.id }));
                        setShowMediaModal(false);
                        showToast('Post selecionado com sucesso!', 'success');
                      }}
                      className="bg-white border border-slate-150 hover:border-violet-500 rounded-2xl overflow-hidden cursor-pointer group transition-all flex flex-col relative shadow-xs w-full"
                    >
                      <div className={`bg-slate-100 relative overflow-hidden w-full ${isVideo ? 'aspect-[9/16]' : 'aspect-square'}`}>
                        <img
                          src={media.thumbnail_url || media.media_url}
                          alt="Instagram media"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full px-2 py-0.5 text-[9px] font-bold text-white select-none z-10">
                          {media.media_type === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : media.media_type === 'VIDEO' ? 'REELS' : 'FOTO'}
                        </div>
                      </div>
                      <div className="p-3 text-xs text-slate-500 line-clamp-2 leading-relaxed bg-white border-t border-slate-50 flex-1">
                        {media.caption || <span className="text-slate-400 italic">Sem legenda</span>}
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-64 right-0 py-3 bg-white border-t border-slate-200 px-6 text-[10px] text-slate-400 flex items-center justify-between select-none z-30">
        <p>© 2026 InstaFlow. Desenvolvido no padrão de design Manychat.</p>
        <div className="flex items-center gap-4">
          <a href="/privacidade" target="_blank" className="hover:text-slate-650 transition-colors">
            Política de Privacidade
          </a>
          <a href="/exclusao-de-dados" target="_blank" className="hover:text-slate-650 transition-colors">
            Exclusão de Dados
          </a>
        </div>
      </footer>
    </div>
  );
}
