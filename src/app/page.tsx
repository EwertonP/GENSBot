'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import Logo, { LogoMark } from '@/components/logo';
import type { Automation } from '@/types/automation';
import { buildFlowFromAdvancedForm, decompileFlow } from '@/lib/flow-engine/wizardCompiler';
import UtmLinkBuilder from '@/components/utm-link-builder';
import MetricsPanel from '@/components/metrics-panel';
import PublishPanel from '@/components/publish-panel';
import { motion } from 'motion/react';
import ContactsTab from '@/components/contacts-tab';
import InboxPanel from '@/components/inbox-panel';
import UserProfilePopover from '@/components/user-profile-popover';
import DashboardHome from '@/components/dashboard-home';
import AutomationsTab from '@/components/automations-tab';
import ClientesTab from '@/components/clientes-tab';
import EsteiraTab from '@/components/esteira-tab';
import EquipeTab from '@/components/equipe-tab';
import RotinaTab from '@/components/rotina-tab';
import CalendarioGeral from '@/components/calendario-geral';
import FormsTab from '@/components/forms-tab';
import CrmTab from '@/components/crm/crm-tab';
import WorkspaceSwitcher from '@/components/workspace-switcher';
import WorkspaceContextBar from '@/components/workspace-context-bar';
import type { WorkspaceContexto } from '@/types/workspace';
import type { Cliente, DestinoConta } from '@/lib/clientes';
import type { PrefillAgendamento } from '@/lib/conteudo';
import { Instagram } from '@/components/instagram-icon';
import type { IgMedia, IgStory } from '@/types/instagram-media';
import {
  Plus,
  CheckCircle,
  LogOut,
  Send,
  X,
  Users,
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Search,
} from 'lucide-react';
import { confirmDialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { Tip } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutomationEditor } from '@/hooks/use-automation-editor';
import { TELAS, GRUPOS_MENU, ABAS, isAbaId, type AbaId } from '@/components/nav-config';
import { CommandPalette, type ComandoItem } from '@/components/command-palette';

interface InstagramAccountSummary {
  id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  profile_picture_url: string | null;
  token_expires_at: string | null;
}

const SELECTED_ACCOUNT_STORAGE_KEY = 'gensbot_selected_account';
const WORKSPACE_STORAGE_KEY = 'gensbot_active_workspace';

export default function Dashboard() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [membroPerfil, setMembroPerfil] = useState<{ id?: string; nome?: string; cargo?: string | null; foto_url?: string | null; papel: string; cliente_id: string | null } | null>(null);

  // Configurações de estado do app
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<any>(null);

  // Workspace e Clientes Globais
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [workspaceAtivo, setWorkspaceAtivo] = useState<WorkspaceContexto>({
    tipo: 'agencia',
    clienteId: null,
    nome: 'Agência GENS',
    instagramAccountId: null,
    instagramUserId: 'all',
    instagramUsername: null,
  });

  // Seletor de múltiplas contas do Instagram conectadas ao mesmo login
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [prefillAgendamento, setPrefillAgendamento] = useState<PrefillAgendamento | null>(null);
  const [itemFocoId, setItemFocoId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('item')
  );
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
  const {
    isEditing,
    setIsEditing,
    form,
    setForm,
    keywordInput,
    setKeywordInput,
    publicReplyInput,
    setPublicReplyInput,
    qualificationSteps,
    setQualificationSteps,
    wizardCondition,
    setWizardCondition,
    activeBranchTab,
    setActiveBranchTab,
    wizardIncompatibleReason,
    setWizardIncompatibleReason,
    hadFlowDefinition,
    setHadFlowDefinition,
    pendingConditionSplitIndex,
    setPendingConditionSplitIndex,
    legacyTail,
    handleLegacyTailChange,
    addCondition,
    removeCondition,
    handleTriggerChange,
    handleKeywordsChange,
    handleAddPublicReply,
    handleRemovePublicReply,
    resetForm,
    podeSairDaEdicao,
    setIsEditingProtegido,
  } = useAutomationEditor();
  
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
  const [generatingTrackedLink, setGeneratingTrackedLink] = useState(false);

  const [utmLinks, setUtmLinks] = useState<any[]>([]);
  const [selectedUtmLinkId, setSelectedUtmLinkId] = useState('');
  // A tela ativa vive na URL (?tab=…&item=…): recarregar mantém a tela, o
  // voltar do navegador funciona e dá pra mandar o link de uma demanda.
  const [activeTab, setActiveTab] = useState<AbaId>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const t = new URLSearchParams(window.location.search).get('tab');
    return isAbaId(t) ? t : 'dashboard';
  });
  const [paletteAberta, setPaletteAberta] = useState(false);
  const [trocandoConta, setTrocandoConta] = useState(false);
  const [novaDemandaSinal, setNovaDemandaSinal] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gensbot_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('gensbot_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Ctrl/Cmd+B recolhe a sidebar (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b' || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      e.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // O script inline do layout já aplicou o tema (preferência salva ou do SO);
    // aqui só sincronizamos o estado do toggle com a classe real do <html>.
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gensbot_theme', nextTheme);
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // Mensagens de alerta/sucesso

  // Layout states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // No celular o menu abre sempre expandido — o modo compacto é só de desktop.
  const sidebarCompacta = isSidebarCollapsed && !isMobileMenuOpen;

  // Garante que qualquer troca de tela, aba ou conta inicie sempre no topo da página
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelectorAll('main, body, html, [data-scroll-container]').forEach((el) => {
        el.scrollTop = 0;
      });
    }
  }, [activeTab, isEditing, flowBuilderAutomation?.id, selectedAccountId]);

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
  // Busca contas do Instagram E clientes da agência para unificar o Workspace global
  const loadAccountsAndClients = async (preferredAccountId?: string | null, preferredClienteId?: string | null) => {
    try {
      const [resAccounts, resClientes, resMe] = await Promise.all([
        fetch('/api/instagram/accounts').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/clientes').then((r) => (r.ok ? r.json() : { clientes: [] })),
        fetch('/api/membros/me').then((r) => (r.ok ? r.json() : null)),
      ]);

      const dataAccounts: InstagramAccountSummary[] = Array.isArray(resAccounts) ? resAccounts : [];
      const dataClientes: Cliente[] = Array.isArray(resClientes?.clientes) ? resClientes.clientes : [];
      const dataMembro = resMe?.membro || null;

      if (dataMembro) {
        setMembroPerfil(dataMembro);
      }

      setAccounts(dataAccounts);
      setClientes(dataClientes);

      // Determina o Workspace inicial
      let nextWs: WorkspaceContexto | null = null;

      // 0. Prioridade Absoluta: Se o usuário é um cliente externo (secretária/equipe do cliente)
      if (dataMembro?.papel === 'cliente' && dataMembro.cliente_id) {
        const cli = dataClientes.find((c) => c.id === dataMembro.cliente_id) || dataMembro.cliente;
        if (cli) {
          const igAcc = cli.instagram_account_id
            ? dataAccounts.find((a) => a.id === cli.instagram_account_id)
            : null;
          nextWs = {
            tipo: 'cliente',
            clienteId: cli.id,
            nome: cli.nome,
            nicho: cli.nicho,
            cor: cli.cor,
            fotoUrl: cli.foto_url || igAcc?.profile_picture_url,
            instagramAccountId: cli.instagram_account_id || null,
            instagramUserId: igAcc?.instagram_user_id || null,
            instagramUsername: igAcc?.instagram_username || null,
          };
          // Força a aba inicial para 'crm' se estiver em qualquer aba restrita à agência
          setActiveTab((prev) => (prev === 'contacts' || prev === 'crm' || prev === 'inbox' ? prev : 'crm'));
        }
      }

      // 1. Prioridade: Se veio cliente na URL ?cliente=<id> (apenas para membros da agência)
      if (!nextWs && preferredClienteId) {
        if (preferredClienteId === 'agencia') {
          nextWs = {
            tipo: 'agencia',
            clienteId: null,
            nome: 'Agência GENS',
            instagramAccountId: null,
            instagramUserId: 'all',
            instagramUsername: null,
          };
        } else {
          const cli = dataClientes.find((c) => c.id === preferredClienteId);
          if (cli) {
            const igAcc = cli.instagram_account_id
              ? dataAccounts.find((a) => a.id === cli.instagram_account_id)
              : null;
            nextWs = {
              tipo: 'cliente',
              clienteId: cli.id,
              nome: cli.nome,
              nicho: cli.nicho,
              cor: cli.cor,
              fotoUrl: cli.foto_url || igAcc?.profile_picture_url,
              instagramAccountId: cli.instagram_account_id || null,
              instagramUserId: igAcc?.instagram_user_id || null,
              instagramUsername: igAcc?.instagram_username || null,
            };
          }
        }
      }

      // 2. Prioridade: Restaurar do localStorage
      if (!nextWs && typeof window !== 'undefined') {
        const storedWs = localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (storedWs) {
          try {
            const parsed = JSON.parse(storedWs);
            if (parsed.tipo === 'cliente' && parsed.clienteId) {
              const cli = dataClientes.find((c) => c.id === parsed.clienteId);
              if (cli) {
                const igAcc = cli.instagram_account_id
                  ? dataAccounts.find((a) => a.id === cli.instagram_account_id)
                  : null;
                nextWs = {
                  tipo: 'cliente',
                  clienteId: cli.id,
                  nome: cli.nome,
                  nicho: cli.nicho,
                  cor: cli.cor,
                  fotoUrl: cli.foto_url || igAcc?.profile_picture_url,
                  instagramAccountId: cli.instagram_account_id || null,
                  instagramUserId: igAcc?.instagram_user_id || null,
                  instagramUsername: igAcc?.instagram_username || null,
                };
              }
            } else if (parsed.tipo === 'agencia') {
              nextWs = {
                tipo: 'agencia',
                clienteId: null,
                nome: 'Agência GENS',
                instagramAccountId: null,
                instagramUserId: 'all',
                instagramUsername: null,
              };
            }
          } catch {}
        }
      }

      // 3. Fallback: Se não encontrou, inicia como Agência GENS
      if (!nextWs) {
        nextWs = {
          tipo: 'agencia',
          clienteId: null,
          nome: 'Agência GENS',
          instagramAccountId: null,
          instagramUserId: dataAccounts.length > 1 ? 'all' : (dataAccounts[0]?.instagram_user_id || 'all'),
          instagramUsername: null,
        };
      }

      setWorkspaceAtivo(nextWs);
      const accId = nextWs.instagramUserId || 'all';
      setSelectedAccountId(accId);

      await fetchStatusAndData(accId);
    } catch (err) {
      console.error('Erro ao carregar contas e clientes:', err);
      setLoading(false);
    }
  };

  const handleSelectWorkspace = (ws: WorkspaceContexto) => {
    setWorkspaceAtivo(ws);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(ws));
    }

    const accId = ws.instagramUserId || 'all';
    handleSelectAccount(accId);
  };

  const handleUpdateUserProfile = async (name: string, avatarUrl: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: name, avatar_url: avatarUrl }
      });
      if (error) throw error;
      if (data.user) {
        setCurrentUser(data.user);
        showToast('Perfil atualizado com sucesso!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar perfil.', 'error');
    }
  };

  const handleSelectAccount = (accountId: string) => {
    setAccountMenuOpen(false);
    if (accountId === selectedAccountId) return;
    setSelectedAccountId(accountId);
    if (typeof window !== 'undefined') localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, accountId);
    setTrocandoConta(true);
    setMediaList([]);
    Promise.resolve(fetchStatusAndData(accountId)).finally(() => setTrocandoConta(false));
  };

  useEffect(() => {
    // Get current authenticated user on load
    supabase.auth.getUser().then((res: { data: { user: any } }) => {
      const user = res?.data?.user;
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUser(user);
      }
    });

    const params = new URLSearchParams(window.location.search);
    const accountFromRedirect = params.get('account');
    const clienteFromRedirect = params.get('cliente');
    loadAccountsAndClients(accountFromRedirect, clienteFromRedirect);
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

  // Mantém a assinatura antiga que as abas recebem por prop; por baixo usa o
  // gerenciador global (fila, pausa no hover, swipe) — ver ui/toast.tsx.
  const showToast = (message: string, type: 'success' | 'error') => {
    if (type === 'error') toast.error(message);
    else toast.success(message);
  };

  /**
   * Única porta de navegação entre telas: confere edição não salva, fecha o
   * menu do celular, atualiza a URL (histórico do navegador) e o foco.
   */
  const navegarPara = async (tab: AbaId, opts: { item?: string | null; replace?: boolean } = {}) => {
    if (membroPerfil?.papel === 'cliente' && tab !== 'crm' && tab !== 'contacts' && tab !== 'inbox') {
      showToast('Acesso restrito ao CRM e Contatos da sua conta.', 'error');
      return false;
    }
    if (!(await podeSairDaEdicao())) return false;
    if (opts.item) setItemFocoId(opts.item);
    setActiveTab(tab);
    setIsEditing(false);
    setIsMobileMenuOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    url.searchParams.delete('item');
    url.searchParams.delete('account');
    if (opts.item) url.searchParams.set('item', opts.item);
    window.history[opts.replace ? 'replaceState' : 'pushState']({ tab }, '', url);
    return true;
  };

  // Voltar/avançar do navegador troca de tela.
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      setActiveTab(isAbaId(t) ? t : 'dashboard');
      setItemFocoId(params.get('item'));
      setIsEditing(false);
      setIsMobileMenuOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setIsEditing]);

  // Ctrl/⌘+K abre a busca rápida de qualquer lugar (inclusive de dentro de campos).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteAberta((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    if (!(await confirmDialog({title: "Excluir esta automação?",description: "Ela para de responder imediatamente. O histórico de contatos continua salvo.",confirmLabel: "Excluir automação",tone: "destructive"}))) return;
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
    if (!(await confirmDialog({ title: `Desconectar @${account?.instagram_username || selectedAccountId}?`, description: 'As automações dessa conta param de responder até você conectá-la de novo.', confirmLabel: 'Desconectar', tone: 'destructive' }))) return;

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
      // Esqueleto com o formato real do shell: sidebar + cabeçalho + cards,
      // em vez de spinner solto — a tela "chega" sem salto de layout.
      <div role="status" aria-label="Carregando o GENSBot" className="h-screen w-screen flex bg-background">
        <div className="hidden md:flex w-64 shrink-0 flex-col gap-3 border-r border-sidebar-border bg-sidebar p-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-12 w-full mt-2" />
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <div className="flex-1 flex flex-col gap-6 p-6 md:p-8">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const itensBusca: ComandoItem[] = [
    ...ABAS.map((id) => ({
      id: `tela-${id}`,
      label: TELAS[id].label,
      hint: TELAS[id].grupo === 'instagram' ? 'Instagram' : TELAS[id].grupo === 'admin' ? 'Administração' : 'Agência',
      grupo: 'Ir para',
      icon: TELAS[id].icon,
      keywords: TELAS[id].titulo,
      run: () => navegarPara(id),
    })),
    {
      id: 'acao-nova-demanda',
      label: 'Nova demanda',
      grupo: 'Ações',
      icon: Plus,
      keywords: 'criar post reel conteudo esteira',
      run: async () => {
        if (await navegarPara('esteira')) setNovaDemandaSinal((n) => n + 1);
      },
    },
    {
      id: 'acao-novo-agendamento',
      label: 'Agendar publicação',
      grupo: 'Ações',
      icon: Send,
      keywords: 'publicar post story reels agendar',
      run: () => navegarPara('publish'),
    },
    {
      id: 'acao-nova-automacao',
      label: 'Nova automação',
      grupo: 'Ações',
      icon: TELAS.automations.icon,
      keywords: 'fluxo direct comentario dm',
      run: async () => {
        if (!(await navegarPara('automations'))) return;
        resetForm();
        setIsEditing(true);
      },
    },
    {
      id: 'acao-tema',
      label: theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro',
      grupo: 'Ações',
      icon: theme === 'dark' ? Sun : Moon,
      keywords: 'tema dark light escuro claro',
      run: toggleTheme,
    },
    ...(accounts.length > 1
      ? [
          {
            id: 'conta-all',
            label: 'Visão da agência (todas as contas)',
            grupo: 'Trocar de conta',
            icon: Instagram,
            run: () => handleSelectAccount('all'),
          },
        ]
      : []),
    ...accounts.map((acc) => ({
      id: `conta-${acc.instagram_user_id}`,
      label: `@${acc.instagram_username || acc.instagram_user_id}`,
      hint: acc.instagram_user_id === selectedAccountId ? 'atual' : undefined,
      grupo: 'Trocar de conta',
      icon: Instagram,
      run: () => handleSelectAccount(acc.instagram_user_id),
    })),
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-foreground font-sans antialiased">
      <CommandPalette open={paletteAberta} onOpenChange={setPaletteAberta} itens={itensBusca} />
      {/* Overlay para o Menu Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 1. Left Sidebar Navigation — 100% fixa em tela inteira */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 ${sidebarCompacta ? 'w-20' : 'w-72'} h-full bg-sidebar text-muted-foreground flex flex-col flex-shrink-0 select-none border-r border-sidebar-border transition-[width,translate] duration-300 ease-out-expo ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Brand & Workspace Header */}
        <div className={`p-4 pb-3 flex flex-col gap-2 ${sidebarCompacta ? 'items-center px-2' : ''}`}>
          <div className={`flex items-center ${sidebarCompacta ? 'flex-col gap-3 justify-center' : 'justify-between px-2'} pt-1`}>
            <div className="flex items-center gap-2">
              {sidebarCompacta ? (
                <LogoMark className="w-8 h-8 rounded-xl shadow-2xs" />
              ) : (
                <>
                  <Logo className="h-6.5 w-auto" />
                  <span className="text-xs font-bold text-muted-foreground bg-accent px-1.5 py-0.5 rounded border border-border">
                    2.0
                  </span>
                </>
              )}
            </div>
            
            <Tip label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} shortcut="Ctrl+B" side="right">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-expanded={!isSidebarCollapsed}
              className="hidden md:inline-flex p-1.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {sidebarCompacta ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
            </Tip>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Fechar menu"
              className="md:hidden size-10 inline-flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seletor Unificado de Workspace & Cliente */}
          <div className="mt-2 w-full">
            <WorkspaceSwitcher
              workspaceAtivo={workspaceAtivo}
              clientes={clientes}
              accounts={accounts}
              onSelectWorkspace={handleSelectWorkspace}
              onNovoCliente={() => navegarPara('clientes')}
              compacto={sidebarCompacta}
              bloqueado={membroPerfil?.papel === 'cliente'}
            />
          </div>

          {accounts.length === 0 && (
            <Tip label="Conectar Instagram">
              <button
                onClick={handleConnectInstagram}
                className={`mt-2 w-full flex items-center justify-center ${sidebarCompacta ? 'p-2.5' : 'gap-2 px-3 py-2.5'} rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-ui shadow-xs cursor-pointer`}
              >
                <Instagram className="w-3.5 h-3.5 flex-shrink-0" />
                {!sidebarCompacta && <span>Conectar Instagram</span>}
              </button>
            </Tip>
          )}
        </div>

        <div className="border-t border-sidebar-border mx-3" />

        {/* Navigation Links — Linear-inspired grouping */}
        <nav className={`flex-1 ${sidebarCompacta ? 'px-2 py-4' : 'px-3 py-4'} flex flex-col gap-4 overflow-y-auto`}>
          {membroPerfil?.papel === 'cliente' ? (
            <div className="flex flex-col gap-1">
              {!sidebarCompacta && (
                <span className="text-xs font-medium text-muted-foreground px-3 mb-0.5 truncate">
                  Portal do Cliente
                </span>
              )}
              {[
                { id: 'crm' as AbaId, label: 'CRM de Vendas', icon: TELAS.crm.icon },
                { id: 'inbox' as AbaId, label: 'Mensagens & Inbox', icon: TELAS.inbox.icon },
                { id: 'contacts' as AbaId, label: 'Contatos & Leads', icon: TELAS.contacts.icon },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <Tip key={item.id} label={item.label} side="right" disabled={!sidebarCompacta}>
                    <button
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      aria-label={sidebarCompacta ? item.label : undefined}
                      onClick={() => navegarPara(item.id)}
                      className={`relative w-full flex items-center ${sidebarCompacta ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-3 md:py-2'} rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                        active
                          ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                      }`}
                    >
                      {active && <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-sidebar-primary" />}
                      <Icon className={`relative w-4 h-4 flex-shrink-0 ${active ? 'text-sidebar-primary' : 'text-muted-foreground'}`} />
                      {!sidebarCompacta && <span className="relative truncate">{item.label}</span>}
                    </button>
                  </Tip>
                );
              })}
            </div>
          ) : (
            GRUPOS_MENU.map((g) => ({
              label: g.id === 'instagram'
                ? `Instagram · ${selectedAccountId && selectedAccountId !== 'all' ? '@' + (config?.instagram_username || '…') : 'todas as contas'}`
                : g.label,
              items: ABAS.filter((id) => TELAS[id].grupo === g.id).map((id) => ({ id, label: TELAS[id].label, icon: TELAS[id].icon })),
            })).map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {!sidebarCompacta ? (
                group.label && (
                  <span className="text-xs font-medium text-muted-foreground px-3 mb-0.5 truncate">
                    {group.label}
                  </span>
                )
              ) : (
                gi > 0 && <div className="border-t border-sidebar-border my-1 mx-2" />
              )}
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;

                return (
                  <Tip key={item.id} label={item.label} side="right" disabled={!sidebarCompacta}>
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    aria-label={sidebarCompacta ? item.label : undefined}
                    onClick={() => navegarPara(item.id)}
                    className={`relative w-full flex items-center ${sidebarCompacta ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-3 md:py-2'} rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                      active
                        ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    }`}
                  >
                    {/* Indicador de tela ativa (estilo Linear): a cor de marca aparece só aqui */}
                    {active && <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-sidebar-primary" />}
                    <Icon className={`relative w-4 h-4 flex-shrink-0 ${active ? 'text-sidebar-primary' : 'text-muted-foreground'}`} />
                    {!sidebarCompacta && <span className="relative truncate">{item.label}</span>}
                  </button>
                  </Tip>
                );
              })}
            </div>
          )))}
        </nav>

        {/* Sidebar Footer: Perfil Único do Usuário Master na Sidebar */}
        <div className={`p-3 border-t border-sidebar-border ${sidebarCompacta ? 'flex justify-center p-2' : ''}`}>
          {currentUser && (
            <UserProfilePopover
              membroId={membroPerfil?.id}
              userName={membroPerfil?.nome || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Agência GENS'}
              userEmail={currentUser?.email || 'contato@agenciagens.com'}
              userRole={membroPerfil?.cargo || (membroPerfil?.papel === 'master' ? 'Diretor / Sócio' : 'Membro da Equipe')}
              avatarUrl={membroPerfil?.foto_url || currentUser?.user_metadata?.avatar_url}
              onNavigate={(tab) => {
                if (isAbaId(tab)) navegarPara(tab);
              }}
              onLogout={handleAppLogout}
              onUpdateProfile={handleUpdateUserProfile}
              direction="up"
            />
          )}
        </div>
      </aside>

      {/* Main Content Area — Scroll independente */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto relative">

        {/* Mobile Top Bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-1.5 bg-card/90 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="-ml-2 size-10 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <span className="text-sm font-semibold font-display text-foreground truncate">{TELAS[activeTab].titulo}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteAberta(true)}
              aria-label="Busca rápida"
              className="size-10 inline-flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <Tip label={theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'} side="bottom">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para o Modo Claro' : 'Mudar para o Dark Mode'}
              className="size-10 rounded-xl bg-card hover:bg-accent border border-border text-foreground transition-ui duration-150 cursor-pointer shadow-2xs flex items-center justify-center"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-primary animate-in spin-in-180 duration-200" />
              ) : (
                <Moon className="w-4 h-4 text-foreground animate-in spin-in-180 duration-200" />
              )}
            </button>
            </Tip>

            {/* Avatar do Usuário Mobile com Popover */}
            {currentUser && (
              <UserProfilePopover
                membroId={membroPerfil?.id}
                userName={membroPerfil?.nome || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Agência GENS'}
                userEmail={currentUser?.email || 'contato@agenciagens.com'}
                userRole={membroPerfil?.cargo || (membroPerfil?.papel === 'master' ? 'Diretor / Sócio' : 'Membro da Equipe')}
                avatarUrl={membroPerfil?.foto_url || currentUser?.user_metadata?.avatar_url}
                onNavigate={(tab) => {
                  if (isAbaId(tab)) navegarPara(tab);
                }}
                onLogout={handleAppLogout}
                onUpdateProfile={handleUpdateUserProfile}
                direction="down"
                align="right"
                variant="avatar"
              />
            )}
          </div>
        </div>

        {/* Top Header Bar — Com Respiro Padronizado e Ações Rápidas (Estilo Imagens de Referência) */}
        <header className="hidden md:flex sticky top-0 z-30 min-h-[64px] py-3 px-6 sm:px-8 items-center justify-between flex-shrink-0 bg-background/90 backdrop-blur-md border-b border-border shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold font-display text-foreground tracking-tight">{TELAS[activeTab].titulo}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {TELAS[activeTab].subtitulo}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteAberta(true)}
              className="hidden lg:flex items-center gap-2 h-9 pl-3 pr-2 rounded-xl border border-border-strong bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer min-w-56"
            >
              <Search aria-hidden className="w-4 h-4" />
              <span className="flex-1 text-left">Buscar ou ir para…</span>
              <kbd className="rounded border border-border-strong bg-muted px-1.5 text-xs">Ctrl K</kbd>
            </button>
            <Tip label="Busca rápida" shortcut="Ctrl+K" side="bottom">
              <button
                type="button"
                onClick={() => setPaletteAberta(true)}
                aria-label="Busca rápida"
                className="lg:hidden p-2 rounded-xl bg-card hover:bg-accent border border-border text-foreground cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </Tip>

            {/* Alternador Simples de Tema (Dark / Light) */}
            <Tip label={theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'} side="bottom">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para o Modo Claro' : 'Mudar para o Dark Mode'}
              className="p-2 rounded-xl bg-card hover:bg-accent border border-border text-foreground transition-ui duration-200 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 flex items-center justify-center"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-primary animate-in spin-in-180 duration-200" />
              ) : (
                <Moon className="w-4 h-4 text-foreground animate-in spin-in-180 duration-200" />
              )}
            </button>
            </Tip>

            {/* Botão Criar Demanda em Pílula (Estilo Imagens 1 & 2) */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'esteira') navegarPara('esteira');
                setNovaDemandaSinal((prev) => prev + 1);
              }}
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-ui cursor-pointer shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Criar</span>
            </button>

            {/* Avatar do Usuário Master com Popover Flutuante rounded-3xl (Imagens 1 & 2) */}
            {currentUser && (
              <UserProfilePopover
                membroId={membroPerfil?.id}
                userName={membroPerfil?.nome || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Agência GENS'}
                userEmail={currentUser?.email || 'contato@agenciagens.com'}
                userRole={membroPerfil?.cargo || (membroPerfil?.papel === 'master' ? 'Diretor / Sócio' : 'Membro da Equipe')}
                avatarUrl={membroPerfil?.foto_url || currentUser?.user_metadata?.avatar_url}
                onNavigate={(tab) => {
                  if (isAbaId(tab)) navegarPara(tab);
                }}
                onLogout={handleAppLogout}
                onUpdateProfile={handleUpdateUserProfile}
                direction="down"
                align="right"
                variant="avatar"
              />
            )}
          </div>
        </header>

        {/* 3. Tab-based Content Area — Respiro Visual Harmonioso */}
        {trocandoConta && (
          <div role="status" aria-label="Trocando de conta" className="sticky top-0 z-40 h-0.5 w-full overflow-hidden">
            <div className="h-full w-1/3 bg-primary animate-[progresso_1.1s_ease-in-out_infinite]" />
          </div>
        )}
        <main aria-busy={trocandoConta} className="flex-1 p-4 sm:p-6 md:p-8 bg-background max-w-7xl 2xl:max-w-[1800px] 3xl:max-w-[2200px] w-full mx-auto space-y-6">
          {/* Entrada só com opacidade e sem esperar a saída da tela anterior: a troca
              é imediata (interrompível) e, com "reduzir movimento", segue sendo só fade. */}
          <p className="md:hidden -mt-1 text-sm text-muted-foreground">{TELAS[activeTab].subtitulo}</p>

          {/* Barra de Contexto Global Ativo (Agência vs Cliente Selecionado) */}
          <WorkspaceContextBar
            workspace={workspaceAtivo}
            onTrocarWorkspace={() => navegarPara('clientes')}
            abaAtual={activeTab}
          />

          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
              onNavigateTab={(tab, itemId) => {
                if (isAbaId(tab)) navegarPara(tab, { item: itemId });
              }}
              onNovaDemanda={async () => {
                if (await navegarPara('esteira')) setNovaDemandaSinal((n) => n + 1);
              }}
            />
          )}
          {/* TAB 2: AUTOMATIONS */}
          {activeTab === 'automations' && (
            <AutomationsTab
              isAggregateView={isAggregateView}
              automations={automations}
              setAutomations={setAutomations}
              isEditing={isEditing}
              setIsEditing={setIsEditingProtegido}
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

          {/* TAB: PUBLISH (Agendamentos) */}
          {activeTab === 'publish' && (
            <div className="animate-fade-in max-w-5xl mx-auto">
              <PublishPanel
                accounts={accounts.map((acc) => ({ id: acc.id, instagram_user_id: acc.instagram_user_id, instagram_username: acc.instagram_username }))}
                selectedAccountId={selectedAccountId}
                workspace={workspaceAtivo}
                withAccount={withAccount}
                prefillData={prefillAgendamento}
                onClearPrefill={() => setPrefillAgendamento(null)}
              />
            </div>
          )}

          {/* TAB: ROTINA & AFAZERES DA AGÊNCIA */}
          {activeTab === 'rotina' && (
            <RotinaTab showToast={showToast} onAbrirDemanda={(itemId) => navegarPara('esteira', { item: itemId })} />
          )}

          {/* TAB: CLIENTES — a espinha do sistema unificado */}
          {activeTab === 'clientes' && (
            <ClientesTab
              showToast={showToast}
              onAbrirConta={(destino: DestinoConta, instagramUserId: string) => {
                // Sincroniza o Workspace Global com o cliente selecionado
                const cli = clientes.find((c) => {
                  const acc = accounts.find((a) => a.instagram_user_id === instagramUserId);
                  return acc && c.instagram_account_id === acc.id;
                });

                if (cli) {
                  const acc = accounts.find((a) => a.instagram_user_id === instagramUserId);
                  handleSelectWorkspace({
                    tipo: 'cliente',
                    clienteId: cli.id,
                    nome: cli.nome,
                    nicho: cli.nicho,
                    cor: cli.cor,
                    fotoUrl: cli.foto_url || acc?.profile_picture_url,
                    instagramAccountId: cli.instagram_account_id || null,
                    instagramUserId,
                    instagramUsername: acc?.instagram_username || null,
                  });
                } else {
                  handleSelectAccount(instagramUserId);
                }
                navegarPara(destino);
              }}
            />
          )}

          {/* TAB: ESTEIRA DE DEMANDAS & APROVAÇÃO */}
          {activeTab === 'esteira' && (
            <EsteiraTab
              showToast={showToast}
              clienteFiltroId={workspaceAtivo.tipo === 'cliente' ? workspaceAtivo.clienteId : null}
              itemFocoId={itemFocoId}
              onClearItemFoco={() => setItemFocoId(null)}
              novaDemandaSinal={novaDemandaSinal}
              onIrParaAgendamento={(prefill) => {
                setPrefillAgendamento(prefill);
                navegarPara('publish');
              }}
            />
          )}

          {/* TAB: CALENDÁRIO GERAL DA AGÊNCIA */}
          {activeTab === 'calendario_geral' && (
            <CalendarioGeral
              showToast={showToast}
              onAbrirDemanda={(itemId) => navegarPara('esteira', { item: itemId })}
              onIrParaAgendamento={(prefill) => {
                setPrefillAgendamento(prefill);
                navegarPara('publish');
              }}
            />
          )}

          {/* TAB: FORMULÁRIOS (TYPEFORM BUILDER) */}
          {activeTab === 'forms' && (
            <FormsTab
              clientes={clientes.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor ?? undefined }))}
              clienteSelecionado={workspaceAtivo.tipo === 'cliente' ? workspaceAtivo.clienteId : 'all'}
            />
          )}

          {/* TAB: CRM DE VENDAS */}
          {activeTab === 'crm' && (
            <CrmTab
              showToast={showToast}
              clienteSelecionado={workspaceAtivo.tipo === 'cliente' ? workspaceAtivo.clienteId : null}
            />
          )}

          {/* TAB: EQUIPE & SÓCIOS */}
          {activeTab === 'equipe' && (
            <EquipeTab showToast={showToast} />
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <ContactsTab withAccount={withAccount} showToast={showToast} accountKey={selectedAccountId || 'none'} />
          )}

          {/* TAB: INBOX (Mensagens Unificadas: Direct + WhatsApp) */}
          {activeTab === 'inbox' && (
            <div className="animate-fade-in">
              <InboxPanel
                withAccount={withAccount}
                clienteId={workspaceAtivo.tipo === 'cliente' ? workspaceAtivo.clienteId : (membroPerfil?.cliente_id || null)}
                papelUsuario={membroPerfil?.papel as any}
              />
            </div>
          )}
          </motion.div>

        </main>
        
        {/* Footer integrado no final da página */}
        <footer className="py-4 bg-card/60 border-t border-border px-8 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 select-none mt-auto">
          <p>© 2026 GENSBot · Agência GENS. Todos os direitos reservados.</p>
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
    </div>
  );
}
