'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import ThemeToggle from '@/components/theme-toggle';
import Logo from '@/components/logo';
import type { Automation } from '@/types/automation';
import { buildFlowFromAdvancedForm, decompileFlow, type QualificationStep, type WizardCondition, type WizardTail } from '@/lib/flow-engine/wizardCompiler';
import UtmLinkBuilder from '@/components/utm-link-builder';
import MetricsPanel from '@/components/metrics-panel';
import PublishPanel from '@/components/publish-panel';
import KanbanBoard from '@/components/kanban-board';
import CalendarView from '@/components/calendar-view';
import { Sheet } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import ContactsTab from '@/components/contacts-tab';
import SequenceManager from '@/components/sequence-manager';
import CrmBoard from '@/components/crm-board';
import InboxPanel from '@/components/inbox-panel';
import LogsTab from '@/components/logs-tab';
import DashboardHome from '@/components/dashboard-home';
import AutomationsTab from '@/components/automations-tab';
import { Instagram } from '@/components/instagram-icon';
import type { IgMedia, IgStory } from '@/types/instagram-media';
import {
  Settings,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  LogOut,
  Send,
  X,
  FileCode,
  Lock,
  Home,
  Users,
  BarChart3,
  HelpCircle,
  MessageCircle,
  Link2,
  TrendingUp,
  Layers,
  Building2,
} from 'lucide-react';

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
  const [stats, setStats] = useState({ automations: 0, contacts: 0, automationsTriggered: 0, events: 0, leadsGenerated: 0 });
  const [funnel, setFunnel] = useState({ comments: 0, welcomeDms: 0, clicks: 0, leads: 0 });
  const [weeklyChart, setWeeklyChart] = useState<{ day: string; comments: number; dms: number }[]>([]);
  const [weeklyChartMax, setWeeklyChartMax] = useState(1);
  const [health, setHealth] = useState({ sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false });
  const [trends, setTrends] = useState<{ contacts: number | null; automations: number | null; automationsTriggered: number | null; events: number | null; leadsGenerated: number | null }>({ contacts: null, automations: null, automationsTriggered: null, events: null, leadsGenerated: null });
  const [failureDiagnostics, setFailureDiagnostics] = useState<{ reason: string; count: number }[]>([]);
  const [automationRanking, setAutomationRanking] = useState<{ id: string; name: string; comments: number; welcomeDms: number; clicks: number; leads: number }[]>([]);
  const [tokenHealth, setTokenHealth] = useState<{ instagram_user_id: string; instagram_username: string | null; daysRemaining: number | null; status: 'ok' | 'warning' | 'expired' | 'unknown' }[]>([]);
  const [alerts, setAlerts] = useState<{ level: 'critical' | 'warning'; message: string }[]>([]);
  const [isAggregateView, setIsAggregateView] = useState(false);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentQueue, setRecentQueue] = useState<any[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  // Editor visual (canvas) — coexiste com o form linear abaixo; abre em tela cheia quando preenchido.
  const [flowBuilderAutomation, setFlowBuilderAutomation] = useState<Automation | null>(null);
  const [qualificationSteps, setQualificationSteps] = useState<QualificationStep[]>([]);
  
  // Mídias do Instagram para o seletor visual
  const [mediaList, setMediaList] = useState<IgMedia[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'carousel' | 'image'>('all');

  // Stories ativas do Instagram (só as das últimas 24h ficam disponíveis)
  const [storyList, setStoryList] = useState<IgStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);

  // Dashboard Chart States
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(3);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | 'month'>('7d');

  // Estados do formulário de automação
  const [isEditing, setIsEditing] = useState(false);
  const [generatingTrackedLink, setGeneratingTrackedLink] = useState(false);
  // Preenchidos ao abrir uma automação existente pra edição — ver handleEditAutomation.
  // wizardIncompatibleReason != null quando o flow_definition usa recursos que só o
  // Canvas sabe editar (ramificação, múltiplas saídas, etc.); nesse caso o Formulário
  // Avançado não deixa salvar por cima, pra não substituir o fluxo real por um errado.
  const [wizardIncompatibleReason, setWizardIncompatibleReason] = useState<string | null>(null);
  const [hadFlowDefinition, setHadFlowDefinition] = useState(false);
  // Bifurcação única do Formulário Avançado (v1 — perguntas antes do split ficam em
  // `qualificationSteps`, cada ramo é independente). null = fluxo linear normal.
  const [wizardCondition, setWizardCondition] = useState<WizardCondition | null>(null);
  const [activeBranchTab, setActiveBranchTab] = useState<'true' | 'false'>('true');
  const [utmLinks, setUtmLinks] = useState<any[]>([]);
  const [selectedUtmLinkId, setSelectedUtmLinkId] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'automations' | 'utm' | 'metrics' | 'publish' | 'contacts' | 'sequences' | 'crm' | 'inbox' | 'logs'>('dashboard');
  // Sub-abas de "Agendamentos" (Onda 1) — Publicações é a lista/composer que já existia,
  // Calendário e Kanban são novos, mesma fonte de dado (scheduled_posts).
  const [publishSubTab, setPublishSubTab] = useState<'publicacoes' | 'calendario' | 'kanban'>('publicacoes');
  const [form, setForm] = useState<Automation>({
    name: '',
    active: true,
    triggers: ['comment'],
    keywords: [],
    match_type: 'contains',
    specific_post_id: null,
    specific_story_id: null,
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
        setFunnel(data.funnel || { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 });
        setWeeklyChart(data.weeklyChart || []);
        setWeeklyChartMax(data.weeklyChartMax || 1);
        setHealth(data.health || { sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false });
        setTrends(data.trends || { contacts: null, automations: null, automationsTriggered: null, events: null, leadsGenerated: null });
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

  // Gera um link UTM com rastreamento de clique (redirect via src/app/r/[code])
  // já vinculado a esta automação, e substitui a URL do link final pelo link
  // curto — os cliques passam a contar no ranking de automações do dashboard.
  // Só funciona em automações já salvas (precisa do id pra vincular).
  const handleGenerateTrackedLink = async () => {
    if (!form.id) {
      showToast('Salve a automação primeiro pra poder gerar um link com rastreamento.', 'error');
      return;
    }
    if (!form.link_url) {
      showToast('Preencha a URL do link antes de gerar o rastreamento.', 'error');
      return;
    }
    setGeneratingTrackedLink(true);
    try {
      const res = await fetch(withAccount('/api/utm-links'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.name || 'Automação'} - link final`,
          base_url: form.link_url,
          utm_source: 'instagram',
          utm_medium: 'dm_automation',
          utm_campaign: form.name || null,
          automation_id: form.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.short_url) {
        setForm(prev => ({ ...prev, link_url: data.short_url }));
        showToast('Link com rastreamento gerado e aplicado.', 'success');
      } else {
        showToast(data.error || 'Erro ao gerar o link com rastreamento.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao gerar o link com rastreamento.', 'error');
    } finally {
      setGeneratingTrackedLink(false);
    }
  };

  // Usa um link UTM já existente como o link final desta automação. Como o
  // link final aponta pro redirect curto (não pro destino direto), editar o
  // link UTM depois (na tela de Links UTM) muda o destino pra todo mundo que
  // já recebeu esse link — inclusive quem já rodou a automação antes — sem
  // precisar reabrir e salvar a automação de novo.
  const handleSelectUtmLink = async (utmLinkId: string) => {
    setSelectedUtmLinkId(utmLinkId);
    if (!utmLinkId) return;

    const link = utmLinks.find(l => l.id === utmLinkId);
    if (!link) return;

    setForm(prev => ({ ...prev, link_url: link.short_url || link.generated_url }));

    // Vincula o link a esta automação (pra contar no ranking) só quando a
    // automação já existe — sem id ainda não tem o que vincular no banco.
    if (form.id && link.automation_id !== form.id) {
      try {
        await fetch(withAccount(`/api/utm-links/${utmLinkId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ automation_id: form.id }),
        });
        setUtmLinks(prev => prev.map(l => l.id === utmLinkId ? { ...l, automation_id: form.id } : l));
      } catch {
        // Falhar em vincular não deve travar a seleção do link — o botão ainda
        // funciona, só não conta na aba de ranking até vincular manualmente.
      }
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

  // Carrega os links UTM já criados (dessa conta) quando o editor de automação
  // abre, pra alimentar o seletor "usar um link já criado" no card de Link DM.
  useEffect(() => {
    if (!isEditing) return;
    fetch(withAccount('/api/utm-links'))
      .then(res => res.json())
      .then(data => setUtmLinks(Array.isArray(data) ? data.filter((l: any) => l.instagram_user_id === selectedAccountId) : []))
      .catch(err => console.error('Erro silencioso ao carregar links UTM:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Atualiza o dashboard (KPIs, gráficos, fila, diagnósticos) sozinho a cada
  // 15s enquanto a aba estiver ativa — evita ter que apertar reload pra ver
  // dados novos chegando de automações disparando em produção.
  useEffect(() => {
    if (!isConnected || activeTab !== 'dashboard') return;
    const interval = setInterval(() => {
      fetchStatusAndData();
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, activeTab, selectedAccountId]);

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
      'instagram_business_manage_insights',
      'instagram_business_content_publish',
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

  const handleLoadStories = async () => {
    // Diferente de posts, stories expiram — sempre busca de novo em vez de
    // usar cache, pra não mostrar uma story que já sumiu.
    setLoadingStories(true);
    try {
      const res = await fetch(withAccount('/api/instagram/stories'));
      const data = await res.json();
      if (res.ok && data.data) {
        setStoryList(data.data);
        setShowStoryModal(true);
      } else {
        showToast(data.error || 'Erro ao carregar stories do Instagram.', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao carregar stories.', 'error');
    } finally {
      setLoadingStories(false);
    }
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.welcome_dm) {
      showToast('Preencha pelo menos o Nome e a DM de Boas-vindas.', 'error');
      return;
    }
    if (wizardIncompatibleReason) {
      showToast('Esta automação usa recursos que só o editor visual (Canvas) sabe editar — abra por lá pra continuar.', 'error');
      return;
    }

    try {
      const method = form.id ? 'PUT' : 'POST';
      const endpoint = form.id ? `/api/automations/${form.id}` : '/api/automations';
      // Automações que já eram baseadas em flow continuam sendo, mesmo com zero
      // perguntas agora (ex: só mensagem inicial + link) — só cai pro modelo legado
      // (flow_definition null) quando a automação nunca teve flow e continua sem
      // nenhuma pergunta. Sem isso, editar e salvar por aqui apagava o fluxo inteiro.
      const flow_definition = (qualificationSteps.length > 0 || hadFlowDefinition || wizardCondition)
        ? buildFlowFromAdvancedForm(form, qualificationSteps, wizardCondition)
        : null;
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, flow_definition }),
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

  // Abre uma automação existente no Formulário Avançado. Quando ela já tem
  // flow_definition, tenta reconstruir os campos do form + as perguntas de
  // qualificação a partir do fluxo de verdade (decompileFlow) — antes disso o
  // form sempre abria com as perguntas zeradas, então editar e salvar por aqui
  // trocava silenciosamente o fluxo real (com ramificação, esperas etc.) por
  // um simplificado. Fluxos fora do que o Formulário Avançado sabe representar
  // (ramificação condicional, múltiplas saídas...) ficam marcados como
  // incompatíveis — o form mostra um aviso e bloqueia salvar por cima.
  const handleEditAutomation = (auto: Automation) => {
    setIsEditing(true);
    setWizardIncompatibleReason(null);
    setHadFlowDefinition(!!auto.flow_definition);
    setWizardCondition(null);
    setActiveBranchTab('true');

    if (auto.flow_definition) {
      const result = decompileFlow(auto.flow_definition);
      if (result.compatible) {
        const merged: Automation = { ...auto, ...result.form };
        setForm(merged);
        setKeywordInput(merged.keywords.join(', '));
        setQualificationSteps(result.questions);
        setWizardCondition(result.condition);
        return;
      }
      setWizardIncompatibleReason(result.reason);
    }

    setForm(auto);
    setKeywordInput(auto.keywords.join(', '));
    setQualificationSteps([]);
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
      specific_story_id: null,
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
    setQualificationSteps([]);
    setWizardIncompatibleReason(null);
    setHadFlowDefinition(false);
    setWizardCondition(null);
    setActiveBranchTab('true');
  };

  // --- Bifurcação do Formulário Avançado (v1) ---------------------------
  // Sem condição, `qualificationSteps` + `form.link_*`/`followups` continuam
  // sendo a única cauda do fluxo (comportamento 100% igual a antes). Com
  // condição, essa cauda "legada" só existe até o ponto do split — o resto
  // vive em `wizardCondition.trueBranch`/`falseBranch`, independentes.
  const legacyTail: WizardTail = {
    questions: qualificationSteps,
    link_text: form.link_text || '',
    link_url: form.link_url ?? null,
    link_button_label: form.link_button_label ?? null,
    followups: form.followups || [],
  };

  const handleLegacyTailChange = (updater: (prev: WizardTail) => WizardTail) => {
    const next = updater(legacyTail);
    setQualificationSteps(next.questions);
    setForm(prev => ({ ...prev, link_text: next.link_text, link_url: next.link_url, link_button_label: next.link_button_label, followups: next.followups }));
  };

  const [pendingConditionSplitIndex, setPendingConditionSplitIndex] = useState(0);

  const addCondition = (splitIndex: number) => {
    const sharedTail: WizardTail = {
      questions: qualificationSteps.slice(splitIndex),
      link_text: form.link_text || '',
      link_url: form.link_url ?? null,
      link_button_label: form.link_button_label ?? null,
      followups: form.followups || [],
    };
    setQualificationSteps(qualificationSteps.slice(0, splitIndex));
    setWizardCondition({
      splitAfterIndex: splitIndex,
      condition: { conditionType: 'keyword', keywords: [], match_type: 'contains' },
      // clones independentes — editar um ramo não pode vazar pro outro.
      trueBranch: structuredClone(sharedTail),
      falseBranch: structuredClone(sharedTail),
    });
    setActiveBranchTab('true');
  };

  const removeCondition = () => {
    if (!wizardCondition) return;
    if (!confirm('Remover a condição descarta todo o ramo "Se falso" (perguntas, link e follow-ups configurados nele). O ramo "Se verdadeiro" vira o fluxo normal. Quer continuar?')) return;
    setQualificationSteps(prev => [...prev, ...wizardCondition.trueBranch.questions]);
    setForm(prev => ({
      ...prev,
      link_text: wizardCondition.trueBranch.link_text,
      link_url: wizardCondition.trueBranch.link_url,
      link_button_label: wizardCondition.trueBranch.link_button_label,
      followups: wizardCondition.trueBranch.followups,
    }));
    setWizardCondition(null);
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
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-card text-foreground shadow-lg"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay para o Menu Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 1. Left Sidebar Navigation (Off-canvas no mobile) */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-sidebar/90 backdrop-blur-2xl md:bg-sidebar md:backdrop-blur-none text-muted-foreground flex flex-col flex-shrink-0 select-none border-r border-sidebar-border transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Brand Header */}
        <div className="px-6 pt-6 pb-4 flex items-center">
          <Logo className="h-8" />
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
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                          <span className="text-xs font-semibold text-foreground flex-1 truncate">
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
                          <span className="text-xs font-semibold text-foreground flex-1 truncate">
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
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent text-primary text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Conectar outra conta
                      </button>
                      {selectedAccountId !== 'all' && (
                        <button
                          onClick={() => { setAccountMenuOpen(false); handleDisconnect(); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent text-destructive text-xs font-bold cursor-pointer"
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

        {/* Navigation Links — agrupados por intenção (não mais uma lista rasa
            só "Operações"/"Sistema"), no espírito da sidebar do Linear: cada
            grupo responde uma pergunta diferente do dia a dia da agência. */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-6">
          {[
            { label: null, items: [{ id: 'dashboard', label: 'Dashboard', icon: BarChart3 }] },
            {
              label: 'Conteúdo',
              items: [
                { id: 'publish', label: 'Agendamentos', icon: Send },
                { id: 'metrics', label: 'Métricas', icon: TrendingUp },
              ],
            },
            {
              label: 'Relacionamento',
              items: [
                { id: 'automations', label: 'Automações', icon: Settings },
                { id: 'contacts', label: 'Contatos / Leads', icon: Users },
                { id: 'inbox', label: 'Inbox', icon: MessageCircle },
                { id: 'sequences', label: 'Sequências', icon: Layers },
              ],
            },
            {
              label: 'Prospecção',
              items: [
                { id: 'crm', label: 'CRM', icon: Building2 },
                { id: 'utm', label: 'Links UTM', icon: Link2 },
              ],
            },
            { label: 'Sistema', items: [{ id: 'logs', label: 'Logs de Eventos', icon: FileCode }] },
          ].map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {group.label && (
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-4 mb-2">{group.label}</span>
              )}
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsEditing(false);
                    }}
                    className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
                      active ? 'text-primary font-bold' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-active-pill"
                        className="absolute inset-0 bg-primary/10 rounded-xl"
                        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                      />
                    )}
                    <Icon className={`relative w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="relative">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Usuário logado no GENSBot + Sair */}
        <div className="p-4 border-t border-sidebar-border flex flex-col gap-3">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>v1.3.0 • eGrow Edition</span>
            </div>
            <ThemeToggle />
          </div>
          {currentUser && (
            <div className="flex items-center gap-2 rounded-2xl bg-muted p-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/30 flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
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
      <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-background w-full relative">

        {/* Mobile Top Bar (Só aparece em telas pequenas) — chrome translúcido, fixo, conteúdo passa por baixo */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-card/80 backdrop-blur-xl relative after:content-[''] after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-background/40 after:to-transparent after:pointer-events-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <Logo className="h-6" />
          </div>
          {/* Avatar na top bar mobile */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/30 flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md">
            {currentUser?.email?.substring(0, 1).toUpperCase()}
          </div>
        </div>

        {/* Top Header Bar — sticky + translúcido, conteúdo da aba passa por baixo ao rolar */}
        <header className="hidden md:flex sticky top-0 z-30 h-16 px-6 items-center justify-between flex-shrink-0 bg-background/75 backdrop-blur-xl relative after:content-[''] after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-background/40 after:to-transparent after:pointer-events-none">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'automations' && 'Automações'}
              {activeTab === 'utm' && 'Links UTM'}
              {activeTab === 'metrics' && 'Métricas'}
              {activeTab === 'publish' && 'Agendamentos'}
              {activeTab === 'contacts' && 'Leads & Público'}
              {activeTab === 'sequences' && 'Sequências'}
              {activeTab === 'crm' && 'CRM'}
              {activeTab === 'inbox' && 'Inbox'}
              {activeTab === 'logs' && 'Logs de Eventos'}
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {activeTab === 'dashboard' && 'Bem-vindo de volta! Veja o que está acontecendo com sua automação.'}
              {activeTab === 'automations' && 'Crie e configure fluxos de funil de resposta automática.'}
              {activeTab === 'utm' && 'Gere links rastreáveis pra saber de onde vêm seus leads.'}
              {activeTab === 'metrics' && 'Acompanhe o desempenho de cada perfil conectado.'}
              {activeTab === 'publish' && 'Publique, agende e aprove posts, reels e stories das contas conectadas.'}
              {activeTab === 'contacts' && 'Pessoas que comentaram ou iniciaram conversas com o bot.'}
              {activeTab === 'sequences' && 'Séries de mensagens reutilizáveis entre automações.'}
              {activeTab === 'crm' && 'Leads de prospecção da agência, ligado ao Prospecção Gens.'}
              {activeTab === 'inbox' && 'Converse manualmente com quem já interagiu com o bot.'}
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

        {/* 3. Tab-based Content Area — a rolagem agora acontece no container pai (acima), pra
             o header sticky ter conteúdo de verdade passando por baixo dele */}
        <main className="flex-1 p-6 pb-14 bg-background">
          <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardHome
              alerts={alerts}
              stats={stats}
              trends={trends}
              chartPeriod={chartPeriod}
              setChartPeriod={setChartPeriod}
              weeklyChart={weeklyChart}
              weeklyChartMax={weeklyChartMax}
              hoveredBarIndex={hoveredBarIndex}
              setHoveredBarIndex={setHoveredBarIndex}
              health={health}
              funnel={funnel}
              recentQueue={recentQueue}
              failureDiagnostics={failureDiagnostics}
              automationRanking={automationRanking}
              selectedAccountId={selectedAccountId}
              withAccount={withAccount}
              onViewLogs={() => setActiveTab('logs')}
            />
          )}
          {/* TAB 2: AUTOMATIONS */}
          {activeTab === 'automations' && (
            <AutomationsTab
              isAggregateView={isAggregateView}
              automations={automations}
              setAutomations={setAutomations}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              resetForm={resetForm}
              handleEditAutomation={handleEditAutomation}
              handleDeleteAutomation={handleDeleteAutomation}
              flowBuilderAutomation={flowBuilderAutomation}
              setFlowBuilderAutomation={setFlowBuilderAutomation}
              form={form}
              setForm={setForm}
              handleSaveAutomation={handleSaveAutomation}
              wizardIncompatibleReason={wizardIncompatibleReason}
              keywordInput={keywordInput}
              handleKeywordsChange={handleKeywordsChange}
              handleLoadMedia={handleLoadMedia}
              mediaList={mediaList}
              handleLoadStories={handleLoadStories}
              loadingStories={loadingStories}
              storyList={storyList}
              publicReplyInput={publicReplyInput}
              setPublicReplyInput={setPublicReplyInput}
              handleAddPublicReply={handleAddPublicReply}
              handleRemovePublicReply={handleRemovePublicReply}
              showToast={showToast}
              qualificationSteps={qualificationSteps}
              setQualificationSteps={setQualificationSteps}
              pendingConditionSplitIndex={pendingConditionSplitIndex}
              setPendingConditionSplitIndex={setPendingConditionSplitIndex}
              addCondition={addCondition}
              removeCondition={removeCondition}
              wizardCondition={wizardCondition}
              setWizardCondition={setWizardCondition}
              activeBranchTab={activeBranchTab}
              setActiveBranchTab={setActiveBranchTab}
              legacyTail={legacyTail}
              handleLegacyTailChange={handleLegacyTailChange}
              utmLinks={utmLinks}
              selectedUtmLinkId={selectedUtmLinkId}
              handleSelectUtmLink={handleSelectUtmLink}
              handleGenerateTrackedLink={handleGenerateTrackedLink}
              generatingTrackedLink={generatingTrackedLink}
              config={config}
              showMediaModal={showMediaModal}
              setShowMediaModal={setShowMediaModal}
              mediaFilter={mediaFilter}
              setMediaFilter={setMediaFilter}
              showStoryModal={showStoryModal}
              setShowStoryModal={setShowStoryModal}
            />
          )}
          {/* TAB: UTM LINKS */}
          {activeTab === 'utm' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
              <UtmLinkBuilder withAccount={withAccount} />
            </div>
          )}

          {/* TAB: METRICS */}
          {activeTab === 'metrics' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
              <MetricsPanel selectedAccountId={selectedAccountId} withAccount={withAccount} />
            </div>
          )}

          {/* TAB: PUBLISH (Agendamentos — Onda 1: Publicações / Calendário / Kanban) */}
          {activeTab === 'publish' && (
            <div className="animate-fade-in max-w-5xl mx-auto">
              <div className="flex gap-1.5 mb-5 bg-muted p-1 rounded-xl w-fit">
                {[
                  { id: 'publicacoes' as const, label: 'Publicações' },
                  { id: 'calendario' as const, label: 'Calendário' },
                  { id: 'kanban' as const, label: 'Kanban' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPublishSubTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      publishSubTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {publishSubTab === 'publicacoes' && (
                <PublishPanel
                  accounts={accounts.map((acc) => ({ instagram_user_id: acc.instagram_user_id, instagram_username: acc.instagram_username }))}
                  selectedAccountId={selectedAccountId}
                  withAccount={withAccount}
                />
              )}
              {publishSubTab === 'calendario' && (
                <CalendarView
                  accounts={accounts.map((acc) => ({ instagram_user_id: acc.instagram_user_id, instagram_username: acc.instagram_username }))}
                  selectedAccountId={selectedAccountId}
                  withAccount={withAccount}
                  showToast={showToast}
                />
              )}
              {publishSubTab === 'kanban' && (
                <KanbanBoard
                  accounts={accounts.map((acc) => ({ instagram_user_id: acc.instagram_user_id, instagram_username: acc.instagram_username }))}
                  selectedAccountId={selectedAccountId}
                  withAccount={withAccount}
                  showToast={showToast}
                />
              )}
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <ContactsTab withAccount={withAccount} showToast={showToast} accountKey={selectedAccountId || 'none'} />
          )}

          {/* TAB: SEQUENCES */}
          {activeTab === 'sequences' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
              <SequenceManager />
            </div>
          )}

          {/* TAB: CRM (Onda 4) */}
          {activeTab === 'crm' && (
            <div className="animate-fade-in">
              <CrmBoard />
            </div>
          )}

          {/* TAB: INBOX (Onda 5) */}
          {activeTab === 'inbox' && (
            <div className="animate-fade-in">
              <InboxPanel withAccount={withAccount} />
            </div>
          )}

          {/* TAB 4: LOGS */}
          {activeTab === 'logs' && (
            <LogsTab recentEvents={recentEvents} recentQueue={recentQueue} showToast={showToast} />
          )}
          </motion.div>
          </AnimatePresence>

        </main>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 md:left-72 right-0 py-3 bg-card border-t border-border px-6 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1 select-none z-30">
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
