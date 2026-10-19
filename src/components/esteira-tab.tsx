'use client';
import { ScrollShadow } from '@/components/ui/scroll-shadow';
import { DataTable } from '@/components/ui/data-table';
import { IconButton } from '@/components/ui/icon-button';
import { Tip } from '@/components/ui/tooltip';
import { AvatarGroup } from '@/components/ui/avatar';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Plus,
  Search,
  Columns3,
  Layers,
  Send,
  MessageSquare,
  Clock,
  ExternalLink,
  Share2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Sparkles,
  Grid3X3,
  Edit2,
  Loader2,
  Paperclip,
  MoreHorizontal,
  AlertCircle,
} from 'lucide-react';
import { Menu } from '@base-ui/react/menu';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { OnboardingBar } from '@/components/onboarding-bar';
import { FeedPreviewGrid } from '@/components/feed-preview-grid';
import {
  STATUS_LABELS,
  COLUNAS_KANBAN,
  mapearStatusParaColunaKanban,
  PRIORIDADE_CONFIG,
  ehResponsavel,
  idsResponsaveis,
  dataLocal,
  ehDataSemHora,
  type ConteudoItem,
  type StatusConteudo,
  type ArquivoConteudo,
  type PrefillAgendamento,
  compararPorData,
} from '@/lib/conteudo';
import { detectarGatilhosDaLegenda } from '@/lib/publish-automation';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';
import { uploadMediaFile } from '@/lib/storage-upload';
import { MoverEtapaMenu } from '@/components/mover-etapa-menu';
import { DuplicarMesSheet } from '@/components/esteira-duplicar-mes-sheet';
import { AprovacaoWhatsappSheet } from '@/components/esteira-aprovacao-whatsapp-sheet';
import { DemandaSheet, ETAPAS_PIPELINE, getEtapaIndex } from '@/components/demanda-sheet';

export { ETAPAS_PIPELINE, getEtapaIndex };

export function formatarDataCurta(dataStr?: string | null): string {
  if (!dataStr) return '';
  try {
    const d = new Date(dataStr.includes('T') ? dataStr : `${dataStr}T12:00:00`);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

const COLUNA_CONFIG: Record<
  StatusConteudo,
  {
    corPill: string;
    dot: string;
    bordaColuna: string;
    fundoColuna: string;
  }
> = {
  planejamento: {
    corPill: 'bg-muted/80 text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
    bordaColuna: 'border-border/70',
    fundoColuna: 'bg-accent/20',
  },
  criacao_arte: {
    corPill: 'bg-info-soft text-info border-info-ring',
    dot: 'bg-info',
    bordaColuna: 'border-info/20',
    fundoColuna: 'bg-info-soft/20',
  },
  revisao_interna: {
    corPill: 'bg-warning-soft text-warning border-warning-ring',
    dot: 'bg-warning',
    bordaColuna: 'border-warning/20',
    fundoColuna: 'bg-warning-soft/20',
  },
  revisao_cliente: {
    corPill: 'bg-brand-soft text-brand-text border-brand-ring',
    dot: 'bg-brand-solid',
    bordaColuna: 'border-brand-ring/40',
    fundoColuna: 'bg-brand-soft/20',
  },
  agendamento: {
    corPill: 'bg-primary/15 text-primary border-primary/30',
    dot: 'bg-primary',
    bordaColuna: 'border-primary/25',
    fundoColuna: 'bg-primary/5',
  },
  publicado: {
    corPill: 'bg-success-soft text-success border-success-ring',
    dot: 'bg-success',
    bordaColuna: 'border-success/20',
    fundoColuna: 'bg-success-soft/20',
  },
  copy: {
    corPill: 'bg-info-soft text-info border-info-ring',
    dot: 'bg-info',
    bordaColuna: 'border-info/20',
    fundoColuna: 'bg-info-soft/20',
  },
  em_gravacao: {
    corPill: 'bg-info-soft text-info border-info-ring',
    dot: 'bg-info',
    bordaColuna: 'border-info/20',
    fundoColuna: 'bg-info-soft/20',
  },
  em_edicao: {
    corPill: 'bg-info-soft text-info border-info-ring',
    dot: 'bg-info',
    bordaColuna: 'border-info/20',
    fundoColuna: 'bg-info-soft/20',
  },
  revisao_arte: {
    corPill: 'bg-warning-soft text-warning border-warning-ring',
    dot: 'bg-warning',
    bordaColuna: 'border-warning/20',
    fundoColuna: 'bg-warning-soft/20',
  },
  travado: {
    corPill: 'bg-destructive/15 text-destructive border-destructive/30',
    dot: 'bg-destructive',
    bordaColuna: 'border-destructive/20',
    fundoColuna: 'bg-destructive/5',
  },
  revisao_agendamento: {
    corPill: 'bg-primary/15 text-primary border-primary/30',
    dot: 'bg-primary',
    bordaColuna: 'border-primary/25',
    fundoColuna: 'bg-primary/5',
  },
  pronto_publicar: {
    corPill: 'bg-primary/15 text-primary border-primary/30',
    dot: 'bg-primary',
    bordaColuna: 'border-primary/25',
    fundoColuna: 'bg-primary/5',
  },
};

interface EsteiraTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  clienteFiltroId?: string | null;
  itemFocoId?: string | null;
  onClearItemFoco?: () => void;
  onIrParaAgendamento?: (prefill: PrefillAgendamento) => void;
  /** Incrementa pra abrir "Nova demanda" de fora (busca rápida, dashboard). */
  novaDemandaSinal?: number;
}

export default function EsteiraTab({
  showToast,
  clienteFiltroId,
  itemFocoId,
  onClearItemFoco,
  onIrParaAgendamento,
  novaDemandaSinal = 0,
}: EsteiraTabProps) {
  const [items, setItems] = useState<ConteudoItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  // Principal + co-responsáveis, na ordem, com nome resolvido pela equipe carregada.
  const pessoasResponsaveis = (item: ConteudoItem) =>
    idsResponsaveis(item)
      .map((id) => (id === item.responsavel?.id ? item.responsavel : membros.find((m) => m.id === id)))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({ nome: m.nome, foto_url: 'foto_url' in m ? (m.foto_url as string | null | undefined) : null }));
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [clienteSelecionado, setClienteSelecionado] = useState<string>(clienteFiltroId || 'all');
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>('all');
  const [busca, setBusca] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'feed'>('kanban');
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [ocultarPublicados, setOcultarPublicados] = useState(true);

  // Drag and Drop state
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingOverCol, setDraggingOverCol] = useState<StatusConteudo | null>(null);
  const [draggingOverItemId, setDraggingOverItemId] = useState<string | null>(null);

  // Modal da demanda: o mesmo componente cria e edita (DemandaSheet). `chave`
  // muda a cada abertura para o formulário começar do zero; fechar só baixa
  // `aberto`, mantendo a animação de saída.
  const [demanda, setDemanda] = useState<{
    aberto: boolean;
    modo: 'novo' | 'editar';
    item: ConteudoItem | null;
    chave: number;
    clienteInicialId?: string;
  }>({ aberto: false, modo: 'novo', item: null, chave: 0 });

  // Modal Duplicar Mês
  const [modalDuplicarAberto, setModalDuplicarAberto] = useState(false);
  const [duplicarClienteId, setDuplicarClienteId] = useState('');
  const [duplicarMesOrigem, setDuplicarMesOrigem] = useState(() => new Date().toISOString().slice(0, 7));
  const [duplicarMesDestino, setDuplicarMesDestino] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 7);
  });
  const [duplicando, setDuplicando] = useState(false);

  // Form states elaborados

  // Rola a página para o topo ao trocar o modo de visualização (Kanban/Lista/Feed) ou ao alternar cliente/item
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelectorAll('main, body, html, [data-scroll-container]').forEach((el) => {
        el.scrollTop = 0;
      });
    }
  }, [viewMode, clienteSelecionado]);

  // Comentários internos e Histórico da Demanda

  // Modal Envio Inteligente para Aprovação (WhatsApp Web Seguro)
  const [modalAprovacaoAberto, setModalAprovacaoAberto] = useState(false);
  const [itemParaAprovacao, setItemParaAprovacao] = useState<ConteudoItem | null>(null);
  const [telefoneAprovacaoCustom, setTelefoneAprovacaoCustom] = useState('');
  const [uploadingAprovacao, setUploadingAprovacao] = useState(false);
  const [enviandoAprovacaoId, setEnviandoAprovacaoId] = useState<string | null>(null);

  // Notion Sync
  const [sincronizandoNotion, setSincronizandoNotion] = useState(false);

  // Carrega clientes, membros e itens
  async function carregarDados() {
    setCarregando(true);
    try {
      const [resClientes, resConteudo, resEquipe] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/conteudo'),
        fetch('/api/equipe').catch(() => ({ ok: false, json: async () => ({}) })),
      ]);

      const dataCli = await resClientes.json();
      const dataCont = await resConteudo.json();
      const dataEq = resEquipe.ok ? await resEquipe.json() : { membros: [] };

      if (resClientes.ok && dataCli.clientes) setClientes(dataCli.clientes);
      if (resConteudo.ok && dataCont.items) setItems(dataCont.items);
      if (dataEq.membros) setMembros(dataEq.membros);
    } catch {
      showToast('Erro ao carregar esteira de conteúdo.', 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  // Sincroniza filtro quando o cliente do Workspace muda externamente
  useEffect(() => {
    setClienteSelecionado(clienteFiltroId || 'all');
  }, [clienteFiltroId]);

  // Foca e abre automaticamente o modal da demanda se itemFocoId for fornecido
  useEffect(() => {
    if (itemFocoId && items.length > 0) {
      const itemEncontrado = items.find((i) => i.id === itemFocoId);
      if (itemEncontrado) {
        handleAbrirModalEditar(itemEncontrado);
        onClearItemFoco?.();
      }
    }
  }, [itemFocoId, items]);

  const totalPublicados = useMemo(() => {
    return items.filter((it) => it.status === 'publicado').length;
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    const agora = Date.now();
    const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (clienteSelecionado !== 'all' && item.cliente_id !== clienteSelecionado) return false;
      if (responsavelFiltro !== 'all' && !ehResponsavel(item, responsavelFiltro)) return false;
      if (ocultarPublicados && item.status === 'publicado') return false;

      // Posts publicados há mais de 7 dias não ocupam espaço na tela de publicados da esteira
      if (item.status === 'publicado') {
        const dataPub = item.publicado_em
          ? new Date(item.publicado_em).getTime()
          : item.atualizado_em
          ? new Date(item.atualizado_em).getTime()
          : 0;
        if (dataPub > 0 && agora - dataPub > SETE_DIAS_MS) {
          return false;
        }
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTitulo = (item.titulo || '').toLowerCase().includes(termo);
        const matchLegenda = (item.legenda || '').toLowerCase().includes(termo);
        const matchCliente = (item.cliente?.nome || '').toLowerCase().includes(termo);
        const matchResp = (item.responsavel?.nome || '').toLowerCase().includes(termo);
        if (!matchTitulo && !matchLegenda && !matchCliente && !matchResp) return false;
      }
      return true;
    }).sort(compararPorData);
  }, [items, clienteSelecionado, responsavelFiltro, busca, ocultarPublicados]);

  async function handleMudarStatus(
    itemId: string,
    novoStatus: StatusConteudo,
    targetItemId?: string | null,
    moverParaTopo?: boolean
  ) {
    setDraggingItemId(null);
    setDraggingOverCol(null);
    setDraggingOverItemId(null);

    const itemDragged = items.find((i) => i.id === itemId);
    if (!itemDragged) return;

    // Se é a mesma coluna e sem reordenação específica, não altera
    if (!targetItemId && !moverParaTopo && itemDragged.status === novoStatus) return;

    const outrosItens = items.filter((i) => i.id !== itemId);
    const itemAtualizado = { ...itemDragged, status: novoStatus };

    let novosItems: ConteudoItem[] = [];

    if (targetItemId) {
      // Inserir exatamente ANTES do targetItemId no array
      const indexTarget = outrosItens.findIndex((i) => i.id === targetItemId);
      if (indexTarget !== -1) {
        novosItems = [
          ...outrosItens.slice(0, indexTarget),
          itemAtualizado,
          ...outrosItens.slice(indexTarget),
        ];
      } else {
        novosItems = [itemAtualizado, ...outrosItens];
      }
    } else {
      // Padrão (ou moverParaTopo / troca de coluna): insere no TOPO da coluna de destino
      const primeiroDaColunaIndex = outrosItens.findIndex(
        (it) => mapearStatusParaColunaKanban(it.status) === novoStatus
      );
      if (primeiroDaColunaIndex !== -1) {
        novosItems = [
          ...outrosItens.slice(0, primeiroDaColunaIndex),
          itemAtualizado,
          ...outrosItens.slice(primeiroDaColunaIndex),
        ];
      } else {
        novosItems = [itemAtualizado, ...outrosItens];
      }
    }

    novosItems = novosItems.map((it, idx) => ({ ...it, ordem: idx + 1 }));
    setItems(novosItems);

    const novaOrdem = novosItems.find((i) => i.id === itemId)?.ordem || 1;

    try {
      const res = await fetch(`/api/conteudo/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus, ordem: novaOrdem }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar status');

      if (novoStatus === 'revisao_cliente') {
        if (data?.whatsapp?.enviado) {
          showToast('Demanda em Aprovação! Link disparado automaticamente no WhatsApp do cliente.', 'success');
        } else if (data?.whatsapp?.jaEnviadoRecentemente) {
          showToast('Demanda movida para Aprovação (já enviada recentemente ao WhatsApp).', 'success');
        } else if (data?.whatsapp?.erro) {
          showToast(`Demanda em Aprovação, mas houve um aviso no WhatsApp: ${data.whatsapp.erro}`, 'error');
        } else {
          showToast('Demanda enviada para Aprovação!', 'success');
        }
      } else {
        const msgFeedback = moverParaTopo
          ? 'Demanda movida para o topo da coluna!'
          : `Demanda organizada em ${STATUS_LABELS[novoStatus].label}`;
        showToast(msgFeedback, 'success');
      }
    } catch {
      carregarDados();
      showToast('Erro ao atualizar posição.', 'error');
    }
  }

  // Disparo 100% Automático de Aprovação via WhatsApp
  async function handleEnviarParaAprovacao(item: ConteudoItem, reenviar = false) {
    if (enviandoAprovacaoId === item.id) return;
    setEnviandoAprovacaoId(item.id);

    const statusAnterior = item.status;
    const jaEstavaEmAprovacao = statusAnterior === 'revisao_cliente';

    // Otimista: se ainda não está em revisao_cliente, reflete instantaneamente no Kanban
    if (!jaEstavaEmAprovacao) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'revisao_cliente' } : i))
      );
    }

    try {
      const res = await fetch(`/api/conteudo/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'revisao_cliente',
          reenviar_whatsapp: reenviar || jaEstavaEmAprovacao,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar para aprovação.');

      if (data.item) {
        setItems((prev) => prev.map((i) => (i.id === data.item.id ? data.item : i)));
      }

      if (data.whatsapp?.enviado) {
        showToast(
          reenviar || jaEstavaEmAprovacao
            ? 'Mensagem e link de aprovação reenviados no grupo de WhatsApp!'
            : 'Demanda enviada para Aprovação! Link disparado automaticamente no WhatsApp.',
          'success'
        );
      } else if (data.whatsapp?.jaEnviadoRecentemente) {
        showToast('Demanda em Aprovação (mensagem já disparada recentemente ao WhatsApp).', 'success');
      } else if (data.whatsapp?.erro) {
        showToast(
          `Demanda movida para Aprovação, mas houve um aviso no WhatsApp: ${data.whatsapp.erro}`,
          'error'
        );
      } else {
        showToast('Demanda movida para Aprovação com sucesso!', 'success');
      }
    } catch (err: any) {
      // Reverte estado otimista caso falhe
      if (!jaEstavaEmAprovacao) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: statusAnterior } : i))
        );
      }
      showToast(err?.message || 'Erro ao enviar para aprovação.', 'error');
    } finally {
      setEnviandoAprovacaoId(null);
    }
  }

  // Helper para upload de mídias direto no Supabase Storage (bucket 'post-media')
  async function handleUploadArquivos(fileList: FileList | File[]): Promise<ArquivoConteudo[]> {
    const files = Array.from(fileList);
    const novos: ArquivoConteudo[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const res = await uploadMediaFile(f, 'conteudo');
      novos.push({
        id: crypto.randomUUID(),
        url: res.url,
        tipo: res.tipo,
        ordem: i + 1,
        nome: res.nome,
      });
    }
    return novos;
  }

  // Fallback manual para compartilhamento / WhatsApp Web Seguro se necessário
  function handleAbrirModalAprovacao(item: ConteudoItem) {
    setItemParaAprovacao(item);
    const contatos = item.cliente?.contatos || [];
    const grupo = contatos.find((c) => c.e_grupo_whatsapp && c.telefone);
    const primeiro = contatos.find((c) => c.telefone);
    const tel = grupo?.telefone || primeiro?.telefone || (item.cliente as any)?.whatsapp_grupo_id || '';
    setTelefoneAprovacaoCustom(tel);
    setModalAprovacaoAberto(true);
  }

  // Envio Direto para Tela de Agendamento (Creator Studio)
  function handleLevarParaAgendamento(item: ConteudoItem) {
    if (!onIrParaAgendamento) {
      showToast('Navegador de agendamento não configurado.', 'error');
      return;
    }
    const mediaUrls = (item.arquivos || []).map((a) => a.url);
    const clienteContaId = (item.cliente as any)?.instagram_user_id || null;
    const clienteUsername = (item.cliente as any)?.instagram_username || (item.cliente as any)?.instagram_accounts?.instagram_username || null;
    const clienteAccountId = (item.cliente as any)?.instagram_account_id || null;

    let autoConfig = item.automacao_config || null;
    if (!autoConfig && item.legenda) {
      const det = detectarGatilhosDaLegenda(item.legenda);
      if (det.detected && det.keyword) {
        autoConfig = {
          enabled: true,
          keywords: [det.keyword],
          match_type: 'contains',
          welcome_dm: det.suggestedDm,
          public_replies: [det.suggestedPublicReply],
        };
      }
    }

    const prefill: PrefillAgendamento = {
      conteudoId: item.id,
      clienteNome: item.cliente?.nome || 'Cliente',
      instagramAccountId: clienteAccountId,
      instagramUserId: clienteContaId || clienteUsername,
      kind: item.tipo === 'reel' ? 'reels' : item.tipo === 'story' ? 'story' : 'post',
      mediaUrls,
      caption: item.legenda || '',
      scheduledAt: item.data_programada || null,
      titulo: item.titulo || 'Publicação',
      automationConfig: autoConfig,
      coverUrl: item.tipo === 'reel' ? item.cover_url || null : null,
    };
    onIrParaAgendamento(prefill);
    showToast(`Demanda "${item.titulo}" enviada para Agendamentos!`, 'success');
  }

  function handleCopiarLinkAprovacao(token: string) {
    const link = `${window.location.origin}/aprovacao/${token}`;
    navigator.clipboard.writeText(link);
    showToast('Link de aprovação copiado!', 'success');
  }

  // Abre o modal no modo "novo" (cliente do filtro atual, ou o primeiro)
  function handleAbrirModalNovo() {
    const clienteInicialId = clienteSelecionado !== 'all' ? clienteSelecionado : clientes[0]?.id || '';
    setDemanda((d) => ({ aberto: true, modo: 'novo', item: null, chave: d.chave + 1, clienteInicialId }));
  }

  // Pedido externo de "Nova demanda": abre assim que os dados (clientes,
  // equipe) terminam de carregar, uma vez por sinal.
  const sinalAtendidoRef = useRef(0);
  useEffect(() => {
    if (novaDemandaSinal > sinalAtendidoRef.current && !carregando) {
      sinalAtendidoRef.current = novaDemandaSinal;
      handleAbrirModalNovo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaDemandaSinal, carregando]);

  async function handleDuplicarMes(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicarClienteId) {
      showToast('Selecione o cliente para duplicar o mês.', 'error');
      return;
    }
    if (!duplicarMesOrigem || !duplicarMesDestino) {
      showToast('Informe os meses de origem e destino.', 'error');
      return;
    }
    if (duplicarMesOrigem === duplicarMesDestino) {
      showToast('O mês de destino deve ser diferente do mês de origem.', 'error');
      return;
    }

    setDuplicando(true);
    try {
      const res = await fetch('/api/conteudo/duplicar-mes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: duplicarClienteId,
          mes_origem: duplicarMesOrigem,
          mes_destino: duplicarMesDestino,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`${data.duplicados} demandas duplicadas com sucesso para ${duplicarMesDestino}!`, 'success');
      setModalDuplicarAberto(false);
      await carregarDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao duplicar mês de conteúdo.', 'error');
    } finally {
      setDuplicando(false);
    }
  }

  function handleAbrirModalEditar(item: ConteudoItem) {
    setDemanda((d) => ({ aberto: true, modo: 'editar', item, chave: d.chave + 1 }));
  }

  function fecharDemanda() {
    setDemanda((d) => ({ ...d, aberto: false }));
  }

  const clienteAtivo = clientes.find((c) => c.id === clienteSelecionado);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* 1. Header de Ações & Filtros em Linha Única */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca */}
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar demandas..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Filtro Cliente (Travado quando há cliente ativo no Workspace) */}
          {clienteFiltroId ? (
            (() => {
              const cAtivo = clientes.find((c) => c.id === clienteFiltroId);
              return (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-accent/60 rounded-xl border border-border text-xs">
                  <ClienteAvatar
                    nome={cAtivo?.nome || 'Cliente'}
                    cor={cAtivo?.cor}
                    fotoUrl={cAtivo?.foto_url}
                    tamanho="xs"
                  />
                  <span className="font-bold text-foreground truncate max-w-[120px]">
                    {cAtivo?.nome || 'Cliente'}
                  </span>
                </div>
              );
            })()
          ) : (
            <Select
              value={clienteSelecionado}
              onChange={(e) => setClienteSelecionado(e.target.value)}
              className="h-9 text-xs w-40 sm:w-44"
            >
              <option value="all">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          )}

          {/* Filtro Responsável */}
          {membros.length > 0 && (
            <Select
              value={responsavelFiltro}
              onChange={(e) => setResponsavelFiltro(e.target.value)}
              className="h-9 text-xs w-36 sm:w-40"
            >
              <option value="all">Toda a equipe</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Linha Única de Botões de Ação */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Seletor de Mês (quando no modo Feed) */}
          {viewMode === 'feed' && (
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="h-9 text-xs px-2.5 rounded-xl bg-background border border-input text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
              title="Mês de referência do feed"
            />
          )}

          {/* Alternador Kanban / Lista / Feed 3x3 (Pill Tab em Verde GENS) */}
          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border">
            <Tip label={"Visualização em Kanban"}><button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-ui cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`} aria-label={"Visualização em Kanban"}
            >
              <Columns3 className="w-4 h-4" />
            </button></Tip>
            <Tip label={"Visualização em Lista"}><button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-ui cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`} aria-label={"Visualização em Lista"}
            >
              <Layers className="w-4 h-4" />
            </button></Tip>
            <Tip label={"Visualização Preview de Feed 3x3"}><button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-ui cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'feed'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`} aria-label={"Visualização Preview de Feed 3x3"}
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Feed 3x3</span>
            </button></Tip>
          </div>

          {/* Botão Sincronizar Notion */}
          <Button
            onClick={async () => {
              setSincronizandoNotion(true);
              try {
                const res = await fetch('/api/cron/notion-sync', { method: 'POST' });
                const text = await res.text();
                let data: any = {};
                try {
                  data = JSON.parse(text);
                } catch {
                  data = { error: text };
                }

                if (res.ok && data.success) {
                  showToast(`Notion sincronizado! ${data.totalCreated || 0} criados, ${data.totalUpdated || 0} atualizados.`, 'success');
                  carregarDados();
                } else {
                  throw new Error(data.error || data.message || 'Falha ao sincronizar.');
                }
              } catch (err: any) {
                showToast(err.message || 'Erro ao sincronizar com o Notion.', 'error');
              } finally {
                setSincronizandoNotion(false);
              }
            }}
            disabled={sincronizandoNotion}
            variant="outline"
            size="sm"
            className="rounded-xl shadow-2xs h-9 text-xs font-bold bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-ui cursor-pointer"
            title="Sincronizar demandas ativas diretamente com o Notion"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-primary ${sincronizandoNotion ? 'animate-spin' : ''}`} />
            {sincronizandoNotion ? 'Sincronizando...' : '⚡ Sincronizar Notion'}
          </Button>

          {/* Toggle Ocultar/Exibir Publicados */}
          {totalPublicados > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOcultarPublicados((prev) => !prev)}
              className={`rounded-xl shadow-2xs h-9 text-xs font-bold transition-ui cursor-pointer ${
                ocultarPublicados
                  ? 'bg-accent/40 text-muted-foreground border-border hover:text-foreground'
                  : 'bg-success-soft text-success border-success-ring'
              }`}
              title={ocultarPublicados ? 'Clique para exibir as postagens publicadas' : 'Clique para ocultar as postagens publicadas da esteira'}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              <span>{ocultarPublicados ? `Publicados Ocultos (${totalPublicados})` : `Exibindo Publicados (${totalPublicados})`}</span>
            </Button>
          )}

          {/* Botão Nova Demanda */}
          <Button
            onClick={handleAbrirModalNovo}
            variant="primary"
            size="sm"
            className="rounded-xl shadow-xs h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/30 shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5 text-primary-foreground" />
            Nova Demanda
          </Button>
        </div>
      </div>

      {/* Régua de Etapas de Onboarding & Banner de Ações Rápidas do Cliente Ativo */}
      {clienteAtivo && (
        <div className="flex flex-col gap-3.5">
          <OnboardingBar
            cliente={clienteAtivo}
            onAtualizarCliente={(cAtualizado) => {
              setClientes((prev) => prev.map((cl) => (cl.id === cAtualizado.id ? cAtualizado : cl)));
            }}
            showToast={showToast}
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-4 rounded-2xl bg-card border border-border shadow-2xs">
            <div className="flex items-center gap-3">
              <ClienteAvatar nome={clienteAtivo.nome} cor={clienteAtivo.cor} fotoUrl={clienteAtivo.foto_url} tamanho="md" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{clienteAtivo.nome}</span>
                  <span className="text-xs font-mono text-muted-foreground bg-accent px-2 py-0.5 rounded-md border border-border">
                    {itemsFiltrados.length} {itemsFiltrados.length === 1 ? 'demanda' : 'demandas'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {clienteAtivo.nicho || 'Cliente da Agência'} · Feed visual do mês para envio e aprovação no WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={viewMode === 'feed' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('feed')}
                className="rounded-xl text-xs h-8.5 font-semibold"
              >
                <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />
                Ver Grade Feed 3x3
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const token = clienteAtivo.token_aprovacao_mes || clienteAtivo.id;
                  const url = `${window.location.origin}/aprovacao/feed/${token}`;
                  navigator.clipboard.writeText(url);
                  showToast('Link da grade do feed copiado para o WhatsApp!', 'success');
                }}
                className="rounded-xl text-xs h-8.5 font-semibold"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Copiar Link
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  const token = clienteAtivo.token_aprovacao_mes || clienteAtivo.id;
                  const url = `${window.location.origin}/aprovacao/feed/${token}`;
                  const msg = `Olá ${clienteAtivo.nome}! Segue a prévia visual completa do seu feed deste mês no Instagram para conferência e aprovação:\n\n${url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="rounded-xl text-xs h-8.5 font-bold bg-success hover:bg-success/90 text-success-foreground active:scale-[0.98]"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Enviar no WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Visualização Kanban, Lista ou Feed 3x3 */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : viewMode === 'feed' ? (
        clienteAtivo ? (
          <FeedPreviewGrid
            cliente={clienteAtivo}
            items={items}
            mesSelecionado={mesSelecionado}
            onAbrirEdicao={handleAbrirModalEditar}
            showToast={showToast}
            onAtualizarCliente={(cAtualizado) => {
              setClientes((prev) => prev.map((cl) => (cl.id === cAtualizado.id ? cAtualizado : cl)));
            }}
          />
        ) : (
          <div className="p-10 text-center rounded-2xl border border-dashed border-border bg-card/60 flex flex-col items-center justify-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Grid3X3 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Selecione um cliente para visualizar o Feed 3x3
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              A grade 3x3 simula o perfil oficial do Instagram do cliente no mês selecionado. Escolha um cliente para visualizar e organizar:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-w-xl">
              {clientes.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setClienteSelecionado(c.id)}
                  className="rounded-xl text-xs"
                >
                  <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={c.foto_url} tamanho="xs" />
                  <span className="ml-1.5 font-medium">{c.nome}</span>
                </Button>
              ))}
            </div>
          </div>
        )
      ) : itemsFiltrados.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhuma demanda encontrada"
          description="Crie um novo carrossel, reels ou post para acompanhar na esteira de produção e aprovação."
          action={{
            label: 'Criar Demanda',
            icon: Plus,
            onClick: handleAbrirModalNovo,
          }}
        />
      ) : viewMode === 'kanban' ? (
        <>
        {/* No celular, uma coluna por tela: o seletor mostra em que etapa você está e pula direto */}
        <nav aria-label="Etapas" className="sm:hidden -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1">
          {COLUNAS_KANBAN.filter((col) => !ocultarPublicados || col !== 'publicado').map((colStatus) => (
            <button
              key={colStatus}
              type="button"
              onClick={() => document.getElementById(`coluna-${colStatus}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })}
              className="shrink-0 h-9 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground active:bg-accent cursor-pointer"
            >
              {STATUS_LABELS[colStatus].label}
              <span className="text-xs text-muted-foreground tabular-nums">
                {itemsFiltrados.filter((it) => mapearStatusParaColunaKanban(it.status) === colStatus).length}
              </span>
            </button>
          ))}
        </nav>
        <ScrollShadow className="flex gap-4 pb-6 pt-1 select-none snap-x snap-mandatory sm:snap-none">
          {COLUNAS_KANBAN.filter((col) => !ocultarPublicados || col !== 'publicado').map((colStatus) => {
            const itensDaColuna = itemsFiltrados.filter((it) => mapearStatusParaColunaKanban(it.status) === colStatus);
            const info = STATUS_LABELS[colStatus];
            const colConfig = COLUNA_CONFIG[colStatus] || COLUNA_CONFIG.planejamento;
            const isOver = draggingOverCol === colStatus;

            return (
              <div
                key={colStatus}
                id={`coluna-${colStatus}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggingOverCol !== colStatus) setDraggingOverCol(colStatus);
                }}
                onDragLeave={() => {
                  if (draggingOverCol === colStatus) setDraggingOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingOverCol(null);
                  setDraggingItemId(null);
                  const itemId = e.dataTransfer.getData('text/plain');
                  if (itemId) handleMudarStatus(itemId, colStatus);
                }}
                className={`w-[85vw] max-w-80 sm:w-80 snap-start shrink-0 flex flex-col gap-3 p-3 rounded-2xl border transition-all duration-200 min-h-60 sm:min-h-[540px] ${
                  isOver
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/25 shadow-md'
                    : `${colConfig.fundoColuna} ${colConfig.bordaColuna}`
                }`}
              >
                {/* Cabeçalho da Coluna Estilo Pílula Bicolor (Linear / NovaBoard) */}
                <div className="flex items-center justify-between px-1 py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${colConfig.corPill}`}
                    >
                      <span className={`size-2 rounded-full ${colConfig.dot}`} />
                      <span className="font-display truncate">{info.label}</span>
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-background/80 text-[11px] font-mono tabular-nums shadow-2xs border border-border/40">
                        {itensDaColuna.length}
                      </span>
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/80 font-mono tracking-wider font-semibold">
                    {info.tag}
                  </span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="flex flex-col gap-3">
                  {itensDaColuna.map((item) => {
                    const ajustesPendentes = (item.comentarios_revisao || []).filter(
                      (c) => !c.resolvido && c.texto && !c.texto.toLowerCase().includes('aprovad')
                    );
                    const temAjustes = item.status === 'travado' || (item.status === 'revisao_interna' && ajustesPendentes.length > 0);
                    const temAjustesPendentes = ajustesPendentes.length > 0;
                    const foiAprovado =
                      item.status === 'agendamento' ||
                      item.status === 'pronto_publicar' ||
                      item.status === 'publicado' ||
                      (item.historico_atividades || []).some((h) => h.texto?.toLowerCase().includes('aprovad'));
                    const isDragging = draggingItemId === item.id;
                    const isOverItem = draggingOverItemId === item.id;

                    // Formato visual
                    const formatoPill = {
                      post: { label: 'Carrossel', emoji: '🖼️', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25' },
                      reel: { label: 'Reels', emoji: '🎬', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25' },
                      story: { label: 'Story', emoji: '⚡', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
                      avulso: { label: 'Avulso', emoji: '📌', cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25' },
                    }[item.tipo] || { label: item.tipo, emoji: '📌', cls: 'bg-accent text-muted-foreground border-border' };

                    // Checklist e Progresso
                    const checklistTotal = item.checklist?.length || 0;
                    const checklistConcluidos = item.checklist?.filter((c) => c.concluido).length || 0;
                    const checklistPct = checklistTotal > 0 ? Math.round((checklistConcluidos / checklistTotal) * 100) : 0;

                    // Capa / Thumbnail
                    const capaUrl = (item.tipo === 'reel' && item.cover_url) || item.arquivos?.[0]?.url || (item as any).midia_url || null;

                    return (
                      <Card
                        key={item.id}
                        draggable={true}
                        tabIndex={0}
                        role="group"
                        aria-label={`${item.titulo || 'Demanda'} — ${STATUS_LABELS[colStatus]?.label ?? ''}. Enter abre; Alt + setas movem de etapa.`}
                        onClick={() => handleAbrirModalEditar(item)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAbrirModalEditar(item);
                            return;
                          }
                          if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                            e.preventDefault();
                            const idx = ETAPAS_PIPELINE.findIndex((et) => et.status === colStatus);
                            const alvo = ETAPAS_PIPELINE[idx + (e.key === 'ArrowRight' ? 1 : -1)];
                            if (alvo) handleMudarStatus(item.id, alvo.status);
                          }
                        }}
                        onDragStart={(e) => {
                          setDraggingItemId(item.id);
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingItemId(null);
                          setDraggingOverItemId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggingOverItemId !== item.id) setDraggingOverItemId(item.id);
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          if (draggingOverItemId === item.id) setDraggingOverItemId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDraggingOverCol(null);
                          setDraggingItemId(null);
                          setDraggingOverItemId(null);
                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (draggedId) handleMudarStatus(draggedId, colStatus, item.id);
                        }}
                        className={`group p-3.5 rounded-2xl border bg-card shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col gap-2.5 cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          temAjustes
                            ? 'border-destructive/40 bg-destructive/5'
                            : 'border-border/80 hover:border-foreground/25 hover:-translate-y-0.5'
                        } ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${
                          isOverItem ? 'ring-2 ring-primary border-primary bg-primary/10' : ''
                        }`}
                      >
                        {/* Indicador de Drop-target (Acima do Card) */}
                        {isOverItem && (
                          <div className="absolute -top-1.5 left-2 right-2 h-1 bg-primary rounded-full shadow-xs animate-pulse pointer-events-none z-10" />
                        )}

                        {/* Topo do Card: Formato + Prioridade + Ações Rápidas */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {/* Pílula de Formato */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${formatoPill.cls}`}
                            >
                              <span>{formatoPill.emoji}</span>
                              <span>{formatoPill.label}</span>
                            </span>

                            {/* Pílula de Prioridade (se alta/urgente/baixa) */}
                            {item.prioridade && item.prioridade !== 'media' && PRIORIDADE_CONFIG[item.prioridade] && (
                              <Tip label={`Prioridade ${PRIORIDADE_CONFIG[item.prioridade].label}`}>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium border flex items-center gap-1 ${
                                    PRIORIDADE_CONFIG[item.prioridade].bg
                                  } ${PRIORIDADE_CONFIG[item.prioridade].text} ${
                                    PRIORIDADE_CONFIG[item.prioridade].border
                                  }`}
                                >
                                  <span aria-hidden className={`size-1.5 rounded-full ${PRIORIDADE_CONFIG[item.prioridade].dot}`} />
                                  <span>{PRIORIDADE_CONFIG[item.prioridade].label}</span>
                                </span>
                              </Tip>
                            )}
                          </div>

                          {/* Menu de Ações no Card: Mover etapa e Opções `···` */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 shrink-0"
                          >
                            <MoverEtapaMenu
                              etapas={ETAPAS_PIPELINE.map((et) => ({ status: et.status, label: et.label }))}
                              atual={colStatus}
                              onMover={(novo) => handleMudarStatus(item.id, novo)}
                            />

                            <Menu.Root>
                              <Menu.Trigger
                                aria-label="Mais opções"
                                className="grid place-items-center size-7 rounded-lg border border-border/80 bg-card/90 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-colors shadow-2xs"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Menu.Trigger>
                              <Menu.Portal>
                                <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[80]">
                                  <Menu.Popup className="min-w-48 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95">
                                    <Menu.Item
                                      onClick={() => handleAbrirModalEditar(item)}
                                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                                    >
                                      <Edit2 className="size-3.5 text-muted-foreground" />
                                      <span>Editar demanda</span>
                                    </Menu.Item>
                                    <Menu.Item
                                      onClick={() => handleCopiarLinkAprovacao(item.token_aprovacao)}
                                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                                    >
                                      <Share2 className="size-3.5 text-muted-foreground" />
                                      <span>Copiar link de aprovação</span>
                                    </Menu.Item>
                                    {item.token_aprovacao && (
                                      <Menu.Item
                                        onClick={() => window.open(`/aprovacao/${item.token_aprovacao}`, '_blank')}
                                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                                      >
                                        <ExternalLink className="size-3.5 text-muted-foreground" />
                                        <span>Ver tela de aprovação</span>
                                      </Menu.Item>
                                    )}
                                  </Menu.Popup>
                                </Menu.Positioner>
                              </Menu.Portal>
                            </Menu.Root>
                          </div>
                        </div>

                        {/* Capa da Demanda no Kanban (Aspect 16:9 limpo) */}
                        {capaUrl && (
                          <div className="relative aspect-[16/9] w-full bg-black/60 rounded-xl overflow-hidden border border-border/60 shrink-0">
                            {item.tipo === 'reel' && capaUrl.match(/\.(mp4|mov|webm)/i) ? (
                              <video src={capaUrl} className="w-full h-full object-cover" muted />
                            ) : (
                              <img
                                src={capaUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                              />
                            )}
                          </div>
                        )}

                        {/* Identificação do Cliente */}
                        <div className="flex items-center gap-2 min-w-0">
                          <ClienteAvatar
                            nome={item.cliente?.nome || 'Cliente'}
                            cor={item.cliente?.cor}
                            fotoUrl={item.cliente?.foto_url}
                            tamanho="xs"
                          />
                          <span className="text-xs font-semibold text-muted-foreground hover:text-foreground truncate transition-colors">
                            {item.cliente?.nome || 'Cliente'}
                          </span>
                        </div>

                        {/* Título da Demanda em Sora */}
                        {item.titulo ? (
                          <h4 className="text-sm font-semibold font-display text-foreground leading-snug line-clamp-2">
                            {item.titulo}
                          </h4>
                        ) : (
                          <h4 className="text-sm font-medium italic text-muted-foreground">
                            Demanda sem título
                          </h4>
                        )}

                        {/* Preview de Briefing / Nota (Inspiração NovaBoard Img 4) */}
                        {item.briefing && item.briefing.trim().length > 0 && (
                          <div className="text-xs text-muted-foreground/90 line-clamp-1 bg-accent/40 rounded-lg px-2.5 py-1 border border-border/50 font-normal">
                            <span className="font-semibold text-foreground/70 not-italic mr-1.5">Nota:</span>
                            <span>{item.briefing}</span>
                          </div>
                        )}

                        {/* Barra de Progresso do Checklist (Inspiração NovaBoard Img 4) */}
                        {checklistTotal > 0 && (
                          <div className="flex flex-col gap-1 pt-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium flex items-center gap-1.5 text-[11px]">
                                <CheckSquare className="size-3 text-primary" />
                                <span>Progresso</span>
                              </span>
                              <span className="text-[11px] font-mono font-bold text-foreground tabular-nums">
                                {checklistPct}%{' '}
                                <span className="text-muted-foreground font-normal">
                                  ({checklistConcluidos}/{checklistTotal})
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden border border-border/40">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  checklistPct === 100 ? 'bg-success' : 'bg-primary'
                                }`}
                                style={{ width: `${checklistPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Status Contextual: Ajustes Pendentes */}
                        {temAjustesPendentes && (
                          <div className="px-2.5 py-1 rounded-xl bg-destructive/10 border border-destructive/25 flex items-center justify-between gap-1.5 text-xs text-destructive font-medium">
                            <span className="flex items-center gap-1.5 truncate">
                              <AlertCircle className="size-3.5 shrink-0" />
                              <span className="truncate">{ajustesPendentes.length} {ajustesPendentes.length === 1 ? 'ajuste solicitado' : 'ajustes solicitados'}</span>
                            </span>
                          </div>
                        )}

                        {/* Status Contextual: Aguardando Aprovação do Cliente */}
                        {item.status === 'revisao_cliente' && (
                          <div className="p-2 rounded-xl bg-brand-soft border border-brand-ring flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-brand-text font-semibold min-w-0">
                              <span className="size-1.5 rounded-full bg-brand-solid animate-pulse shrink-0" />
                              <span className="truncate">Aguardando aprovação</span>
                            </div>
                            {item.token_aprovacao && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/aprovacao/${item.token_aprovacao}`, '_blank');
                                }}
                                className="text-brand-text hover:underline shrink-0 font-medium text-[11px] cursor-pointer"
                              >
                                Ver tela
                              </button>
                            )}
                          </div>
                        )}

                        {/* Status Contextual: Agendado ou Publicado */}
                        {(colStatus === 'agendamento' || item.status === 'agendamento' || item.status === 'pronto_publicar') &&
                          (item.data_programada || item.scheduled_post_id) && (
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-2 text-xs text-primary font-medium">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Calendar className="size-3.5 shrink-0" />
                                <span className="truncate font-mono">
                                  {dataLocal(item.data_programada!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  {!ehDataSemHora(item.data_programada!) && ` às ${new Date(item.data_programada!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                              </div>
                            </div>
                          )}

                        {/* Rodapé do Card: Avatares à esquerda, Metadados e Ações à direita */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/70 mt-auto">
                          {/* Avatares dos Responsáveis */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AvatarGroup pessoas={pessoasResponsaveis(item)} size="xs" max={3} />
                            {item.responsavel && (
                              <span className="text-[11px] font-medium text-muted-foreground truncate hidden sm:inline max-w-[80px]">
                                {item.responsavel.nome.split(' ')[0]}
                              </span>
                            )}
                          </div>

                          {/* Metadados Compactos (Linear Img 2 & NovaBoard Img 4) */}
                          <div className="flex items-center gap-2.5 text-xs text-muted-foreground shrink-0 font-mono">
                            {item.arquivos?.length > 0 && (
                              <Tip label={`${item.arquivos.length} ${item.tipo === 'reel' ? 'vídeo' : 'mídias'}`}>
                                <span className="flex items-center gap-0.5 hover:text-foreground transition-colors">
                                  <Paperclip className="size-3" />
                                  <span className="tabular-nums">{item.arquivos.length}</span>
                                </span>
                              </Tip>
                            )}

                            {(item.comentarios_revisao?.length || 0) > 0 && (
                              <Tip label={`${item.comentarios_revisao.length} comentários`}>
                                <span
                                  className={`flex items-center gap-0.5 transition-colors ${
                                    temAjustesPendentes ? 'text-destructive font-semibold' : 'hover:text-foreground'
                                  }`}
                                >
                                  <MessageSquare className="size-3" />
                                  <span className="tabular-nums">{item.comentarios_revisao.length}</span>
                                </span>
                              </Tip>
                            )}

                            {item.prazo && (
                              <Tip label={`Prazo: ${dataLocal(item.prazo).toLocaleDateString('pt-BR')}`}>
                                <span className="flex items-center gap-0.5 hover:text-foreground transition-colors">
                                  <Clock className="size-3" />
                                  <span className="tabular-nums">{formatarDataCurta(item.prazo)}</span>
                                </span>
                              </Tip>
                            )}
                          </div>
                        </div>

                        {/* Botão de Ação Rápida no Rodapé (quando aplicável) */}
                        {(() => {
                          const isPublicado = colStatus === 'publicado' || item.status === 'publicado';
                          const isAgendadoCol = colStatus === 'agendamento' || item.status === 'agendamento' || item.status === 'pronto_publicar';
                          const isAgendadoComData = isAgendadoCol && Boolean(item.scheduled_post_id || item.data_programada);

                          if (isPublicado) {
                            return (
                              <div className="flex items-center justify-end pt-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-success-soft text-success border border-success-ring">
                                  <CheckCircle2 className="size-3" />
                                  <span>Publicado</span>
                                </span>
                              </div>
                            );
                          }

                          if (isAgendadoCol) {
                            return (
                              <div className="flex items-center justify-end pt-1">
                                <Tip label={isAgendadoComData ? 'Ver ou reagendar' : 'Levar para Agendamento do Instagram'}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLevarParaAgendamento(item);
                                    }}
                                    className={`w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-ui cursor-pointer shadow-2xs ${
                                      isAgendadoComData
                                        ? 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30'
                                        : 'bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/40'
                                    }`}
                                  >
                                    <Sparkles className="size-3.5" />
                                    <span>{isAgendadoComData ? 'Reagendar' : 'Agendar post'}</span>
                                  </button>
                                </Tip>
                              </div>
                            );
                          }

                          const isEnviandoEsteItem = enviandoAprovacaoId === item.id;
                          const reenviar = item.status === 'revisao_cliente';

                          // Se estiver em revisão ou etapa de criação, permite disparar aprovação
                          if (item.status === 'revisao_interna' || item.status === 'revisao_cliente' || item.status === 'criacao_arte') {
                            return (
                              <div className="flex items-center justify-end pt-1">
                                <Tip
                                  label={
                                    reenviar
                                      ? 'Reenviar mensagem e link de aprovação no WhatsApp do cliente'
                                      : 'Enviar demanda para aprovação no WhatsApp do cliente'
                                  }
                                >
                                  <button
                                    type="button"
                                    disabled={isEnviandoEsteItem}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEnviarParaAprovacao(item, reenviar);
                                    }}
                                    className={`w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center justify-center gap-1.5 border transition-ui cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                                      reenviar
                                        ? 'bg-brand-soft hover:bg-brand-soft/80 text-brand-text border-brand-ring'
                                        : 'bg-lime hover:bg-lime/90 text-lime-foreground font-bold border-foreground/15 active:scale-[0.98]'
                                    }`}
                                  >
                                    {isEnviandoEsteItem ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Send className="size-3.5" />
                                    )}
                                    <span>{isEnviandoEsteItem ? 'Enviando...' : reenviar ? 'Reenviar WhatsApp' : 'Enviar para Aprovação'}</span>
                                  </button>
                                </Tip>
                              </div>
                            );
                          }

                          return null;
                        })()}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </ScrollShadow>
        </>
      ) : (
        /* Visualização em Lista */
        <Card padding="lg" className="rounded-2xl">
          <DataTable
            rows={itemsFiltrados}
            getRowId={(item) => item.id}
            onRowClick={handleAbrirModalEditar}
            empty={<EmptyState size="compact" icon={Search} title="Nenhuma demanda aqui" description="Nenhuma demanda bate com o cliente ou o filtro escolhido." />}
            columns={[
              {
                id: 'demanda',
                header: 'Demanda',
                mobile: 'primary',
                cell: (item) => (
                  <div className="flex items-center gap-2.5 min-w-0 sm:min-w-[220px]">
                    <ClienteAvatar nome={item.cliente?.nome || 'Cliente'} cor={item.cliente?.cor} tamanho="sm" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirModalEditar(item);
                        }}
                        className="font-semibold text-foreground truncate block max-w-[280px] text-left hover:underline cursor-pointer"
                      >
                        {item.titulo || 'Sem título'}
                      </button>
                      <span className="text-xs text-muted-foreground truncate block">
                        {item.cliente?.nome} · {item.tipo}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Etapa',
                cell: (item) => <Badge variant={STATUS_LABELS[item.status].variant}>{STATUS_LABELS[item.status].label}</Badge>,
              },
              {
                id: 'responsavel',
                header: 'Responsável',
                cell: (item) =>
                  item.responsavel?.nome ? (
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <AvatarGroup pessoas={pessoasResponsaveis(item)} size="xs" max={3} />
                      <span className="truncate max-w-[180px]">{pessoasResponsaveis(item).map((p) => p.nome).join(', ')}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                id: 'midia',
                header: 'Mídia',
                align: 'right',
                className: 'text-muted-foreground tabular-nums whitespace-nowrap',
                cell: (item) => {
                  const n = item.arquivos?.length || 0;
                  return n === 0 ? '—' : `${n} arquivo${n !== 1 ? 's' : ''}`;
                },
              },
              {
                id: 'proximo',
                header: 'Próximo passo',
                mobileLabel: 'Próximo',
                cell: (item) => (
                  <ProximoPassoLista
                    item={item}
                    onAgendar={handleLevarParaAgendamento}
                    onAprovacao={(it, reenviar) => handleEnviarParaAprovacao(it, reenviar)}
                    enviandoId={enviandoAprovacaoId}
                  />
                ),
              },
            ]}
            actions={(item) => (
              <IconButton label="Copiar link de aprovação" onClick={() => handleCopiarLinkAprovacao(item.token_aprovacao)}>
                <Share2 />
              </IconButton>
            )}
          />
        </Card>
      )}

      {/* 3. Modal da demanda: o mesmo formulário cria e edita */}
      <DemandaSheet
        key={demanda.chave}
        aberto={demanda.aberto}
        modo={demanda.modo}
        item={demanda.item}
        clienteInicialId={demanda.clienteInicialId}
        responsavelInicialId={membros[0]?.id}
        clientes={clientes}
        membros={membros}
        showToast={showToast}
        onFechar={fecharDemanda}
        onSalvo={(salvo, criado) => {
          setItems((prev) => (criado ? [salvo, ...prev] : prev.map((i) => (i.id === salvo.id ? salvo : i))));
          fecharDemanda();
        }}
        onExcluido={(id) => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          fecharDemanda();
        }}
        onItemAtualizado={(atualizado) => {
          setItems((prev) => prev.map((i) => (i.id === atualizado.id ? atualizado : i)));
          setDemanda((d) => (d.item?.id === atualizado.id ? { ...d, item: atualizado } : d));
        }}
        onCopiarLinkAprovacao={handleCopiarLinkAprovacao}
        onLevarParaAgendamento={onIrParaAgendamento ? handleLevarParaAgendamento : undefined}
      />

      {/* 4. Modal Duplicar Mês de Conteúdo */}
      <DuplicarMesSheet
        open={modalDuplicarAberto}
        onClose={() => setModalDuplicarAberto(false)}
        clientes={clientes}
        duplicarClienteId={duplicarClienteId}
        setDuplicarClienteId={setDuplicarClienteId}
        duplicarMesOrigem={duplicarMesOrigem}
        setDuplicarMesOrigem={setDuplicarMesOrigem}
        duplicarMesDestino={duplicarMesDestino}
        setDuplicarMesDestino={setDuplicarMesDestino}
        duplicando={duplicando}
        onSubmit={handleDuplicarMes}
      />

      {/* 5. Modal de Envio para Aprovação (WhatsApp Web Seguro) */}
      <AprovacaoWhatsappSheet
        open={modalAprovacaoAberto}
        onClose={() => setModalAprovacaoAberto(false)}
        item={itemParaAprovacao}
        setItem={setItemParaAprovacao}
        setItems={setItems}
        telefone={telefoneAprovacaoCustom}
        setTelefone={setTelefoneAprovacaoCustom}
        uploading={uploadingAprovacao}
        setUploading={setUploadingAprovacao}
        onUploadArquivos={handleUploadArquivos}
        onCopiarLink={handleCopiarLinkAprovacao}
        showToast={showToast}
      />
    </div>
  );
}

/** Botão do próximo passo da demanda na lista: aprovação, agendamento ou selo de publicado. */
function ProximoPassoLista({
  item,
  onAgendar,
  onAprovacao,
  enviandoId,
}: {
  item: ConteudoItem;
  onAgendar: (item: ConteudoItem) => void;
  onAprovacao: (item: ConteudoItem, reenviar?: boolean) => void;
  enviandoId?: string | null;
}) {
  const parar = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  if (item.status === 'publicado') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="w-3 h-3" />
        Publicado
      </Badge>
    );
  }

  if (item.status === 'agendamento' || item.status === 'pronto_publicar') {
    const temData = Boolean(item.scheduled_post_id || item.data_programada);
    return (
      <Tip label={temData ? 'Ver ou reagendar a publicação' : 'Levar a demanda aprovada para o Agendamento'}>
        <Button size="sm" variant={temData ? 'secondary' : 'primary'} onClick={parar(() => onAgendar(item))} className="whitespace-nowrap">
          {temData ? <Calendar className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {temData ? 'Agendado' : 'Agendar'}
        </Button>
      </Tip>
    );
  }

  const reenviar = item.status === 'revisao_cliente';
  const carregando = enviandoId === item.id;
  return (
    <Tip label={reenviar ? 'Reenviar a mensagem e o link de aprovação no WhatsApp' : 'Enviar demanda para aprovação no WhatsApp'}>
      <Button
        size="sm"
        disabled={carregando}
        variant={reenviar ? 'secondary' : 'lime'}
        onClick={parar(() => onAprovacao(item, reenviar))}
        className="whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        {carregando ? 'Enviando...' : reenviar ? 'Reenviar' : 'Aprovação'}
      </Button>
    </Tip>
  );
}
