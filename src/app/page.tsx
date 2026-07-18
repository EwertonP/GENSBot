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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'automations' | 'contacts' | 'logs'>('dashboard');
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
  });
  
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

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
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
              {activeTab === 'automations' && 'Automações'}
              {activeTab === 'contacts' && 'Leads & Público'}
              {activeTab === 'logs' && 'Logs de Eventos'}
            </h2>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {activeTab === 'dashboard' && 'Bem-vindo de volta! Veja o que está acontecendo com sua automação.'}
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

                {/* Info Center Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                  <h4 className="font-bold text-slate-800">Guia de Uso Rápido</h4>
                  <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-600">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">1</div>
                      <p>Cadastre uma palavra-chave (ex: "quero") e o link de destino no menu **Automações**.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">2</div>
                      <p>Certifique-se de vincular a conta principal e de que ela está como testadora da Meta.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">3</div>
                      <p>O cliente comenta no post, recebe uma DM inicial, clica no botão e o link é liberado!</p>
                    </div>
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
                    {automations.map(auto => (
                      <div
                        key={auto.id}
                        onClick={() => handleEditAutomation(auto)}
                        className={`bg-white border p-4 rounded-2xl cursor-pointer group transition-all flex flex-col gap-3 shadow-sm ${
                          form.id === auto.id && isEditing
                            ? 'border-blue-500 ring-2 ring-blue-500/10'
                            : 'border-slate-200 hover:border-slate-350'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{auto.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
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
                              className="p-1 hover:bg-rose-50 text-slate-450 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Summary of Keywords */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {auto.keywords.slice(0, 3).map((kw, i) => (
                            <span key={i} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg font-medium font-mono">
                              {kw}
                            </span>
                          ))}
                          {auto.keywords.length > 3 && (
                            <span className="text-[9px] text-slate-400 font-bold">+ {auto.keywords.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
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
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4 relative hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                            1
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Gatilho de Comentário (Instagram Comment)</h4>
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
                            {form.specific_post_id && (
                              <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-xl py-1.5 px-3">
                                <span className="text-[10px] font-bold text-blue-600 font-mono truncate max-w-[120px]">
                                  Post: {form.specific_post_id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setForm(prev => ({ ...prev, specific_post_id: null }))}
                                  className="text-xs text-blue-500 hover:text-rose-500 font-bold ml-1 cursor-pointer"
                                >
                                  Limpar
                                </button>
                              </div>
                            )}
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
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4 relative hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
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
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-450 transition-all resize-none"
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
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400 transition-all font-semibold"
                            />
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
                      <th className="py-3 px-4">Usuário ID</th>
                      <th className="py-3 px-4">Gatilho Primário</th>
                      <th className="py-3 px-4">Última Interação</th>
                      <th className="py-3 px-4">Cadastrado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">Nenhum contato cadastrado no banco de dados até o momento.</td>
                      </tr>
                    ) : (
                      contacts.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-700">@{item.instagram_id}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-600 text-xs">
                            {item.last_automation_id ? `Fluxo: ${item.last_automation_id.substring(0, 8)}...` : 'Nenhum'}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {item.last_response_at ? new Date(item.last_response_at).toLocaleString('pt-BR') : 'Não registrado'}
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
                      ? 'bg-blue-50 border border-blue-200 text-blue-600 font-bold'
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
                  const aspectStyle = isVideo ? { aspectRatio: '9/16' } : { aspectRatio: '1/1' };
                  
                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        setForm(prev => ({ ...prev, specific_post_id: media.id }));
                        setShowMediaModal(false);
                        showToast('Post selecionado com sucesso!', 'success');
                      }}
                      className="bg-white border border-slate-200 hover:border-blue-500 rounded-2xl overflow-hidden cursor-pointer group transition-all flex flex-col relative shadow-xs"
                    >
                      <div 
                        className="bg-slate-100 relative overflow-hidden flex items-center justify-center w-full"
                        style={aspectStyle}
                      >
                        <img
                          src={media.thumbnail_url || media.media_url}
                          alt="Instagram media"
                          className="object-cover w-full h-full group-hover:scale-105 transition-all duration-300"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full px-2 py-0.5 text-[9px] font-bold text-zinc-350 select-none">
                          {media.media_type === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : media.media_type === 'VIDEO' ? 'REELS' : 'FOTO'}
                        </div>
                      </div>
                      <div className="p-2.5 text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1 bg-white">
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
