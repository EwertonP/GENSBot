'use client';
import { SegmentedItem } from '@/components/ui/segmented';

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
  User,
  Users,
  Image as ImageIcon,
  Video,
  Sparkles,
  Smartphone,
  ChevronRight,
  AlertCircle,
  FileText,
  Trash2,
  LayoutGrid,
  Grid3X3,
  Check,
  X,
  Edit2,
  UploadCloud,
  Loader2,
  Paperclip,
  ArrowUpToLine,
  ArrowUp,
  Flag,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/ui/sheet';
import { MemberChipSelect } from '@/components/ui/member-chip-select';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Instagram } from '@/components/instagram-icon';
import { OnboardingBar } from '@/components/onboarding-bar';
import { FeedPreviewGrid } from '@/components/feed-preview-grid';
import {
  STATUS_LABELS,
  COLUNAS_KANBAN,
  mapearStatusParaColunaKanban,
  PRIORIDADE_CONFIG,
  type PrioridadeConteudo,
  type ConteudoItem,
  type StatusConteudo,
  type TipoConteudo,
  type ArquivoConteudo,
  type PrefillAgendamento,
} from '@/lib/conteudo';
import { detectarGatilhosDaLegenda } from '@/lib/publish-automation';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';
import { uploadMediaFile } from '@/lib/storage-upload';
import { confirmDialog, MediaLightbox } from '@/components/ui/dialog';
import { MoverEtapaMenu } from '@/components/mover-etapa-menu';
import { CapaReelsField } from '@/components/capa-reels-field';
import { DuplicarMesSheet } from '@/components/esteira-duplicar-mes-sheet';
import { AprovacaoWhatsappSheet } from '@/components/esteira-aprovacao-whatsapp-sheet';


export const ETAPAS_PIPELINE: { status: StatusConteudo; label: string; short: string; step: number }[] = [
  // Um só vocabulário: "short" = STATUS_LABELS (badges e colunas); "label" = versão por extenso do stepper.
  { status: 'planejamento', label: 'Planejamento', short: 'Planejamento', step: 1 },
  { status: 'criacao_arte', label: 'Criação', short: 'Criação', step: 2 },
  { status: 'revisao_interna', label: 'Revisão interna', short: 'Revisão', step: 3 },
  { status: 'revisao_cliente', label: 'Aprovação do cliente', short: 'Aprovação', step: 4 },
  { status: 'agendamento', label: 'Agendamento', short: 'Agendamento', step: 5 },
  { status: 'publicado', label: 'Publicado', short: 'Publicado', step: 6 },
];

export function getEtapaIndex(status: StatusConteudo): number {
  switch (status) {
    case 'planejamento':
      return 1;
    case 'copy':
    case 'criacao_arte':
    case 'em_gravacao':
    case 'em_edicao':
      return 2;
    case 'revisao_arte':
    case 'revisao_interna':
    case 'travado':
      return 3;
    case 'revisao_cliente':
      return 4;
    case 'agendamento':
    case 'revisao_agendamento':
    case 'pronto_publicar':
      return 5;
    case 'publicado':
      return 6;
    default:
      return 1;
  }
}

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

  // Modal Novo Item
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

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
  const [buscaClienteForm, setBuscaClienteForm] = useState('');
  const [formClienteId, setFormClienteId] = useState('');
  const [formTipo, setFormTipo] = useState<TipoConteudo>('post');
  const [formStatusInicial, setFormStatusInicial] = useState<StatusConteudo>('planejamento');
  const [formPrioridade, setFormPrioridade] = useState<PrioridadeConteudo>('media');
  const [formTitulo, setFormTitulo] = useState('');
  const [formBriefing, setFormBriefing] = useState('');
  const [formLegenda, setFormLegenda] = useState('');
  const [formResponsavelId, setFormResponsavelId] = useState('');
  const [formEditorId, setFormEditorId] = useState('');
  const [formDataProgramada, setFormDataProgramada] = useState('');
  const [formPrazoInterno, setFormPrazoInterno] = useState('');
  const [formUrls, setFormUrls] = useState('');
  const [formArquivos, setFormArquivos] = useState<ArquivoConteudo[]>([]);
  const [formUploading, setFormUploading] = useState(false);
  const [showManualUrlsForm, setShowManualUrlsForm] = useState(false);
  const [trocarClienteAbertoNovo, setTrocarClienteAbertoNovo] = useState(false);

  // Modal Editar Item
  const [itemEmEdicao, setItemEmEdicao] = useState<ConteudoItem | null>(null);
  const [expandirCapaEdit, setExpandirCapaEdit] = useState(false);

  // Modos de Visualização e Abas para Modais de Demanda (Ergonomia 1920x1080)
  const [formAbaConteudo, setFormAbaConteudo] = useState<'legenda' | 'briefing' | 'capa' | 'anexos'>('legenda');
  const [formCapaUrl, setFormCapaUrl] = useState<string | null>(null);
  const [formModoVisualizacao, setFormModoVisualizacao] = useState<'abas' | 'split'>('abas');
  const [editAbaConteudo, setEditAbaConteudo] = useState<'legenda' | 'briefing' | 'capa' | 'anexos'>('legenda');
  const [editCapaUrl, setEditCapaUrl] = useState<string | null>(null);
  const [editModoVisualizacao, setEditModoVisualizacao] = useState<'abas' | 'split'>('abas');
  const [previewCapaLightbox, setPreviewCapaLightbox] = useState<string | null>(null);

  // Rola a página para o topo ao trocar o modo de visualização (Kanban/Lista/Feed) ou ao alternar cliente/item
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelectorAll('main, body, html, [data-scroll-container]').forEach((el) => {
        el.scrollTop = 0;
      });
    }
  }, [viewMode, clienteSelecionado, itemEmEdicao?.id]);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoItem, setExcluindoItem] = useState(false);
  const [editStatus, setEditStatus] = useState<StatusConteudo>('planejamento');
  const [editTipo, setEditTipo] = useState<TipoConteudo>('post');
  const [editPrioridade, setEditPrioridade] = useState<PrioridadeConteudo>('media');
  const [editTitulo, setEditTitulo] = useState('');
  const [editBriefing, setEditBriefing] = useState('');
  const [editLegenda, setEditLegenda] = useState('');
  const [editResponsavelId, setEditResponsavelId] = useState('');
  const [editEditorId, setEditEditorId] = useState('');
  const [editDataProgramada, setEditDataProgramada] = useState('');
  const [editPrazoInterno, setEditPrazoInterno] = useState('');
  const [editUrls, setEditUrls] = useState('');
  const [editArquivos, setEditArquivos] = useState<ArquivoConteudo[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const [showManualUrlsEdit, setShowManualUrlsEdit] = useState(false);
  const [trocarClienteAbertoEdit, setTrocarClienteAbertoEdit] = useState(false);
  const [editClienteId, setEditClienteId] = useState('');
  const [buscaClienteEdit, setBuscaClienteEdit] = useState('');

  // Comentários internos e Histórico da Demanda
  const [novoComentarioTexto, setNovoComentarioTexto] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Modal Envio Inteligente para Aprovação (WhatsApp Web Seguro)
  const [modalAprovacaoAberto, setModalAprovacaoAberto] = useState(false);
  const [itemParaAprovacao, setItemParaAprovacao] = useState<ConteudoItem | null>(null);
  const [telefoneAprovacaoCustom, setTelefoneAprovacaoCustom] = useState('');
  const [uploadingAprovacao, setUploadingAprovacao] = useState(false);

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
    return items.filter((item) => {
      if (clienteSelecionado !== 'all' && item.cliente_id !== clienteSelecionado) return false;
      if (responsavelFiltro !== 'all' && item.responsavel_id !== responsavelFiltro) return false;
      if (ocultarPublicados && item.status === 'publicado') return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTitulo = (item.titulo || '').toLowerCase().includes(termo);
        const matchLegenda = (item.legenda || '').toLowerCase().includes(termo);
        const matchCliente = (item.cliente?.nome || '').toLowerCase().includes(termo);
        const matchResp = (item.responsavel?.nome || '').toLowerCase().includes(termo);
        if (!matchTitulo && !matchLegenda && !matchCliente && !matchResp) return false;
      }
      return true;
    });
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
      if (!res.ok) throw new Error();
      showToast(
        moverParaTopo
          ? `Demanda movida para o topo da coluna!`
          : `Demanda organizada em ${STATUS_LABELS[novoStatus].label}`,
        'success'
      );
    } catch {
      carregarDados();
      showToast('Erro ao atualizar posição.', 'error');
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

  // Abertura do Modal de Envio para Aprovação (WhatsApp Web Seguro)
  function handleAbrirModalAprovacao(item: ConteudoItem) {
    setItemParaAprovacao(item);
    const contatos = item.cliente?.contatos || [];
    const grupo = contatos.find((c) => c.e_grupo_whatsapp && c.telefone);
    const primeiro = contatos.find((c) => c.telefone);
    const tel = grupo?.telefone || primeiro?.telefone || '';
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

  // Upload em Nova Demanda
  async function handleFormFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setFormUploading(true);
    try {
      const uploaded = await handleUploadArquivos(e.target.files);
      setFormArquivos((prev) => [...prev, ...uploaded]);
      showToast(`${uploaded.length} arquivo(s) carregado(s)!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar arquivos.', 'error');
    } finally {
      setFormUploading(false);
    }
  }

  // Upload em Editar Demanda
  async function handleEditFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setEditUploading(true);
    try {
      const uploaded = await handleUploadArquivos(e.target.files);
      setEditArquivos((prev) => [...prev, ...uploaded]);
      showToast(`${uploaded.length} arquivo(s) carregado(s)!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar arquivos.', 'error');
    } finally {
      setEditUploading(false);
    }
  }

  // Abre Modal com defaults limpos
  function handleAbrirModalNovo() {
    if (clienteSelecionado !== 'all') {
      setFormClienteId(clienteSelecionado);
    } else if (clientes.length > 0) {
      setFormClienteId(clientes[0].id);
    }
    setBuscaClienteForm('');
    setFormTipo('post');
    setFormStatusInicial('planejamento');
    setFormPrioridade('media');
    setFormTitulo('');
    setFormBriefing('');
    setFormLegenda('');
    setFormResponsavelId(membros[0]?.id || '');
    setFormEditorId('');
    setFormDataProgramada('');
    setFormPrazoInterno('');
    setFormUrls('');
    setFormArquivos([]);
    setFormCapaUrl(null);
    setShowManualUrlsForm(false);
    setTrocarClienteAbertoNovo(false);
    setFormAbaConteudo('legenda');
    setFormModoVisualizacao('abas');
    setModalNovoAberto(true);
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

  // Criação Elaborada de Nova Demanda
  async function handleSalvarNovo(e: React.FormEvent) {
    e.preventDefault();
    if (!formClienteId) {
      showToast('Selecione um cliente para a demanda.', 'error');
      return;
    }
    setSalvando(true);
    try {
      const urlsArray = formUrls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url, idx) => ({
          id: crypto.randomUUID(),
          url,
          tipo: formTipo === 'reel' ? ('video' as const) : ('imagem' as const),
          ordem: formArquivos.length + idx + 1,
        }));
      const arquivosFinais = [...formArquivos, ...urlsArray];

      const res = await fetch('/api/conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: formClienteId,
          tipo: formTipo,
          status: formStatusInicial,
          prioridade: formPrioridade,
          titulo: formTitulo.trim() || null,
          briefing: formBriefing.trim() || null,
          legenda: formLegenda.trim() || null,
          responsavel_id: formResponsavelId || null,
          editor_id: formEditorId || null,
          data_programada: formDataProgramada ? new Date(formDataProgramada).toISOString() : null,
          prazo: formPrazoInterno ? new Date(formPrazoInterno).toISOString() : null,
          arquivos: arquivosFinais,
          cover_url: formTipo === 'reel' ? formCapaUrl : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setItems((prev) => [data.item, ...prev]);
      setModalNovoAberto(false);
      showToast('Nova demanda cadastrada com sucesso na esteira!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar item.', 'error');
    } finally {
      setSalvando(false);
    }
  }

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

  // Alterações não salvas — o Sheet pergunta antes de descartar (Esc, clique
  // fora, X ou "Cancelar"). Fechar depois de salvar continua direto.
  const novoSujo =
    modalNovoAberto &&
    (formTitulo.trim() !== '' ||
      formBriefing.trim() !== '' ||
      formLegenda.trim() !== '' ||
      formUrls.trim() !== '' ||
      formArquivos.length > 0 ||
      !!formCapaUrl ||
      formDataProgramada !== '' ||
      formPrazoInterno !== '');

  const editSujo =
    !!itemEmEdicao &&
    (editTitulo !== (itemEmEdicao.titulo || '') ||
      editBriefing !== (itemEmEdicao.briefing || '') ||
      editLegenda !== (itemEmEdicao.legenda || '') ||
      editStatus !== itemEmEdicao.status ||
      editTipo !== itemEmEdicao.tipo ||
      editPrioridade !== (itemEmEdicao.prioridade || 'media') ||
      editResponsavelId !== (itemEmEdicao.responsavel_id || '') ||
      editEditorId !== (itemEmEdicao.editor_id || '') ||
      editDataProgramada !== (itemEmEdicao.data_programada ? itemEmEdicao.data_programada.slice(0, 10) : '') ||
      editPrazoInterno !== (itemEmEdicao.prazo ? itemEmEdicao.prazo.slice(0, 10) : '') ||
      editClienteId !== itemEmEdicao.cliente_id ||
      editUrls.trim() !== '' ||
      (editCapaUrl || null) !== (itemEmEdicao.cover_url || null) ||
      editArquivos.map((a) => a.url).join('|') !== (itemEmEdicao.arquivos || []).map((a) => a.url).join('|'));

  async function confirmarDescarte() {
    return confirmDialog({
      title: 'Descartar alterações?',
      description: 'Você tem alterações nesta demanda que ainda não foram salvas.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Continuar editando',
      tone: 'destructive',
    });
  }

  async function fecharNovo() {
    if (novoSujo && !(await confirmarDescarte())) return;
    setModalNovoAberto(false);
  }

  async function fecharEdicao() {
    if (editSujo && !(await confirmarDescarte())) return;
    setItemEmEdicao(null);
  }

  /** Demanda com o que está no formulário de edição (salvo ou não). */
  function itemComEdicoes(item: ConteudoItem): ConteudoItem {
    return {
      ...item,
      titulo: editTitulo,
      legenda: editLegenda,
      tipo: editTipo,
      arquivos: editArquivos,
      data_programada: editDataProgramada || item.data_programada,
    };
  }

  function handleAbrirModalEditar(item: ConteudoItem) {
    setItemEmEdicao(item);
    setExpandirCapaEdit(false);
    setEditStatus(item.status);
    setEditTipo(item.tipo);
    setEditPrioridade(item.prioridade || 'media');
    setEditTitulo(item.titulo || '');
    setEditBriefing(item.briefing || '');
    setEditLegenda(item.legenda || '');
    setEditResponsavelId(item.responsavel_id || '');
    setEditEditorId(item.editor_id || '');
    setEditDataProgramada(item.data_programada ? item.data_programada.slice(0, 10) : '');
    setEditPrazoInterno(item.prazo ? item.prazo.slice(0, 10) : '');
    setEditUrls('');
    setEditArquivos(item.arquivos || []);
    setEditCapaUrl(item.cover_url || null);
    setShowManualUrlsEdit(false);
    setNovoComentarioTexto('');
    setEditClienteId(item.cliente_id);
    setBuscaClienteEdit('');
    setTrocarClienteAbertoEdit(false);
    setEditAbaConteudo('legenda');
    setEditModoVisualizacao('abas');
    setPreviewCapaLightbox(null);
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!itemEmEdicao) return;

    setSalvandoEdicao(true);
    try {
      const urlsArray = editUrls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url, idx) => ({
          id: crypto.randomUUID(),
          url,
          tipo: editTipo === 'reel' ? ('video' as const) : ('imagem' as const),
          ordem: editArquivos.length + idx + 1,
        }));
      const arquivosFinais = [...editArquivos, ...urlsArray];

      const res = await fetch(`/api/conteudo/${itemEmEdicao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: editTipo,
          cliente_id: editClienteId || itemEmEdicao.cliente_id,
          status: editStatus,
          prioridade: editPrioridade,
          titulo: editTitulo.trim() || null,
          briefing: editBriefing.trim() || null,
          legenda: editLegenda.trim() || null,
          responsavel_id: editResponsavelId || null,
          editor_id: editEditorId || null,
          data_programada: editDataProgramada ? new Date(editDataProgramada).toISOString() : null,
          prazo: editPrazoInterno ? new Date(editPrazoInterno).toISOString() : null,
          arquivos: arquivosFinais,
          cover_url: editTipo === 'reel' ? editCapaUrl : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setItems((prev) => prev.map((i) => (i.id === itemEmEdicao.id ? data.item : i)));
      setItemEmEdicao(null);
      showToast('Demanda atualizada com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar alterações.', 'error');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleEnviarComentarioEquipe() {
    if (!itemEmEdicao || !novoComentarioTexto.trim()) return;
    setEnviandoComentario(true);
    try {
      const membro = membros.find((m) => m.id === editResponsavelId || m.id === editEditorId);
      const autorNome = membro?.nome || 'Equipe';
      const res = await fetch(`/api/conteudo/${itemEmEdicao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novo_comentario_equipe: novoComentarioTexto.trim(),
          autor_nome: autorNome,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comentário');

      setItemEmEdicao(data.item);
      setItems((prev) => prev.map((i) => (i.id === itemEmEdicao.id ? data.item : i)));
      setNovoComentarioTexto('');
      showToast('Comentário registrado na demanda!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar comentário.', 'error');
    } finally {
      setEnviandoComentario(false);
    }
  }

  async function handleExcluirDemanda(itemId: string) {
    if (!(await confirmDialog({title: "Excluir esta demanda?",description: "Ela sai da esteira junto com comentários e arquivos anexados.",confirmLabel: "Excluir demanda",tone: "destructive"}))) return;

    setExcluindoItem(true);
    try {
      const res = await fetch(`/api/conteudo/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir demanda.');

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setItemEmEdicao(null);
      showToast('Demanda excluída da esteira.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir.', 'error');
    } finally {
      setExcluindoItem(false);
    }
  }

  const clientesFormFiltrados = useMemo(() => {
    if (!buscaClienteForm.trim()) return clientes;
    const t = buscaClienteForm.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.nicho && c.nicho.toLowerCase().includes(t))
    );
  }, [clientes, buscaClienteForm]);

  const clientesEditFiltrados = useMemo(() => {
    if (!buscaClienteEdit.trim()) return clientes;
    const t = buscaClienteEdit.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.nicho && c.nicho.toLowerCase().includes(t))
    );
  }, [clientes, buscaClienteEdit]);

  const clienteSelecionadoObj = clientes.find((c) => c.id === formClienteId);
  const clienteAtivo = clientes.find((c) => c.id === clienteSelecionado);
  const editClienteObj =
    clientes.find((c) => c.id === editClienteId) ||
    itemEmEdicao?.cliente ||
    clientes.find((c) => c.id === itemEmEdicao?.cliente_id);
  const formResponsavel = membros.find((m) => m.id === formResponsavelId);
  const formEditor = membros.find((m) => m.id === formEditorId);
  const editResponsavel = membros.find((m) => m.id === editResponsavelId);
  const editEditor = membros.find((m) => m.id === editEditorId);

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

          {/* Filtro Cliente */}
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
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-ui cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização em Kanban"
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-ui cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização em Lista"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-ui cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'feed'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização Preview de Feed 3x3"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Feed 3x3</span>
            </button>
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
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 select-none">
          {COLUNAS_KANBAN.filter((col) => !ocultarPublicados || col !== 'publicado').map((colStatus) => {
            const itensDaColuna = itemsFiltrados.filter((it) => mapearStatusParaColunaKanban(it.status) === colStatus);
            const info = STATUS_LABELS[colStatus];
            const isOver = draggingOverCol === colStatus;

            return (
              <div
                key={colStatus}
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
                className={`w-72 shrink-0 flex flex-col gap-3 p-3 rounded-2xl border transition-all duration-200 min-h-[520px] ${
                  isOver
                    ? 'bg-lime/10 border-primary ring-2 ring-primary/20 shadow-md'
                    : 'bg-accent/25 border-border'
                }`}
              >
                {/* Cabeçalho da Coluna */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-display text-foreground">{info.label}</span>
                    <span className="text-xs font-mono font-bold bg-accent text-muted-foreground px-2 py-0.5 rounded-md border border-border">
                      {itensDaColuna.length}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{info.tag}</span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="flex flex-col gap-3">
                  {itensDaColuna.map((item) => {
                    const temComentarios = (item.comentarios_revisao || []).length > 0;
                    const temAjustes = item.status === 'travado' || (item.status === 'revisao_interna' && temComentarios);
                    const isDragging = draggingItemId === item.id;
                    const isOverItem = draggingOverItemId === item.id;

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
                        className={`group p-4 rounded-2xl border bg-card shadow-2xs hover:shadow-xs transition-ui duration-200 flex flex-col gap-3 cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          temAjustes
                            ? 'border-destructive/40 bg-destructive/5'
                            : 'border-border hover:border-foreground/30'
                        } ${isDragging ? 'opacity-50 scale-98' : 'opacity-100'} ${
                          isOverItem ? 'ring-2 ring-primary border-primary bg-primary/10' : ''
                        }`}
                      >
                        {/* Indicador de Drop-target (Acima do Card) */}
                        {isOverItem && (
                          <div className="absolute -top-1.5 left-2 right-2 h-1 bg-primary rounded-full shadow-xs animate-pulse pointer-events-none z-10" />
                        )}

                        {/* Mover sem arrastar (teclado/toque) */}
                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-popup-open]]:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                          <MoverEtapaMenu
                            etapas={ETAPAS_PIPELINE.map((et) => ({ status: et.status, label: et.label }))}
                            atual={colStatus}
                            onMover={(novo) => handleMudarStatus(item.id, novo)}
                          />
                        </div>

                        {/* Capa da Demanda no Kanban */}
                        {(() => {
                          const capaUrl = (item.tipo === 'reel' && item.cover_url) || item.arquivos?.[0]?.url || (item as any).midia_url || null;
                          if (!capaUrl) return null;
                          const isReel = item.tipo === 'reel';
                          const isStory = item.tipo === 'story';
                          const isCarrossel = item.tipo === 'post';

                          return (
                            <div className="relative aspect-[16/9] w-full bg-black rounded-xl overflow-hidden border border-border shrink-0">
                              {isReel && capaUrl.match(/\.(mp4|mov|webm)/i) ? (
                                <video src={capaUrl} className="w-full h-full object-cover" muted />
                              ) : (
                                <img src={capaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              )}
                              <div className="absolute top-2 left-2">
                                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border backdrop-blur-md uppercase tracking-wider ${
                                  isReel ? 'bg-destructive/90 text-destructive-foreground border-destructive-ring' :
                                  isStory ? 'bg-info/90 text-info-foreground border-info-ring' :
                                  isCarrossel ? 'bg-success/90 text-success-foreground border-success-ring' :
                                  'bg-warning/90 text-warning-foreground border-warning-ring'
                                }`}>
                                  {isReel ? '🎬 Reels' : isStory ? '⚡ Story' : isCarrossel ? '🖼️ Carrossel' : '📌 Post'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Header do Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClienteAvatar
                              nome={item.cliente?.nome || 'Cliente'}
                              cor={item.cliente?.cor}
                              fotoUrl={item.cliente?.foto_url}
                              tamanho="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {item.cliente?.nome}
                              </p>
                              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                {item.tipo}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.prioridade && item.prioridade !== 'media' && PRIORIDADE_CONFIG[item.prioridade] && (
                              <span
                                className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border flex items-center gap-1 ${
                                  PRIORIDADE_CONFIG[item.prioridade].bg
                                } ${PRIORIDADE_CONFIG[item.prioridade].text} ${
                                  PRIORIDADE_CONFIG[item.prioridade].border
                                }`}
                                title={`Prioridade ${PRIORIDADE_CONFIG[item.prioridade].label}`}
                              >
                                <span>{PRIORIDADE_CONFIG[item.prioridade].flag}</span>
                                <span>{PRIORIDADE_CONFIG[item.prioridade].label}</span>
                              </span>
                            )}
                            <Badge variant={info.variant} className="text-xs font-bold">
                              {info.label}
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirModalEditar(item);
                              }}
                              title="Editar Demanda"
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Título */}
                        {item.titulo && (
                          <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                            {item.titulo}
                          </h4>
                        )}

                        {/* Badges de Slides, Prazo e Responsável */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {item.arquivos?.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-accent/60 text-muted-foreground font-mono font-medium border border-border">
                              {item.arquivos.length} {item.tipo === 'reel' ? 'vídeo' : 'slides'}
                            </span>
                          )}

                          {item.prazo && (
                            <span className="px-2 py-0.5 rounded-md bg-accent/60 text-muted-foreground font-mono flex items-center gap-1 border border-border">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(item.prazo).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                            </span>
                          )}

                          {temComentarios && (
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 border ${
                                temAjustes
                                  ? 'bg-destructive/15 text-destructive border-destructive/20'
                                  : 'bg-brand-soft text-brand-text border-brand-ring'
                              }`}
                            >
                              <MessageSquare className="w-3 h-3" />
                              {item.comentarios_revisao.length} ajustes
                            </span>
                          )}
                        </div>

                        {/* Responsável */}
                        {item.responsavel && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pt-1 border-t border-border">
                            <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-foreground">
                              {item.responsavel.nome[0].toUpperCase()}
                            </div>
                            <span className="truncate">{item.responsavel.nome}</span>
                          </div>
                        )}

                        {/* Status de Aprovação com Cliente */}
                        {item.status === 'revisao_cliente' && (
                          <div className="p-2.5 rounded-xl bg-warning-soft border border-warning-ring flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-warning font-semibold min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse shrink-0" />
                              <span className="truncate">Aguardando {item.cliente?.nome || 'Cliente'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/aprovacao/${item.token_aprovacao}`, '_blank');
                              }}
                              title="Ver exatamente como o cliente visualiza a tela de aprovação"
                              className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-xs underline cursor-pointer"
                            >
                              Ver tela
                            </button>
                          </div>
                        )}

                        {/* Status de Agendamento */}
                        {(colStatus === 'agendamento' || item.status === 'agendamento' || item.status === 'pronto_publicar') && (
                          item.data_programada || item.scheduled_post_id ? (
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-primary font-semibold min-w-0">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  {item.data_programada
                                    ? `Agendado: ${new Date(item.data_programada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(item.data_programada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                    : 'Agendado no Instagram'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-primary font-semibold min-w-0">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Aprovado • Pronto para agendar</span>
                              </div>
                            </div>
                          )
                        )}

                        {/* Status de Publicado */}
                        {(colStatus === 'publicado' || item.status === 'publicado') && (
                          <div className="p-2 rounded-xl bg-success-soft border border-success-ring flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-success font-semibold min-w-0">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {item.publicado_em
                                  ? `Publicado: ${new Date(item.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(item.publicado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                  : 'Publicado no Instagram'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Ações Rápidas: Link, Editar e Enviar p/ Aprovação / Agendar */}
                        <div className="border-t border-border pt-2.5 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopiarLinkAprovacao(item.token_aprovacao);
                              }}
                              title="Copiar link público de aprovação"
                              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-accent/60 transition-colors"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Link</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirModalEditar(item);
                              }}
                              title="Editar Demanda"
                              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-accent/60 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          </div>

                          {(() => {
                            const isPublicado = colStatus === 'publicado' || item.status === 'publicado';
                            const isAgendadoCol = colStatus === 'agendamento' || item.status === 'agendamento' || item.status === 'pronto_publicar';
                            const isAgendadoComData = isAgendadoCol && Boolean(item.scheduled_post_id || item.data_programada);

                            if (isPublicado) {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-success-soft text-success border border-success-ring">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Publicado</span>
                                </span>
                              );
                            }

                            if (isAgendadoCol) {
                              if (isAgendadoComData) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLevarParaAgendamento(item);
                                    }}
                                    title="Ver ou reagendar publicação agendada"
                                    className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-ui cursor-pointer"
                                  >
                                    <Calendar className="w-3 h-3" />
                                    <span>Agendado</span>
                                  </button>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLevarParaAgendamento(item);
                                  }}
                                  title="Levar demanda aprovada direto para a tela de Agendamento do Instagram"
                                  className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 bg-primary hover:bg-primary/85 text-primary-foreground border border-primary/40 shadow-xs transition-ui cursor-pointer"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Agendar</span>
                                </button>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalAprovacao(item);
                                }}
                                title={
                                  item.status === 'revisao_cliente'
                                    ? 'Reenviar mensagem e link de aprovação no WhatsApp do cliente/grupo'
                                    : 'Enviar para aprovação no WhatsApp Web'
                                }
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border shadow-2xs transition-ui cursor-pointer ${
                                  item.status === 'revisao_cliente'
                                    ? 'bg-warning hover:bg-warning/90 text-warning-foreground border-warning-ring'
                                    : 'bg-lime hover:bg-lime/90 text-lime-foreground font-bold border-foreground/15 shadow-xs active:scale-[0.98]'
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                <span>{item.status === 'revisao_cliente' ? 'Reenviar' : 'Aprovação'}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista */
        <Card padding="lg" className="rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="uppercase text-xs font-bold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Título / Formato</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Mídia</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itemsFiltrados.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleAbrirModalEditar(item)}
                    className="hover:bg-accent/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <ClienteAvatar
                          nome={item.cliente?.nome || 'Cliente'}
                          cor={item.cliente?.cor}
                          tamanho="sm"
                        />
                        <span>{item.cliente?.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-foreground font-medium">
                      {item.titulo || 'Sem título'} ({item.tipo})
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={STATUS_LABELS[item.status].variant}>
                        {STATUS_LABELS[item.status].label}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {item.responsavel?.nome || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-3 font-mono">{item.arquivos?.length || 0} arquivos</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopiarLinkAprovacao(item.token_aprovacao);
                          }}
                          title="Copiar Link"
                          className="p-1.5 rounded-lg border border-border hover:bg-accent"
                        >
                          <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbrirModalEditar(item);
                          }}
                          title="Editar Demanda"
                          className="p-1.5 rounded-lg border border-border hover:bg-accent"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        {(() => {
                          const isPublicado = item.status === 'publicado';
                          const isAgendadoCol = item.status === 'agendamento' || item.status === 'pronto_publicar';
                          const isAgendadoComData = isAgendadoCol && Boolean(item.scheduled_post_id || item.data_programada);

                          if (isPublicado) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-success-soft text-success border border-success-ring">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Publicado</span>
                              </span>
                            );
                          }

                          if (isAgendadoCol) {
                            if (isAgendadoComData) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLevarParaAgendamento(item);
                                  }}
                                  title="Ver ou reagendar publicação agendada"
                                  className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary font-bold flex items-center gap-1 shadow-2xs cursor-pointer text-xs"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Agendado</span>
                                </button>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLevarParaAgendamento(item);
                                }}
                                title="Levar demanda aprovada para a tela de Agendamento"
                                className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/85 text-primary-foreground font-bold flex items-center gap-1 shadow-2xs cursor-pointer text-xs"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Agendar</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirModalAprovacao(item);
                              }}
                              title={
                                item.status === 'revisao_cliente'
                                  ? 'Reenviar mensagem e link de aprovação no WhatsApp do cliente/grupo'
                                  : 'Enviar para aprovação no WhatsApp'
                              }
                              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs cursor-pointer text-xs ${
                                item.status === 'revisao_cliente'
                                  ? 'bg-warning hover:bg-warning/90 text-warning-foreground border border-warning-ring'
                                  : 'bg-lime hover:bg-lime/90 text-lime-foreground border border-foreground/15 shadow-xs active:scale-[0.98]'
                              }`}
                            >
                              <Send className="w-3 h-3" />
                              <span>{item.status === 'revisao_cliente' ? 'Reenviar' : 'WhatsApp'}</span>
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 3. Modal Trello-Style Redesenhado: Nova Demanda (Pipeline Stepper, Micro-pills, Matriz de Prioridade) */}
      <Sheet
        open={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        dirty={novoSujo}
        aria-label="Nova Demanda"
        className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl p-0 overflow-hidden"
      >
        <form onSubmit={handleSalvarNovo} className="flex flex-col max-h-[92vh] w-full bg-card select-none">
          {/* 1. Header Slim de Linha Única (48px - Ultra Compacto) */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 bg-card shrink-0">
            {/* Esquerda: Tag Nova Demanda + Título Inline */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="text-xs font-mono font-bold text-primary uppercase px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 shrink-0">
                + Nova Demanda
              </span>

              {/* Título da Demanda Editável Direto */}
              <Input
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Título ou Tema da Publicação..."
                className="text-base sm:text-lg font-bold font-display text-foreground bg-transparent border-none focus:outline-none focus:ring-0 p-0 h-auto placeholder:text-muted-foreground flex-1 min-w-0"
                required
              />
            </div>

            {/* Centro/Direita: Stepper de Status Inicial Compacto + Fechar */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Stepper Pipeline Compacto em Linha */}
              <div className="hidden md:flex items-center bg-accent/30 rounded-lg p-0.5 border border-border">
                {ETAPAS_PIPELINE.map((etapa) => {
                  const currentStep = getEtapaIndex(formStatusInicial);
                  const isCurrent = etapa.step === currentStep;
                  const isDone = etapa.step < currentStep;

                  return (
                    <button
                      key={etapa.status}
                      type="button"
                      onClick={() => setFormStatusInicial(etapa.status)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-ui cursor-pointer ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                          : isDone
                          ? 'text-primary hover:bg-accent/60'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                      }`}
                      title={`Definir etapa inicial: ${etapa.label}`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-xs shrink-0 font-mono ${
                          isCurrent
                            ? 'bg-primary-foreground text-primary font-bold'
                            : isDone
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted-foreground/20 text-muted-foreground'
                        }`}
                      >
                        {isDone ? <Check className="w-2.5 h-2.5" /> : etapa.step}
                      </span>
                      <span className="hidden xl:inline">{etapa.short}</span>
                    </button>
                  );
                })}
              </div>

              {/* Seletor dropdown para mobile */}
              <div className="md:hidden">
                <Select
                  value={formStatusInicial}
                  onChange={(e) => setFormStatusInicial(e.target.value as StatusConteudo)}
                  className="h-8 text-xs font-bold"
                >
                  {ETAPAS_PIPELINE.map((etapa) => (
                    <option key={etapa.status} value={etapa.status}>
                      {etapa.step}. {etapa.label}
                    </option>
                  ))}
                </Select>
              </div>

              <button
                type="button"
                onClick={fecharNovo}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Body Rolável Dividido em 2 Colunas */}
          <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUNA DA ESQUERDA (7 Cols): Formato Rápido, Abas/Split de Redação, Legenda e Briefing */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* 1. Barra de Formato (28px) + Toggle Abas vs Split */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground font-display shrink-0">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Formato:</span>
                </div>
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-accent/40 rounded-lg border border-border max-w-sm flex-1">
                  {[
                    { id: 'post' as const, label: 'Carrossel (4:5)', icon: ImageIcon },
                    { id: 'reel' as const, label: 'Reels (9:16)', icon: Video },
                    { id: 'story' as const, label: 'Story', icon: Smartphone },
                    { id: 'avulso' as const, label: 'Avulso', icon: Sparkles },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setFormTipo(fmt.id)}
                      className={`h-6.5 px-2 rounded-md flex items-center justify-center gap-1 text-xs font-bold transition-ui cursor-pointer ${
                        formTipo === fmt.id
                          ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <fmt.icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{fmt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Alternador de Modo: Abas vs Dividido */}
                <div className="hidden sm:flex items-center bg-accent/30 rounded-lg p-0.5 border border-border text-xs shrink-0">
                  <SegmentedItem
                    type="button"
                    onClick={() => setFormModoVisualizacao('abas')}
                    group="esteira-tab-1833"
                    active={formModoVisualizacao === 'abas'}
                    className="px-2 py-0.5 rounded-md font-semibold text-xs"
                    title="Visualização em Abas (Espaço Máximo para Redação)"
                  >
                    Abas
                  </SegmentedItem>
                  <SegmentedItem
                    type="button"
                    onClick={() => setFormModoVisualizacao('split')}
                    group="esteira-tab-1833"
                    active={formModoVisualizacao === 'split'}
                    className="px-2 py-0.5 rounded-md font-semibold text-xs"
                    title="Visualização Dividida (Legenda + Briefing Visíveis Juntos)"
                  >
                    Dividido
                  </SegmentedItem>
                </div>
              </div>

              {/* 2. Visualização em Modo ABAS (Padrão Recomendado - 100% Espaço de Redação) */}
              {formModoVisualizacao === 'abas' && (
                <div className="flex flex-col gap-2.5 flex-1 min-h-0">
                  {/* Seletor de Abas de Conteúdo */}
                  <div className="flex items-center gap-1 p-1 bg-accent/30 rounded-xl border border-border shrink-0">
                    <SegmentedItem
                      type="button"
                      onClick={() => setFormAbaConteudo('legenda')}
                      group="esteira-tab-1861"
                      active={formAbaConteudo === 'legenda'}
                      className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"
                    >
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>Legenda da Postagem</span>
                      <span className="text-xs font-mono text-muted-foreground ml-1">
                        ({formLegenda.length}/2.200)
                      </span>
                    </SegmentedItem>

                    <SegmentedItem
                      type="button"
                      onClick={() => setFormAbaConteudo('briefing')}

                      group="esteira-tab-1861"

                      active={formAbaConteudo === 'briefing'}

                      className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"

                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Briefing & Roteiro</span>
                      {formBriefing.trim() && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </SegmentedItem>

                    {formTipo === 'reel' && (
                      <SegmentedItem
                        type="button"
                        onClick={() => setFormAbaConteudo('capa')}
                        group="esteira-tab-1861"
                        active={formAbaConteudo === 'capa'}
                        className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        <span>Capa</span>
                        {formCapaUrl && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </SegmentedItem>
                    )}

                    <SegmentedItem
                      type="button"
                      onClick={() => setFormAbaConteudo('anexos')}

                      group="esteira-tab-1861"

                      active={formAbaConteudo === 'anexos'}

                      className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"

                    >
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                      <span>{formTipo === 'reel' ? 'Vídeo' : 'Mídias & Anexos'}</span>
                      <span className="text-xs font-mono text-muted-foreground ml-0.5">
                        ({formArquivos.length})
                      </span>
                    </SegmentedItem>
                  </div>

                  {/* Conteúdo Aba: Legenda */}
                  {formAbaConteudo === 'legenda' && (
                    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                      {/* Toolbar de Formatação */}
                      <div className="flex items-center gap-1 p-1.5 bg-accent/40 rounded-t-xl border border-border border-b-0 text-xs text-muted-foreground flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormLegenda((prev) => `${prev} **texto em destaque**`)}
                          className="px-2 py-0.5 rounded hover:bg-card font-bold text-foreground cursor-pointer text-xs"
                          title="Negrito"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormLegenda((prev) => `${prev} *texto itálico*`)}
                          className="px-2 py-0.5 rounded hover:bg-card italic text-foreground cursor-pointer text-xs"
                          title="Itálico"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormLegenda((prev) => `${prev}\n• `)}
                          className="px-2 py-0.5 rounded hover:bg-card font-mono text-foreground cursor-pointer text-xs"
                          title="Lista com tópicos"
                        >
                          := Lista
                        </button>
                        <span className="w-px h-3 bg-border mx-1" />
                        {['🚀', '👉', '💡', '🔥', '✅', '💪', '🎯', '📲', '📸', '📅'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setFormLegenda((prev) => `${prev} ${emoji}`)}
                            className="p-1 rounded hover:bg-card cursor-pointer text-xs"
                          >
                            {emoji}
                          </button>
                        ))}
                        <span className="w-px h-3 bg-border mx-1" />
                        <button
                          type="button"
                          onClick={() => setFormLegenda((prev) => `${prev}\n\n#marketing #conteudo`)}
                          className="px-1.5 py-0.5 rounded hover:bg-card text-muted-foreground hover:text-foreground text-xs font-mono"
                          title="Inserir Hashtags"
                        >
                          #tags
                        </button>
                      </div>

                      {/* Editor de Legenda Generoso */}
                      <Textarea
                        value={formLegenda}
                        onChange={(e) => setFormLegenda(e.target.value)}
                        placeholder="Escreva a legenda oficial da postagem com hashtags, quebras de linha e chamada para ação (CTA)..."
                        rows={11}
                        className="rounded-t-none rounded-b-xl text-sm font-sans leading-relaxed bg-card flex-1 min-h-[260px] sm:min-h-[300px] xl:min-h-[350px] resize-y"
                      />
                    </div>
                  )}

                  {/* Conteúdo Aba: Briefing & Roteiro */}
                  {formAbaConteudo === 'briefing' && (
                    <div className="flex flex-col gap-2 flex-1 min-h-0">
                      <div className="p-2.5 rounded-xl bg-accent/20 border border-border text-xs text-muted-foreground flex items-center justify-between">
                        <span>Instruções para designer, editor de vídeo, copywriter ou roteiro cena a cena da peça.</span>
                        <span className="font-mono text-xs">{formBriefing.length} caracteres</span>
                      </div>
                      <Textarea
                        value={formBriefing}
                        onChange={(e) => setFormBriefing(e.target.value)}
                        placeholder="Exemplo de Roteiro / Briefing:&#10;&#10;Cena 1 (Gancho): Mostrar o antes e depois do procedimento com zoom...&#10;Cena 2: Explicar por que acontece em 3 tópicos...&#10;Cena 3 (CTA): Direcionar pro link na bio ou direct..."
                        rows={12}
                        className="rounded-xl text-sm font-sans leading-relaxed bg-card flex-1 min-h-[280px] sm:min-h-[320px] xl:min-h-[360px] resize-y"
                      />
                    </div>
                  )}

                  {/* Conteúdo Aba: Mídias & Anexos */}
                  {formAbaConteudo === 'capa' && formTipo === 'reel' && (
                    <CapaReelsField
                      url={formCapaUrl}
                      onChange={setFormCapaUrl}
                      onPreview={setPreviewCapaLightbox}
                      onErro={(msg) => showToast(msg, 'error')}
                    />
                  )}

                  {formAbaConteudo === 'anexos' && (
                    <div className="flex flex-col gap-3 flex-1 min-h-0">
                      {/* Dropzone Compacto */}
                      <div className="relative border-2 border-dashed border-border hover:border-foreground/30 rounded-2xl p-4 text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors">
                        <input
                          type="file"
                          multiple={formTipo !== 'reel'}
                          accept={formTipo === 'reel' ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime'}
                          onChange={handleFormFilesChange}
                          disabled={formUploading}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                        />
                        <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-foreground shadow-2xs">
                          <UploadCloud className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-xs font-bold text-foreground">
                          Clique ou arraste novos arquivos para anexar
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formTipo === 'reel' ? 'Vídeo MP4 em 9:16' : 'Selecione fotos para Carrossel em 4:5'}
                        </p>
                      </div>

                      {/* Grade de Arquivos */}
                      {formArquivos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                          {formArquivos.map((arq, idx) => (
                            <div
                              key={arq.id || idx}
                              className="p-2.5 rounded-xl bg-accent/30 border border-border flex items-center justify-between gap-2.5 group hover:border-foreground/30 transition-ui"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-black overflow-hidden shrink-0 border border-border relative">
                                  {arq.tipo === 'video' ? (
                                    <video src={arq.url} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <img src={arq.url} alt="" className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-foreground truncate">
                                      {arq.nome || `Arquivo_${idx + 1}`}
                                    </span>
                                    {idx === 0 && (
                                      <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                                        ⭐ Capa
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    #{idx + 1} · {arq.tipo === 'video' ? 'Vídeo' : 'Imagem'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewCapaLightbox(arq.url)}
                                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Visualizar em tamanho real"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormArquivos((prev) => prev.filter((_, i) => i !== idx))}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                                  title="Remover anexo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-4">
                          Nenhum arquivo anexado a esta demanda.
                        </p>
                      )}

                      {/* Inserir Link Manual */}
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => setShowManualUrlsForm((v) => !v)}
                          className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>{showManualUrlsForm ? '- Ocultar links manuais' : '+ Inserir links externos manualmente (Google Drive / CDN)'}</span>
                        </button>
                        {showManualUrlsForm && (
                          <Textarea
                            placeholder="https://.../slide-01.png&#10;https://.../slide-02.png"
                            value={formUrls}
                            onChange={(e) => setFormUrls(e.target.value)}
                            rows={2}
                            className="mt-1.5 text-xs font-mono"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Visualização em Modo DIVIDIDO (Split - Briefing Compacto + Legenda Juntos) */}
              {formModoVisualizacao === 'split' && (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  {/* Briefing Compacto no Topo */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Briefing & Roteiro da Peça</span>
                      </label>
                      <span className="text-xs text-muted-foreground font-mono">{formBriefing.length} caracteres</span>
                    </div>
                    <Textarea
                      value={formBriefing}
                      onChange={(e) => setFormBriefing(e.target.value)}
                      placeholder="Instruções para a equipe, ganchos, cenas ou tópicos do post..."
                      rows={3}
                      className="rounded-xl text-xs bg-card"
                    />
                  </div>

                  {/* Legenda Logo Abaixo com Toolbar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Legenda da Postagem (Instagram)</span>
                      </label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {formLegenda.length} / 2.200
                      </span>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-accent/40 rounded-t-xl border border-border border-b-0 text-xs text-muted-foreground flex-wrap">
                      <button
                        type="button"
                        onClick={() => setFormLegenda((prev) => `${prev} **texto em destaque**`)}
                        className="px-1.5 py-0.5 rounded hover:bg-card font-bold text-foreground text-xs"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormLegenda((prev) => `${prev} *texto itálico*`)}
                        className="px-1.5 py-0.5 rounded hover:bg-card italic text-foreground text-xs"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormLegenda((prev) => `${prev}\n• `)}
                        className="px-1.5 py-0.5 rounded hover:bg-card font-mono text-foreground text-xs"
                      >
                        :=
                      </button>
                      <span className="w-px h-3 bg-border mx-1" />
                      {['🚀', '👉', '💡', '🔥', '✅'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormLegenda((prev) => `${prev} ${emoji}`)}
                          className="p-1 rounded hover:bg-card text-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={formLegenda}
                      onChange={(e) => setFormLegenda(e.target.value)}
                      placeholder="Escreva a legenda..."
                      rows={6}
                      className="rounded-t-none rounded-b-xl text-sm font-sans leading-relaxed bg-card"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* COLUNA DA DIREITA (5 Cols): Inspector Unificado de Propriedades */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {/* Card Unificado de Propriedades (Linear / Notion Style) */}
              <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2.5">
                {/* Linha 1: Cliente */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                  <span className="text-xs font-bold uppercase font-mono text-muted-foreground flex items-center gap-1.5 shrink-0">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Cliente: *
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    {clienteSelecionadoObj && !trocarClienteAbertoNovo ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <ClienteAvatar nome={clienteSelecionadoObj.nome} cor={clienteSelecionadoObj.cor} fotoUrl={clienteSelecionadoObj.foto_url} tamanho="sm" />
                        <span className="text-xs font-bold text-foreground truncate max-w-[130px]">{clienteSelecionadoObj.nome}</span>
                        <button
                          type="button"
                          onClick={() => setTrocarClienteAbertoNovo(true)}
                          className="text-xs font-bold text-primary hover:underline cursor-pointer ml-0.5"
                        >
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTrocarClienteAbertoNovo((v) => !v)}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        {trocarClienteAbertoNovo ? 'Fechar' : 'Selecionar'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Busca de Cliente (se expandido) */}
                {trocarClienteAbertoNovo && (
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={buscaClienteForm}
                        onChange={(e) => setBuscaClienteForm(e.target.value)}
                        className="pl-8 h-8 text-xs bg-card"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 p-1 border border-border rounded-xl bg-card">
                      {clientesFormFiltrados.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-1 text-center">Nenhum cliente encontrado.</p>
                      ) : (
                        clientesFormFiltrados.map((c) => {
                          const isSelected = formClienteId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setFormClienteId(c.id);
                                setTrocarClienteAbertoNovo(false);
                              }}
                              className={`flex items-center gap-2 p-1.5 rounded-lg text-left transition-ui cursor-pointer ${
                                isSelected
                                  ? 'bg-accent/80 font-bold text-foreground'
                                  : 'hover:bg-accent/40 text-muted-foreground'
                              }`}
                            >
                              <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={c.foto_url} tamanho="sm" />
                              <span className="text-xs truncate flex-1">{c.nome}</span>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Linha 2: Prioridade (4 Chips em 1 Linha Contínua) */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                  <span className="text-xs font-bold uppercase font-mono text-muted-foreground shrink-0">
                    Prioridade:
                  </span>
                  <div className="grid grid-cols-4 gap-1 flex-1 max-w-[270px]">
                    {(
                      [
                        { id: 'urgente', label: 'Urgente', flag: '🔴' },
                        { id: 'alta', label: 'Alta', flag: '🟠' },
                        { id: 'media', label: 'Média', flag: '🔵' },
                        { id: 'baixa', label: 'Baixa', flag: '🟢' },
                      ] as const
                    ).map((p) => {
                      const isSelected = formPrioridade === p.id;
                      const conf = PRIORIDADE_CONFIG[p.id];
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormPrioridade(p.id)}
                          className={`h-7 px-1.5 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-ui text-xs ${
                            isSelected
                              ? `${conf.bg} ${conf.border} ${conf.text} font-bold shadow-2xs ring-1 ring-primary/20`
                              : 'bg-card hover:bg-accent/50 border-border text-foreground font-semibold hover:border-foreground/30'
                          }`}
                          title={p.label}
                        >
                          <span className="text-xs">{p.flag}</span>
                          <span className="text-xs font-semibold">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Linha 3: Equipe (Responsável & Designer Lado a Lado) */}
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
                  <MemberChipSelect
                    label="Responsável Principal"
                    value={formResponsavelId}
                    onChange={setFormResponsavelId}
                    membros={membros}
                    placeholder="Atribuir..."
                  />
                  <MemberChipSelect
                    label="Designer / Editor"
                    value={formEditorId}
                    onChange={setFormEditorId}
                    membros={membros}
                    placeholder="Atribuir..."
                  />
                </div>

                {/* Linha 4: Prazos (Prazo Interno & Data Programada) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>Prazo Interno</span>
                    </label>
                    <Input
                      type="date"
                      value={formPrazoInterno}
                      onChange={(e) => setFormPrazoInterno(e.target.value)}
                      className="h-7.5 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>Data Programada</span>
                    </label>
                    <Input
                      type="date"
                      value={formDataProgramada}
                      onChange={(e) => setFormDataProgramada(e.target.value)}
                      className="h-7.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Footer Fixo */}
          <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex items-center justify-end gap-2 z-20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fecharNovo}
              className="rounded-xl text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={salvando}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-2xs px-4"
            >
              Cadastrar Demanda
            </Button>
          </div>
        </form>

        {/* Lightbox aninhado: Esc fecha só o zoom, não o formulário */}
        <MediaLightbox src={previewCapaLightbox} onClose={() => setPreviewCapaLightbox(null)} alt="Capa da postagem" />
      </Sheet>

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

      {/* 5. Modal Trello-Style Redesenhado: Editar & Detalhes da Demanda (2 Colunas) */}
      {/* 5. Modal Trello-Style Redesenhado: Editar & Detalhes da Demanda (Pipeline Stepper, Micro-pills, Matriz de Prioridade) */}
      <Sheet
        open={!!itemEmEdicao}
        onClose={() => setItemEmEdicao(null)}
        dirty={editSujo}
        aria-label="Editar Demanda"
        className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl p-0 overflow-hidden"
      >
        {itemEmEdicao && (
          <form onSubmit={handleSalvarEdicao} className="flex flex-col max-h-[92vh] w-full bg-card select-none">
            {/* 1. Header Slim de Linha Única (48px - Ultra Compacto) */}
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 bg-card shrink-0">
              {/* Esquerda: ID da Demanda + Título Inline + Chip de Capa */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="text-xs font-mono font-bold text-muted-foreground uppercase px-2 py-0.5 rounded-md bg-accent/60 border border-border shrink-0">
                  #{itemEmEdicao.id.slice(0, 8)}
                </span>

                {/* Se houver capa/mídia, chip compacto com preview e zoom */}
                {editTipo === 'reel' && editCapaUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewCapaLightbox(editCapaUrl)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent/60 hover:bg-accent border border-border text-xs font-semibold text-foreground shrink-0 transition-colors cursor-pointer group"
                    title="Clique para ampliar a capa"
                  >
                    <div className="w-4 h-4 rounded overflow-hidden bg-black shrink-0 border border-border">
                      <img src={editCapaUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="hidden sm:inline">Capa</span>
                    <Maximize2 className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                  </button>
                ) : editArquivos[0]?.url && (
                  <button
                    type="button"
                    onClick={() => setPreviewCapaLightbox(editArquivos[0].url)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent/60 hover:bg-accent border border-border text-xs font-semibold text-foreground shrink-0 transition-colors cursor-pointer group"
                    title="Clique para ampliar a capa"
                  >
                    <div className="w-4 h-4 rounded overflow-hidden bg-black shrink-0 border border-border">
                      {editArquivos[0].tipo === 'video' ? (
                        <video src={editArquivos[0].url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={editArquivos[0].url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="hidden sm:inline">Capa</span>
                    <Maximize2 className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                  </button>
                )}

                {/* Título da Demanda Editável Direto */}
                <Input
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  placeholder="Título da Demanda..."
                  className="text-base sm:text-lg font-bold font-display text-foreground bg-transparent border-none focus:outline-none focus:ring-0 p-0 h-auto placeholder:text-muted-foreground flex-1 min-w-0"
                  required
                />
              </div>

              {/* Centro/Direita: Stepper de Status Compacto + Ações */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Stepper Pipeline Compacto em Linha (sem scroll horizontal) */}
                <div className="hidden md:flex items-center bg-accent/30 rounded-lg p-0.5 border border-border">
                  {ETAPAS_PIPELINE.map((etapa) => {
                    const currentStep = getEtapaIndex(editStatus);
                    const isCurrent = etapa.step === currentStep;
                    const isDone = etapa.step < currentStep;

                    return (
                      <button
                        key={etapa.status}
                        type="button"
                        onClick={() => setEditStatus(etapa.status)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-ui cursor-pointer ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                            : isDone
                            ? 'text-primary hover:bg-accent/60'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                        }`}
                        title={`Etapa: ${etapa.label}`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-xs shrink-0 font-mono ${
                            isCurrent
                              ? 'bg-primary-foreground text-primary font-bold'
                              : isDone
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted-foreground/20 text-muted-foreground'
                          }`}
                        >
                          {isDone ? <Check className="w-2.5 h-2.5" /> : etapa.step}
                        </span>
                        <span className="hidden xl:inline">{etapa.short}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown de status para telas menores */}
                <div className="md:hidden">
                  <Select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as StatusConteudo)}
                    className="h-8 text-xs font-bold"
                  >
                    {ETAPAS_PIPELINE.map((etapa) => (
                      <option key={etapa.status} value={etapa.status}>
                        {etapa.step}. {etapa.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Ações Rápidas */}
                <button
                  type="button"
                  onClick={() => handleCopiarLinkAprovacao(itemEmEdicao.token_aprovacao)}
                  className="px-2.5 py-1.5 rounded-lg bg-accent/60 hover:bg-accent border border-border text-foreground font-semibold flex items-center gap-1.5 cursor-pointer transition-colors text-xs"
                  title="Copiar Link de Aprovação do Cliente"
                >
                  <Share2 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Link Aprovação</span>
                </button>

                {(editStatus === 'agendamento' || editStatus === 'pronto_publicar') && onIrParaAgendamento && (
                  <button
                    type="button"
                    onClick={() => handleLevarParaAgendamento(itemComEdicoes(itemEmEdicao))}
                    className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/85 text-primary-foreground font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs"
                    title="Agendar Postagem"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Agendamento</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={fecharEdicao}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Body Rolável Dividido em 2 Colunas */}
            <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* COLUNA DA ESQUERDA (7 Cols): Formato Rápido, Abas/Split de Redação, Legenda e Briefing */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                {/* 1. Barra de Formato (28px) + Toggle Abas vs Split */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground font-display shrink-0">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>Formato:</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-0.5 bg-accent/40 rounded-lg border border-border max-w-sm flex-1">
                    {[
                      { id: 'post' as const, label: 'Carrossel (4:5)', icon: ImageIcon },
                      { id: 'reel' as const, label: 'Reels (9:16)', icon: Video },
                      { id: 'story' as const, label: 'Story', icon: Smartphone },
                      { id: 'avulso' as const, label: 'Avulso', icon: Sparkles },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setEditTipo(fmt.id)}
                        className={`h-6.5 px-2 rounded-md flex items-center justify-center gap-1 text-xs font-bold transition-ui cursor-pointer ${
                          editTipo === fmt.id
                            ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                        }`}
                      >
                        <fmt.icon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{fmt.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Alternador de Modo: Abas vs Dividido */}
                  <div className="hidden sm:flex items-center bg-accent/30 rounded-lg p-0.5 border border-border text-xs shrink-0">
                    <SegmentedItem
                      type="button"
                      onClick={() => setEditModoVisualizacao('abas')}
                      group="esteira-tab-2592"
                      active={editModoVisualizacao === 'abas'}
                      className="px-2 py-0.5 rounded-md font-semibold text-xs"
                      title="Visualização em Abas (Espaço Máximo para Redação)"
                    >
                      Abas
                    </SegmentedItem>
                    <SegmentedItem
                      type="button"
                      onClick={() => setEditModoVisualizacao('split')}
                      group="esteira-tab-2592"
                      active={editModoVisualizacao === 'split'}
                      className="px-2 py-0.5 rounded-md font-semibold text-xs"
                      title="Visualização Dividida (Legenda + Briefing Visíveis Juntos)"
                    >
                      Dividido
                    </SegmentedItem>
                  </div>
                </div>

                {/* 2. Visualização em Modo ABAS (Padrão Recomendado - 100% Espaço de Redação) */}
                {editModoVisualizacao === 'abas' && (
                  <div className="flex flex-col gap-2.5 flex-1 min-h-0">
                    {/* Seletor de Abas de Conteúdo */}
                    <div className="flex items-center gap-1 p-1 bg-accent/30 rounded-xl border border-border shrink-0">
                      <SegmentedItem
                        type="button"
                        onClick={() => setEditAbaConteudo('legenda')}
                        group="esteira-tab-2620"
                        active={editAbaConteudo === 'legenda'}
                        className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Legenda da Postagem</span>
                        <span className="text-xs font-mono text-muted-foreground ml-1">
                          ({editLegenda.length}/2.200)
                        </span>
                      </SegmentedItem>

                      <SegmentedItem
                        type="button"
                        onClick={() => setEditAbaConteudo('briefing')}

                        group="esteira-tab-2620"

                        active={editAbaConteudo === 'briefing'}

                        className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"

                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Briefing & Roteiro</span>
                        {editBriefing.trim() && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </SegmentedItem>

                      {editTipo === 'reel' && (
                        <SegmentedItem
                          type="button"
                          onClick={() => setEditAbaConteudo('capa')}
                          group="esteira-tab-2620"
                          active={editAbaConteudo === 'capa'}
                          className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-primary" />
                          <span>Capa</span>
                          {editCapaUrl && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </SegmentedItem>
                      )}

                      <SegmentedItem
                        type="button"
                        onClick={() => setEditAbaConteudo('anexos')}

                        group="esteira-tab-2620"

                        active={editAbaConteudo === 'anexos'}

                        className="flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold"

                      >
                        <Paperclip className="w-3.5 h-3.5 text-primary" />
                        <span>{editTipo === 'reel' ? 'Vídeo' : 'Mídias & Anexos'}</span>
                        <span className="text-xs font-mono text-muted-foreground ml-0.5">
                          ({editArquivos.length})
                        </span>
                      </SegmentedItem>
                    </div>

                    {/* Conteúdo Aba: Legenda */}
                    {editAbaConteudo === 'legenda' && (
                      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                        {/* Toolbar de Formatação */}
                        <div className="flex items-center gap-1 p-1.5 bg-accent/40 rounded-t-xl border border-border border-b-0 text-xs text-muted-foreground flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditLegenda((prev) => `${prev} **texto em destaque**`)}
                            className="px-2 py-0.5 rounded hover:bg-card font-bold text-foreground cursor-pointer text-xs"
                            title="Negrito"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLegenda((prev) => `${prev} *texto itálico*`)}
                            className="px-2 py-0.5 rounded hover:bg-card italic text-foreground cursor-pointer text-xs"
                            title="Itálico"
                          >
                            I
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLegenda((prev) => `${prev}\n• `)}
                            className="px-2 py-0.5 rounded hover:bg-card font-mono text-foreground cursor-pointer text-xs"
                            title="Lista com tópicos"
                          >
                            := Lista
                          </button>
                          <span className="w-px h-3 bg-border mx-1" />
                          {['🚀', '👉', '💡', '🔥', '✅', '💪', '🎯', '📲', '📸', '📅'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setEditLegenda((prev) => `${prev} ${emoji}`)}
                              className="p-1 rounded hover:bg-card cursor-pointer text-xs"
                            >
                              {emoji}
                            </button>
                          ))}
                          <span className="w-px h-3 bg-border mx-1" />
                          <button
                            type="button"
                            onClick={() => setEditLegenda((prev) => `${prev}\n\n#marketing #conteudo`)}
                            className="px-1.5 py-0.5 rounded hover:bg-card text-muted-foreground hover:text-foreground text-xs font-mono"
                            title="Inserir Hashtags"
                          >
                            #tags
                          </button>
                        </div>

                        {/* Editor de Legenda Generoso */}
                        <Textarea
                          value={editLegenda}
                          onChange={(e) => setEditLegenda(e.target.value)}
                          placeholder="Escreva a legenda oficial da postagem com hashtags, quebras de linha e chamada para ação (CTA)..."
                          rows={11}
                          className="rounded-t-none rounded-b-xl text-sm font-sans leading-relaxed bg-card flex-1 min-h-[260px] sm:min-h-[300px] xl:min-h-[350px] resize-y"
                        />
                      </div>
                    )}

                    {/* Conteúdo Aba: Briefing & Roteiro */}
                    {editAbaConteudo === 'briefing' && (
                      <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="p-2.5 rounded-xl bg-accent/20 border border-border text-xs text-muted-foreground flex items-center justify-between">
                          <span>Instruções para designer, editor de vídeo, copywriter ou roteiro cena a cena da peça.</span>
                          <span className="font-mono text-xs">{editBriefing.length} caracteres</span>
                        </div>
                        <Textarea
                          value={editBriefing}
                          onChange={(e) => setEditBriefing(e.target.value)}
                          placeholder="Exemplo de Roteiro / Briefing:&#10;&#10;Cena 1 (Gancho): Mostrar o antes e depois do procedimento com zoom...&#10;Cena 2: Explicar por que acontece em 3 tópicos...&#10;Cena 3 (CTA): Direcionar pro link na bio ou direct..."
                          rows={12}
                          className="rounded-xl text-sm font-sans leading-relaxed bg-card flex-1 min-h-[280px] sm:min-h-[320px] xl:min-h-[360px] resize-y"
                        />
                      </div>
                    )}

                    {/* Conteúdo Aba: Mídias & Anexos */}
                    {editAbaConteudo === 'capa' && editTipo === 'reel' && (
                      <CapaReelsField
                        url={editCapaUrl}
                        onChange={setEditCapaUrl}
                        onPreview={setPreviewCapaLightbox}
                        onErro={(msg) => showToast(msg, 'error')}
                      />
                    )}

                    {editAbaConteudo === 'anexos' && (
                      <div className="flex flex-col gap-3 flex-1 min-h-0">
                        {/* Dropzone Compacto */}
                        <div className="relative border-2 border-dashed border-border hover:border-foreground/30 rounded-2xl p-4 text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors">
                          <input
                            type="file"
                            multiple={editTipo !== 'reel'}
                            accept={editTipo === 'reel' ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime'}
                            onChange={handleEditFilesChange}
                            disabled={editUploading}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                          />
                          <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-foreground shadow-2xs">
                            <UploadCloud className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-xs font-bold text-foreground">
                            Clique ou arraste novos arquivos para anexar
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {editTipo === 'reel' ? 'Vídeo MP4 em 9:16' : 'Selecione fotos para Carrossel em 4:5'}
                          </p>
                        </div>

                        {/* Grade de Arquivos */}
                        {editArquivos.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                            {editArquivos.map((arq, idx) => (
                              <div
                                key={arq.id || idx}
                                className="p-2.5 rounded-xl bg-accent/30 border border-border flex items-center justify-between gap-2.5 group hover:border-foreground/30 transition-ui"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-black overflow-hidden shrink-0 border border-border relative">
                                    {arq.tipo === 'video' ? (
                                      <video src={arq.url} className="w-full h-full object-cover" muted />
                                    ) : (
                                      <img src={arq.url} alt="" className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold text-foreground truncate">
                                        {arq.nome || `Arquivo_${idx + 1}`}
                                      </span>
                                      {idx === 0 && (
                                        <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                                          ⭐ Capa
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      #{idx + 1} · {arq.tipo === 'video' ? 'Vídeo' : 'Imagem'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewCapaLightbox(arq.url)}
                                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                                    title="Visualizar em tamanho real"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditArquivos((prev) => prev.filter((_, i) => i !== idx))}
                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                                    title="Remover anexo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic text-center py-4">
                            Nenhum arquivo anexado a esta demanda.
                          </p>
                        )}

                        {/* Inserir Link Manual */}
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => setShowManualUrlsEdit((v) => !v)}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <span>{showManualUrlsEdit ? '- Ocultar links manuais' : '+ Inserir links externos manualmente (Google Drive / CDN)'}</span>
                          </button>
                          {showManualUrlsEdit && (
                            <Textarea
                              placeholder="https://.../slide-01.png&#10;https://.../slide-02.png"
                              value={editUrls}
                              onChange={(e) => setEditUrls(e.target.value)}
                              rows={2}
                              className="mt-1.5 text-xs font-mono"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Visualização em Modo DIVIDIDO (Split - Briefing Compacto + Legenda Juntos) */}
                {editModoVisualizacao === 'split' && (
                  <div className="flex flex-col gap-3 flex-1 min-h-0">
                    {/* Briefing Compacto no Topo */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span>Briefing & Roteiro da Criação</span>
                        </label>
                        <span className="text-xs text-muted-foreground font-mono">{editBriefing.length} caracteres</span>
                      </div>
                      <Textarea
                        value={editBriefing}
                        onChange={(e) => setEditBriefing(e.target.value)}
                        placeholder="Instruções para a equipe, ganchos, cenas ou tópicos do post..."
                        rows={3}
                        className="rounded-xl text-xs bg-card"
                      />
                    </div>

                    {/* Legenda Logo Abaixo com Toolbar */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span>Legenda da Postagem (Instagram)</span>
                        </label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {editLegenda.length} / 2.200
                        </span>
                      </div>
                      <div className="flex items-center gap-1 p-1 bg-accent/40 rounded-t-xl border border-border border-b-0 text-xs text-muted-foreground flex-wrap">
                        <button
                          type="button"
                          onClick={() => setEditLegenda((prev) => `${prev} **texto em destaque**`)}
                          className="px-1.5 py-0.5 rounded hover:bg-card font-bold text-foreground text-xs"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditLegenda((prev) => `${prev} *texto itálico*`)}
                          className="px-1.5 py-0.5 rounded hover:bg-card italic text-foreground text-xs"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditLegenda((prev) => `${prev}\n• `)}
                          className="px-1.5 py-0.5 rounded hover:bg-card font-mono text-foreground text-xs"
                        >
                          :=
                        </button>
                        <span className="w-px h-3 bg-border mx-1" />
                        {['🚀', '👉', '💡', '🔥', '✅'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setEditLegenda((prev) => `${prev} ${emoji}`)}
                            className="p-1 rounded hover:bg-card text-xs"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={editLegenda}
                        onChange={(e) => setEditLegenda(e.target.value)}
                        placeholder="Escreva a legenda..."
                        rows={6}
                        className="rounded-t-none rounded-b-xl text-sm font-sans leading-relaxed bg-card"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* COLUNA DA DIREITA (5 Cols): Inspector Unificado de Propriedades + Comentários */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                {/* Card Unificado de Propriedades (Linear / Notion Style) */}
                <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2.5 shrink-0">
                  {/* Linha 1: Cliente */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                    <span className="text-xs font-bold uppercase font-mono text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Cliente:
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      {editClienteObj && !trocarClienteAbertoEdit ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <ClienteAvatar nome={editClienteObj.nome} cor={editClienteObj.cor} fotoUrl={editClienteObj.foto_url} tamanho="sm" />
                          <span className="text-xs font-bold text-foreground truncate max-w-[130px]">{editClienteObj.nome}</span>
                          <button
                            type="button"
                            onClick={() => setTrocarClienteAbertoEdit(true)}
                            className="text-xs font-bold text-primary hover:underline cursor-pointer ml-0.5"
                          >
                            Trocar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setTrocarClienteAbertoEdit((v) => !v)}
                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          {trocarClienteAbertoEdit ? 'Fechar' : 'Selecionar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Busca de Cliente (se expandido) */}
                  {trocarClienteAbertoEdit && (
                    <div className="flex flex-col gap-1.5 pb-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar cliente..."
                          value={buscaClienteEdit}
                          onChange={(e) => setBuscaClienteEdit(e.target.value)}
                          className="pl-8 h-8 text-xs bg-card"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 p-1 border border-border rounded-xl bg-card">
                        {clientesEditFiltrados.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-1 text-center">Nenhum cliente encontrado.</p>
                        ) : (
                          clientesEditFiltrados.map((c) => {
                            const isSelected = (editClienteId || itemEmEdicao.cliente_id) === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setEditClienteId(c.id);
                                  setTrocarClienteAbertoEdit(false);
                                }}
                                className={`flex items-center gap-2 p-1.5 rounded-lg text-left transition-ui cursor-pointer ${
                                  isSelected
                                    ? 'bg-accent/80 font-bold text-foreground'
                                    : 'hover:bg-accent/40 text-muted-foreground'
                                }`}
                              >
                                <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={c.foto_url} tamanho="sm" />
                                <span className="text-xs truncate flex-1">{c.nome}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Linha 2: Prioridade (4 Chips em 1 Linha Contínua) */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                    <span className="text-xs font-bold uppercase font-mono text-muted-foreground shrink-0">
                      Prioridade:
                    </span>
                    <div className="grid grid-cols-4 gap-1 flex-1 max-w-[270px]">
                      {(
                        [
                          { id: 'urgente', label: 'Urgente', flag: '🔴' },
                          { id: 'alta', label: 'Alta', flag: '🟠' },
                          { id: 'media', label: 'Média', flag: '🔵' },
                          { id: 'baixa', label: 'Baixa', flag: '🟢' },
                        ] as const
                      ).map((p) => {
                        const isSelected = editPrioridade === p.id;
                        const conf = PRIORIDADE_CONFIG[p.id];
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setEditPrioridade(p.id)}
                            className={`h-7 px-1.5 rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-ui text-xs ${
                              isSelected
                                ? `${conf.bg} ${conf.border} ${conf.text} font-bold shadow-2xs ring-1 ring-primary/20`
                                : 'bg-card hover:bg-accent/50 border-border text-foreground font-semibold hover:border-foreground/30'
                            }`}
                            title={p.label}
                          >
                            <span className="text-xs">{p.flag}</span>
                            <span className="text-xs font-semibold">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Linha 3: Equipe (Responsável & Designer Lado a Lado) */}
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
                    <MemberChipSelect
                      label="Responsável Principal"
                      value={editResponsavelId}
                      onChange={setEditResponsavelId}
                      membros={membros}
                      placeholder="Atribuir..."
                    />
                    <MemberChipSelect
                      label="Designer / Editor"
                      value={editEditorId}
                      onChange={setEditEditorId}
                      membros={membros}
                      placeholder="Atribuir..."
                    />
                  </div>

                  {/* Linha 4: Prazos (Prazo Interno & Data Programada) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>Prazo Interno</span>
                      </label>
                      <Input
                        type="date"
                        value={editPrazoInterno}
                        onChange={(e) => setEditPrazoInterno(e.target.value)}
                        className="h-7.5 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>Data Programada</span>
                      </label>
                      <Input
                        type="date"
                        value={editDataProgramada}
                        onChange={(e) => setEditDataProgramada(e.target.value)}
                        className="h-7.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Miniatura da Capa com Ação de Zoom (se houver mídia) */}
                  {editArquivos[0]?.url && (
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0 border border-border relative">
                          {editArquivos[0].tipo === 'video' ? (
                            <video src={editArquivos[0].url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={editArquivos[0].url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-foreground">⭐ Capa da Postagem</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {editArquivos[0].tipo === 'video' ? 'Vídeo MP4' : 'Imagem'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewCapaLightbox(editArquivos[0].url)}
                        className="px-2 py-0.5 rounded-md bg-accent/60 hover:bg-accent border border-border text-xs font-semibold text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Ampliar</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Área de Comentários & Atividades (Aproveitando a Altura Livre) */}
                <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2 flex-1 min-h-[160px]">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-display">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      Comentários & Atividades
                    </span>
                  </div>

                  {/* Ajustes do Cliente (se houver) */}
                  {(itemEmEdicao.comentarios_revisao || []).length > 0 && (
                    <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 space-y-1">
                      <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Ajustes do Cliente ({itemEmEdicao.comentarios_revisao.length})
                      </p>
                      {itemEmEdicao.comentarios_revisao.map((c) => (
                        <div key={c.id} className="text-xs p-2 rounded-lg bg-card/90 border border-border">
                          <span className="text-muted-foreground font-mono block text-xs">{c.autor || 'Cliente'}</span>
                          <p className="text-foreground mt-0.5">{c.texto}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timeline de Comentários Internos */}
                  <div className="space-y-1.5 max-h-44 sm:max-h-56 overflow-y-auto pr-1 flex-1">
                    {(!itemEmEdicao.historico_atividades || itemEmEdicao.historico_atividades.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic py-1.5">
                        Nenhuma atividade registrada ainda.
                      </p>
                    ) : (
                      itemEmEdicao.historico_atividades.map((ev) => (
                        <div key={ev.id} className="p-2 rounded-xl bg-accent/20 border border-border text-xs flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                            <span className="font-bold text-foreground">{ev.autor_nome || 'Equipe'}</span>
                            <span>{new Date(ev.criado_em).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-foreground text-xs">{ev.texto}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input Novo Comentário */}
                  <div className="flex gap-2 pt-1.5 border-t border-border shrink-0">
                    <Textarea
                      value={novoComentarioTexto}
                      onChange={(e) => setNovoComentarioTexto(e.target.value)}
                      placeholder="Comentário interno (Ctrl+Enter para enviar)..."
                      rows={2}
                      className="text-xs flex-1 bg-accent/20 resize-none h-14"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleEnviarComentarioEquipe();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!novoComentarioTexto.trim() || enviandoComentario}
                      loading={enviandoComentario}
                      onClick={handleEnviarComentarioEquipe}
                      className="h-14 px-3 text-xs bg-primary text-primary-foreground font-bold shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Footer Fixo com Ações da Demanda */}
            <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex items-center justify-between gap-2 z-20">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleExcluirDemanda(itemEmEdicao.id)}
                loading={excluindoItem}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Excluir Demanda
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fecharEdicao}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={salvandoEdicao}
                  className="rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-2xs px-4"
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Lightbox aninhado: Esc fecha só o zoom, não o formulário */}
        <MediaLightbox src={previewCapaLightbox} onClose={() => setPreviewCapaLightbox(null)} alt="Capa da postagem" />
      </Sheet>

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
