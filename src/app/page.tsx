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
  const [automations, setAutomations] = useState<Automation[]>([]);
  
  // Mídias do Instagram para o seletor visual
  const [mediaList, setMediaList] = useState<IgMedia[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'carousel' | 'image'>('all');

  // Estados do formulário de automação
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'automations' | 'logs'>('automations');
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
    <div className="min-h-screen bg-[#07060E] text-zinc-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-white">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Decorative Radial Background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-pink-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#07060E]/75 backdrop-blur-md border-b border-zinc-800/40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                InstaFlow
              </h1>
              <p className="text-xs text-zinc-500 font-semibold tracking-wide">AUTOMAÇÃO EXCLUSIVA</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isConnected && config ? (
              <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/50 rounded-full py-1.5 pl-2.5 pr-3">
                {config.profile_picture_url ? (
                  <img
                    src={config.profile_picture_url}
                    alt="Instagram Profile"
                    className="w-7 h-7 rounded-full object-cover border border-purple-500/40"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                    <Instagram className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs font-semibold text-zinc-200">@{config.instagram_username}</p>
                  <p className="text-[10px] text-zinc-500">Conectado</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  title="Desconectar Conta"
                  className="ml-1 p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectInstagram}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium text-sm transition-all shadow-lg hover:shadow-purple-500/10 cursor-pointer"
              >
                <Instagram className="w-4 h-4" />
                Conectar Instagram
              </button>
            )}

            <button
              onClick={handleManualDrain}
              title="Drenar Fila Manual"
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 transition-all hover:border-zinc-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-zinc-300" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Statistics Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Automações', val: stats.automations, sub: 'Total criadas', icon: Settings, color: 'text-purple-400' },
            { label: 'Contatos', val: stats.contacts, sub: 'Clientes engajados', icon: MessageSquare, color: 'text-pink-400' },
            { label: 'Fila de Envios', val: stats.queue, sub: 'DMs no pipeline', icon: Clock, color: 'text-amber-400' },
            { label: 'Eventos Captados', val: stats.events, sub: 'Webhooks recebidos', icon: FileText, color: 'text-blue-400' },
          ].map((item, idx) => (
            <div key={idx} className="bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-5 flex items-center justify-between backdrop-blur-xl relative overflow-hidden group hover:border-zinc-700/60 transition-all">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{item.label}</span>
                <span className="text-3xl font-black">{item.val}</span>
                <span className="text-xs text-zinc-400">{item.sub}</span>
              </div>
              <div className={`p-3 rounded-xl bg-zinc-950 border border-zinc-800/60 ${item.color}`}>
                <item.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-zinc-850/60 gap-4">
          <button
            onClick={() => setActiveTab('automations')}
            className={`pb-3.5 text-sm font-semibold tracking-wide border-b-2 px-1 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'automations'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            Minhas Automações
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3.5 text-sm font-semibold tracking-wide border-b-2 px-1 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Logs de Fila & Eventos
          </button>
        </div>

        {/* Dashboard Content */}
        {activeTab === 'automations' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Automations List */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-200">Automações Ativas</h3>
                {isEditing && (
                  <button
                    onClick={resetForm}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
                  >
                    Nova Automação
                  </button>
                )}
              </div>

              {automations.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-800/60 rounded-2xl p-12 text-center flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-zinc-950 border border-zinc-900 text-zinc-600">
                    <Settings className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-300">Nenhuma automação cadastrada</h4>
                    <p className="text-xs text-zinc-500 max-w-sm mt-1 mx-auto">
                      Use o formulário ao lado para criar o seu primeiro fluxo de resposta automática para o Instagram.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {automations.map(auto => (
                    <div
                      key={auto.id}
                      className={`bg-zinc-900/30 border rounded-2xl p-5 flex flex-col gap-4 transition-all hover:bg-zinc-900/40 relative overflow-hidden group ${
                        form.id === auto.id ? 'border-purple-500/80 bg-purple-950/5' : 'border-zinc-850/55'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-zinc-200 text-base">{auto.name}</h4>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                auto.active
                                  ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-400'
                                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                              }`}
                            >
                              {auto.active ? 'Ativo' : 'Pausado'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Gatilhos:</span>
                            {auto.triggers.map(t => (
                              <span key={t} className="text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md font-medium uppercase">
                                {t === 'comment' ? 'Comentário' : t === 'story' ? 'Story' : 'DM'}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleEditAutomation(auto)}
                            title="Editar"
                            className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 hover:text-purple-400 transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAutomation(auto.id!)}
                            title="Excluir"
                            className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 hover:text-rose-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-zinc-850/50 pt-3 text-xs">
                        <div>
                          <span className="text-zinc-500 block">Palavras-chave:</span>
                          <span className="font-semibold text-zinc-300">
                            {auto.keywords.length > 0 ? auto.keywords.join(', ') : 'Qualquer texto'}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Tipo de Match:</span>
                          <span className="font-semibold text-zinc-300 capitalize">
                            {auto.match_type === 'contains'
                              ? 'Contém'
                              : auto.match_type === 'exact'
                              ? 'Exato'
                              : 'Qualquer'}
                          </span>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-zinc-500 block">Post de Destino:</span>
                          <span className="font-semibold text-zinc-300 truncate block">
                            {auto.specific_post_id ? `ID: ${auto.specific_post_id}` : 'Todos os Posts'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Build Form */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleSaveAutomation}
                className="bg-zinc-900/30 border border-zinc-850/60 rounded-2xl p-5 flex flex-col gap-5 backdrop-blur-xl relative"
              >
                <div>
                  <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                    {isEditing ? 'Editar Automação' : 'Criar Nova Automação'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Configure o fluxo e as respostas rápidas.</p>
                </div>

                <div className="flex flex-col gap-4">
                  
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Nome da Automação</label>
                    <input
                      type="text"
                      placeholder="Ex: Lead do Reels - Black Friday"
                      value={form.name}
                      onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all"
                    />
                  </div>

                  {/* Status Toggle */}
                  <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-850/60 p-3 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-zinc-300">Automação Ativa</span>
                      <span className="text-[10px] text-zinc-500">Se desligada, o webhook irá ignorar o gatilho</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white" />
                    </label>
                  </div>

                  {/* Triggers */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-400">Gatilhos</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'comment', label: 'Comentário' },
                        { id: 'story', label: 'Story' },
                        { id: 'dm', label: 'DM Comum' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleTriggerChange(t.id)}
                          className={`py-2 px-3 border rounded-xl font-medium text-xs transition-all cursor-pointer ${
                            form.triggers.includes(t.id)
                              ? 'bg-purple-950/45 border-purple-500/60 text-purple-300 shadow-md shadow-purple-900/10'
                              : 'bg-zinc-950 border-zinc-850/60 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keywords & Match Type */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Palavras-chave (separadas por vírgula)</label>
                      <input
                        type="text"
                        placeholder="Ex: QUERO, LINK, INFO"
                        value={keywordInput}
                        onChange={handleKeywordsChange}
                        disabled={form.match_type === 'any'}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 disabled:opacity-50 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Tipo de Match</label>
                      <select
                        value={form.match_type}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            match_type: e.target.value as any,
                            keywords: e.target.value === 'any' ? [] : prev.keywords,
                          }))
                        }
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-500/80 text-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="contains">Contém</option>
                        <option value="exact">Exato</option>
                        <option value="any">Qualquer</option>
                      </select>
                    </div>
                  </div>

                  {/* Specific Post ID Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Post de Destino Específico (Opcional)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="ID do Reels ou Post da Meta (Vazio = todos)"
                        value={form.specific_post_id || ''}
                        onChange={e => setForm(prev => ({ ...prev, specific_post_id: e.target.value || null }))}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/80 text-white flex-1 transition-all"
                      />
                      {isConnected && (
                        <button
                          type="button"
                          onClick={handleLoadMedia}
                          disabled={loadingMedia}
                          className="px-4 py-3 bg-zinc-950 border border-zinc-800/80 hover:bg-zinc-900 rounded-xl text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
                        >
                          {loadingMedia ? 'Lendo...' : 'Selecionar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Public Replies (Random Comment Response) */}
                  {form.triggers.includes('comment') && (
                    <div className="flex flex-col gap-1.5 border border-zinc-850/50 p-3 rounded-xl bg-zinc-950/20">
                      <label className="text-xs font-semibold text-zinc-400">Respostas Públicas no Comentário (Opcional)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Ex: Te mandei as infos no direct! 😉"
                          value={publicReplyInput}
                          onChange={e => setPublicReplyInput(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/80 text-white flex-1 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleAddPublicReply}
                          className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>

                      {form.public_replies.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {form.public_replies.map((reply, i) => (
                            <span
                              key={i}
                              className="text-xs bg-zinc-950 border border-zinc-800/60 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-zinc-300"
                            >
                              <span className="truncate max-w-[200px]">{reply}</span>
                              <X
                                className="w-3.5 h-3.5 text-zinc-500 hover:text-rose-400 cursor-pointer flex-shrink-0"
                                onClick={() => handleRemovePublicReply(i)}
                              />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Welcome DM */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">DM de Boas-vindas (Primeiro contato)</label>
                    <textarea
                      placeholder="Olá! Que ótimo que se interessou. Para receber o link, clique no botão abaixo para confirmar:"
                      value={form.welcome_dm}
                      onChange={e => setForm(prev => ({ ...prev, welcome_dm: e.target.value }))}
                      rows={3}
                      className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all resize-none"
                    />
                  </div>

                  {/* Quick Reply Button Label */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Botão de Resposta Rápida (Máx 20 caracteres)</label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="Ex: Sim, eu quero!"
                      value={form.quick_reply_button || ''}
                      onChange={e => setForm(prev => ({ ...prev, quick_reply_button: e.target.value || null }))}
                      className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all"
                    />
                  </div>

                  {/* The Link Information (Sends after Quick Reply is clicked) */}
                  <div className="flex flex-col gap-4 border border-zinc-850/50 p-4 rounded-xl bg-zinc-950/20">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">Sequência 1: O Link (Após o clique no botão)</span>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Texto do Link</label>
                      <textarea
                        placeholder="Perfeito! Aqui está o link exclusivo para você acessar o conteúdo completo:"
                        value={form.link_text || ''}
                        onChange={e => setForm(prev => ({ ...prev, link_text: e.target.value || null }))}
                        rows={2}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Rótulo do Botão do Link</label>
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Ex: Acessar Agora 🚀"
                          value={form.link_button_label || ''}
                          onChange={e => setForm(prev => ({ ...prev, link_button_label: e.target.value || null }))}
                          className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-400">URL do Link</label>
                        <input
                          type="url"
                          placeholder="https://suapagina.com/conteudo"
                          value={form.link_url || ''}
                          onChange={e => setForm(prev => ({ ...prev, link_url: e.target.value || null }))}
                          className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reminder Information */}
                  <div className="flex flex-col gap-4 border border-zinc-850/50 p-4 rounded-xl bg-zinc-950/20">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Sequência 2: Lembrete Automático (Opcional)</span>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Texto do Lembrete</label>
                      <textarea
                        placeholder="Passando para avisar que o seu link expira logo. Já conseguiu dar uma olhada no conteúdo?"
                        value={form.reminder_text || ''}
                        onChange={e => setForm(prev => ({ ...prev, reminder_text: e.target.value || null }))}
                        rows={2}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Atraso do Lembrete (em minutos)</label>
                      <input
                        type="number"
                        min={1}
                        value={form.reminder_delay_minutes || ''}
                        onChange={e => setForm(prev => ({ ...prev, reminder_delay_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/80 text-white placeholder-zinc-600 transition-all"
                      />
                    </div>
                  </div>

                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold transition-all shadow-lg hover:shadow-purple-500/10 cursor-pointer text-center"
                  >
                    {form.id ? 'Salvar Alterações' : 'Criar Automação'}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="py-3 px-5 rounded-xl bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all text-sm cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

          </div>
        ) : (
          /* Logs Tab */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Queue Logs */}
            <div className="bg-zinc-900/30 border border-zinc-850/60 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-xl">
              <div>
                <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Fila de Disparos
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Acompanhe as mensagens agendadas e enviadas.</p>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {recentQueue.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-10">Fila vazia ou nenhuma mensagem enfileirada.</p>
                ) : (
                  recentQueue.map(item => (
                    <div key={item.id} className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-300 uppercase">{item.type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            item.status === 'sent'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'pending'
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-500/20'
                              : item.status === 'skipped'
                              ? 'bg-zinc-800 text-zinc-400'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500">User ID: {item.contact_id}</span>
                        {item.error_message && (
                          <span className="text-[11px] text-rose-400/90 font-medium italic mt-1">
                            Erro: {item.error_message}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-zinc-500">
                        <p>Criado: {new Date(item.created_at).toLocaleTimeString('pt-BR')}</p>
                        {item.sent_at && <p>Envio: {new Date(item.sent_at).toLocaleTimeString('pt-BR')}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Webhook Logs */}
            <div className="bg-zinc-900/30 border border-zinc-850/60 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-xl">
              <div>
                <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-blue-500" />
                  Eventos do Webhook (Cru)
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Log em tempo real dos payloads da API da Meta.</p>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {recentEvents.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-10">Nenhum evento captado até o momento.</p>
                ) : (
                  recentEvents.map(evt => (
                    <div key={evt.id} className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                          ID: {evt.id.substring(0, 8)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(evt.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <pre className="text-[11px] text-zinc-400 font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 overflow-x-auto max-h-[120px]">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Visual Post Selector Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0D0C16] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-850/60 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-zinc-100 text-lg">Selecionar Post ou Reels</h4>
                <p className="text-xs text-zinc-500">Escolha o post específico para esta automação.</p>
              </div>
              <button
                onClick={() => setShowMediaModal(false)}
                className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Tabs */}
            <div className="flex border-b border-zinc-900 bg-[#0A0910] px-5 py-3 gap-2 overflow-x-auto select-none scrollbar-none">
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
                      ? 'bg-purple-600/20 border border-purple-500/40 text-purple-400'
                      : 'bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200'
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
                      className="bg-zinc-950 border border-zinc-900 hover:border-purple-500 rounded-2xl overflow-hidden cursor-pointer group transition-all flex flex-col relative"
                    >
                      <div 
                        className="bg-zinc-900 relative overflow-hidden flex items-center justify-center w-full"
                        style={aspectStyle}
                      >
                        <img
                          src={media.thumbnail_url || media.media_url}
                          alt="Instagram media"
                          className="object-cover w-full h-full group-hover:scale-105 transition-all duration-300"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full px-2 py-0.5 text-[9px] font-bold text-zinc-300">
                          {media.media_type === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : media.media_type === 'VIDEO' ? 'REELS' : 'FOTO'}
                        </div>
                      </div>
                      <div className="p-2.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed flex-1 bg-zinc-950">
                        {media.caption || <span className="text-zinc-600 italic">Sem legenda</span>}
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-zinc-900 bg-[#07060E]">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 InstaFlow. Desenvolvido para automação reativa autônoma.</p>
          <div className="flex items-center gap-4">
            <a href="/privacidade" target="_blank" className="hover:text-zinc-400 transition-colors">
              Política de Privacidade
            </a>
            <a href="/exclusao-de-dados" target="_blank" className="hover:text-zinc-400 transition-colors">
              Exclusão de Dados
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
