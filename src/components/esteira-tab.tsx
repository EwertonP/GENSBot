'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  Copy,
  LayoutGrid,
  Grid3X3,
  Check,
  X,
  Edit2,
  UploadCloud,
  Loader2,
  Phone,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Instagram } from '@/components/instagram-icon';
import { OnboardingBar } from '@/components/onboarding-bar';
import { FeedPreviewGrid } from '@/components/feed-preview-grid';
import {
  STATUS_LABELS,
  COLUNAS_KANBAN,
  gerarLinkWhatsAppAprovacao,
  gerarMensagemAprovacao,
  type ConteudoItem,
  type StatusConteudo,
  type TipoConteudo,
  type ArquivoConteudo,
  type PrefillAgendamento,
} from '@/lib/conteudo';
import { detectarGatilhosDaLegenda } from '@/lib/publish-automation';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';
import { upload } from '@vercel/blob/client';

interface EsteiraTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  clienteFiltroId?: string | null;
  onIrParaAgendamento?: (prefill: PrefillAgendamento) => void;
}

export default function EsteiraTab({ showToast, clienteFiltroId, onIrParaAgendamento }: EsteiraTabProps) {
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

  // Drag and Drop state
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingOverCol, setDraggingOverCol] = useState<StatusConteudo | null>(null);

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

  // Modal Editar Item
  const [itemEmEdicao, setItemEmEdicao] = useState<ConteudoItem | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoItem, setExcluindoItem] = useState(false);
  const [editStatus, setEditStatus] = useState<StatusConteudo>('planejamento');
  const [editTipo, setEditTipo] = useState<TipoConteudo>('post');
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

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (clienteSelecionado !== 'all' && item.cliente_id !== clienteSelecionado) return false;
      if (responsavelFiltro !== 'all' && item.responsavel_id !== responsavelFiltro) return false;
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
  }, [items, clienteSelecionado, responsavelFiltro, busca]);

  async function handleMudarStatus(itemId: string, novoStatus: StatusConteudo) {
    setDraggingItemId(null);
    setDraggingOverCol(null);
    const itemAnterior = items.find((i) => i.id === itemId);
    if (!itemAnterior || itemAnterior.status === novoStatus) return;

    // Atualização otimista
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: novoStatus } : i))
    );

    try {
      const res = await fetch(`/api/conteudo/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) throw new Error();
      showToast(`Movido para ${STATUS_LABELS[novoStatus].label}`, 'success');
    } catch {
      // Reverte se falhar
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: itemAnterior.status } : i))
      );
      showToast('Erro ao atualizar status.', 'error');
    }
  }

  // Helper para upload de mídias direto no Vercel Blob com fallback
  async function handleUploadArquivos(fileList: FileList | File[]): Promise<ArquivoConteudo[]> {
    const files = Array.from(fileList);
    const novos: ArquivoConteudo[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isVid = f.type.startsWith('video');
      try {
        const blob = await upload(f.name, f, {
          access: 'public',
          handleUploadUrl: '/api/instagram/upload-media',
          multipart: true,
        });
        novos.push({
          id: crypto.randomUUID(),
          url: blob.url,
          tipo: isVid ? 'video' : 'imagem',
          ordem: i + 1,
          nome: f.name,
        });
      } catch {
        const localUrl = URL.createObjectURL(f);
        novos.push({
          id: crypto.randomUUID(),
          url: localUrl,
          tipo: isVid ? 'video' : 'imagem',
          ordem: i + 1,
          nome: f.name,
        });
      }
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
    const clienteConta = item.cliente?.instagram_accounts?.instagram_username || null;

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
      instagramAccountId: (item.cliente as any)?.instagram_account_id || null,
      instagramUserId: clienteConta,
      kind: item.tipo === 'reel' ? 'reels' : item.tipo === 'story' ? 'story' : 'post',
      mediaUrls,
      caption: item.legenda || '',
      scheduledAt: item.data_programada || null,
      titulo: item.titulo || 'Publicação',
      automationConfig: autoConfig,
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
    setFormTitulo('');
    setFormBriefing('');
    setFormLegenda('');
    setFormResponsavelId(membros[0]?.id || '');
    setFormEditorId('');
    setFormDataProgramada('');
    setFormPrazoInterno('');
    setFormUrls('');
    setFormArquivos([]);
    setShowManualUrlsForm(false);
    setModalNovoAberto(true);
  }

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
          titulo: formTitulo.trim() || null,
          briefing: formBriefing.trim() || null,
          legenda: formLegenda.trim() || null,
          responsavel_id: formResponsavelId || null,
          editor_id: formEditorId || null,
          data_programada: formDataProgramada ? new Date(formDataProgramada).toISOString() : null,
          prazo: formPrazoInterno ? new Date(formPrazoInterno).toISOString() : null,
          arquivos: arquivosFinais,
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

  function handleAbrirModalEditar(item: ConteudoItem) {
    setItemEmEdicao(item);
    setEditStatus(item.status);
    setEditTipo(item.tipo);
    setEditTitulo(item.titulo || '');
    setEditBriefing(item.briefing || '');
    setEditLegenda(item.legenda || '');
    setEditResponsavelId(item.responsavel_id || '');
    setEditEditorId(item.editor_id || '');
    setEditDataProgramada(item.data_programada ? item.data_programada.slice(0, 10) : '');
    setEditPrazoInterno(item.prazo ? item.prazo.slice(0, 10) : '');
    setEditUrls('');
    setEditArquivos(item.arquivos || []);
    setShowManualUrlsEdit(false);
    setNovoComentarioTexto('');
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
          status: editStatus,
          titulo: editTitulo.trim() || null,
          briefing: editBriefing.trim() || null,
          legenda: editLegenda.trim() || null,
          responsavel_id: editResponsavelId || null,
          editor_id: editEditorId || null,
          data_programada: editDataProgramada ? new Date(editDataProgramada).toISOString() : null,
          prazo: editPrazoInterno ? new Date(editPrazoInterno).toISOString() : null,
          arquivos: arquivosFinais,
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
    if (!window.confirm('Tem certeza que deseja excluir esta demanda da esteira?')) return;

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

  const clienteSelecionadoObj = clientes.find((c) => c.id === formClienteId);
  const clienteAtivo = clientes.find((c) => c.id === clienteSelecionado);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* 1. Header de Ações & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Busca */}
          <div className="relative w-56">
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
            className="h-9 text-xs w-44"
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
              className="h-9 text-xs w-40"
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Mês (quando no modo Feed) */}
          {viewMode === 'feed' && (
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="h-9 text-xs px-2.5 rounded-xl bg-background border border-border text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
              title="Mês de referência do feed"
            />
          )}

          {/* Alternador Kanban / Lista / Feed 3x3 */}
          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização em Kanban"
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização em Lista"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'feed'
                  ? 'bg-card text-primary font-bold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização Preview de Feed 3x3"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Feed 3x3</span>
            </button>
          </div>

          {/* Botão Sincronizar Notion */}
          <Button
            onClick={async () => {
              setSincronizandoNotion(true);
              try {
                const res = await fetch('/api/cron/notion-sync', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  showToast(`Notion sincronizado! ${data.totalCreated} criados, ${data.totalUpdated} atualizados.`, 'success');
                  carregarDados();
                } else {
                  throw new Error(data.error || 'Falha ao sincronizar.');
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
            className="rounded-xl shadow-2xs h-9 text-xs font-bold bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all cursor-pointer"
            title="Sincronizar demandas ativas diretamente com o Notion"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-primary ${sincronizandoNotion ? 'animate-spin' : ''}`} />
            {sincronizandoNotion ? 'Sincronizando Notion...' : '⚡ Sincronizar Notion'}
          </Button>

          {/* Botão Duplicar Mês */}
          <Button
            onClick={() => {
              if (clienteSelecionado !== 'all') {
                setDuplicarClienteId(clienteSelecionado);
              }
              setModalDuplicarAberto(true);
            }}
            variant="outline"
            size="sm"
            className="rounded-xl shadow-2xs h-9 text-xs font-semibold"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            Duplicar Mês
          </Button>

          {/* Botão Nova Demanda */}
          <Button
            onClick={handleAbrirModalNovo}
            variant="primary"
            size="sm"
            className="rounded-xl shadow-xs h-9 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-4 rounded-2xl bg-card border border-border/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <ClienteAvatar nome={clienteAtivo.nome} cor={clienteAtivo.cor} fotoUrl={clienteAtivo.foto_url} tamanho="md" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{clienteAtivo.nome}</span>
                  <span className="text-[11px] font-mono text-muted-foreground bg-accent px-2 py-0.5 rounded-md border border-border/60">
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
                className="rounded-xl text-xs h-8.5 font-semibold bg-success hover:bg-success/90 text-white"
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
          {COLUNAS_KANBAN.map((colStatus) => {
            const itensDaColuna = itemsFiltrados.filter((it) => it.status === colStatus);
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
                    : 'bg-accent/25 border-border/60'
                }`}
              >
                {/* Cabeçalho da Coluna */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-display text-foreground">{info.label}</span>
                    <span className="text-[10px] font-mono font-bold bg-accent text-muted-foreground px-1.5 py-0.5 rounded-md border border-border/60">
                      {itensDaColuna.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{info.tag}</span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="flex flex-col gap-3">
                  {itensDaColuna.map((item) => {
                    const temComentarios = (item.comentarios_revisao || []).length > 0;
                    const temAjustes = item.status === 'travado';
                    const isDragging = draggingItemId === item.id;

                    return (
                      <Card
                        key={item.id}
                        draggable={true}
                        onClick={() => handleAbrirModalEditar(item)}
                        onDragStart={(e) => {
                          setDraggingItemId(item.id);
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDraggingItemId(null)}
                        className={`group p-4 rounded-2xl border bg-card shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col gap-3 cursor-pointer ${
                          temAjustes
                            ? 'border-destructive/40 bg-destructive/5'
                            : 'border-border/80 hover:border-foreground/30'
                        } ${isDragging ? 'opacity-70' : 'opacity-100'}`}
                      >
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
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                                {item.tipo}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={info.variant} className="text-[9px] font-bold">
                              {info.label}
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirModalEditar(item);
                              }}
                              title="Editar Demanda"
                              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Título */}
                        {item.titulo && (
                          <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                            {item.titulo}
                          </h4>
                        )}

                        {/* Badges de Slides, Prazo e Responsável */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {item.arquivos?.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-accent/60 text-muted-foreground font-mono font-medium border border-border/50">
                              {item.arquivos.length} {item.tipo === 'reel' ? 'vídeo' : 'slides'}
                            </span>
                          )}

                          {item.prazo && (
                            <span className="px-2 py-0.5 rounded-md bg-accent/60 text-muted-foreground font-mono flex items-center gap-1 border border-border/50">
                              <Clock className="w-2.5 h-2.5" />
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
                                  : 'bg-lime/40 text-foreground border-foreground/10'
                              }`}
                            >
                              <MessageSquare className="w-3 h-3" />
                              {item.comentarios_revisao.length} ajustes
                            </span>
                          )}
                        </div>

                        {/* Responsável */}
                        {item.responsavel && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium pt-1 border-t border-border/40">
                            <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[8px] font-bold text-foreground">
                              {item.responsavel.nome[0].toUpperCase()}
                            </div>
                            <span className="truncate">{item.responsavel.nome}</span>
                          </div>
                        )}

                        {/* Status de Aprovação com Cliente */}
                        {item.status === 'revisao_cliente' && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-[10px]">
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              <span className="truncate">Aguardando {item.cliente?.nome || 'Cliente'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/aprovacao/${item.token_aprovacao}`, '_blank');
                              }}
                              title="Ver exatamente como o cliente visualiza a tela de aprovação"
                              className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-[9px] underline cursor-pointer"
                            >
                              Ver tela
                            </button>
                          </div>
                        )}

                        {/* Ações Rápidas: Link, Editar e Enviar p/ Aprovação */}
                        <div className="border-t border-border/60 pt-2.5 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopiarLinkAprovacao(item.token_aprovacao);
                              }}
                              title="Copiar link público de aprovação"
                              className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-accent/60 transition-colors"
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
                              className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-accent/60 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          </div>

                          {item.status === 'agendamento' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLevarParaAgendamento(item);
                              }}
                              title="Levar demanda aprovada direto para a tela de Agendamento do Instagram"
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 bg-primary hover:bg-primary/85 text-primary-foreground border border-primary/40 shadow-xs transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Agendar</span>
                            </button>
                          ) : (
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
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border shadow-2xs transition-all cursor-pointer ${
                                item.status === 'revisao_cliente'
                                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-500/30'
                                  : 'bg-lime hover:bg-lime/85 text-foreground border-foreground/15'
                              }`}
                            >
                              <Send className="w-3 h-3" />
                              <span>{item.status === 'revisao_cliente' ? 'Reenviar' : 'Aprovação'}</span>
                            </button>
                          )}
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
              <thead className="uppercase text-[10px] font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Título / Formato</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Mídia</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
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
                      {item.responsavel?.nome || <span className="text-muted-foreground/60">—</span>}
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
                        {item.status === 'agendamento' ? (
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
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbrirModalAprovacao(item);
                            }}
                            title="Enviar p/ Aprovação no WhatsApp"
                            className="px-2.5 py-1 rounded-lg bg-lime hover:bg-lime/85 text-foreground font-bold flex items-center gap-1 shadow-2xs cursor-pointer text-xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 3. Modal Redesenhado: Nova Demanda de Alto Nível */}
      <Sheet
        open={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        aria-label="Nova Demanda"
      >
        <form onSubmit={handleSalvarNovo} className="flex flex-col max-h-[85vh] sm:max-h-[88vh] max-w-xl w-full">
          {/* Header Fixo */}
          <div className="p-5 sm:p-6 border-b border-border shrink-0 flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                Produção & Esteira
              </span>
              <h3 className="text-lg sm:text-xl font-bold font-display text-foreground mt-0.5">
                Criar Nova Demanda de Conteúdo
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure o cliente, formato visual, equipe e prazos para alimentar a esteira de produção.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalNovoAberto(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Rolável */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {/* 1. SELETOR VISUAL DE CLIENTE */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
              1. Cliente da Agência
            </label>

            {/* Input de busca rápida de cliente */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar clientes por nome ou nicho..."
                value={buscaClienteForm}
                onChange={(e) => setBuscaClienteForm(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>

            {/* Grid de clientes com seleção visual */}
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 border border-border/80 rounded-xl bg-accent/20">
              {clientesFormFiltrados.map((c) => {
                const isSelected = formClienteId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFormClienteId(c.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-card border-foreground/30 shadow-2xs ring-1 ring-foreground/20'
                        : 'border-transparent hover:bg-accent/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={c.foto_url} tamanho="sm" />
                      {c.foto_url && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center p-0.5 border border-card shadow-2xs">
                          <Instagram className="w-2 h-2 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {(c as any).instagram_username ? `@${(c as any).instagram_username}` : c.nicho || 'Geral'}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SELETOR VISUAL DE FORMATO */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
              2. Formato de Publicação
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: 'post' as const,
                  label: 'Carrossel / Post',
                  desc: '4:5 Vertical',
                  icon: ImageIcon,
                },
                {
                  id: 'reel' as const,
                  label: 'Vídeo Reels',
                  desc: '9:16 Vertical',
                  icon: Video,
                },
                {
                  id: 'story' as const,
                  label: 'Story',
                  desc: 'Interativo 9:16',
                  icon: Smartphone,
                },
                {
                  id: 'avulso' as const,
                  label: 'Avulso / Extra',
                  desc: 'Demanda Pontual',
                  icon: Sparkles,
                },
              ].map((fmt) => {
                const isSelected = formTipo === fmt.id;
                const Icon = fmt.icon;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormTipo(fmt.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-card border-foreground/30 shadow-2xs ring-1 ring-foreground/20'
                        : 'border-border/80 hover:bg-accent/40'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">{fmt.label}</p>
                      <p className="text-[9px] text-muted-foreground font-mono">{fmt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. TÍTULO E BRIEFING */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Título / Tema da Publicação
              </label>
              <Input
                placeholder="Ex.: 5 Segredos para Aumentar Vendas no Instagram"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Briefing / Objetivo da Peça (Para o Designer e Copywriter)
              </label>
              <Textarea
                placeholder="Ex.: Focar na dor do cliente, usar elementos da identidade visual do Dr. Paulo e chamada para o direct..."
                value={formBriefing}
                onChange={(e) => setFormBriefing(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* 4. ATRIBUIÇÃO DE EQUIPE (Sócios / Responsáveis) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Responsável Principal</span>
              </label>
              <Select
                value={formResponsavelId}
                onChange={(e) => setFormResponsavelId(e.target.value)}
              >
                <option value="">Selecione o responsável...</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.cargo || (m.papel === 'master' ? 'Sócio' : 'Membro')})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Designer / Editor (Opcional)</span>
              </label>
              <Select
                value={formEditorId}
                onChange={(e) => setFormEditorId(e.target.value)}
              >
                <option value="">Selecione o editor/designer...</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.cargo || 'Especialista'})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* 5. PRAZOS E DATAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Prazo Interno da Equipe</span>
              </label>
              <Input
                type="date"
                value={formPrazoInterno}
                onChange={(e) => setFormPrazoInterno(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Data Programada (Postagem)</span>
              </label>
              <Input
                type="date"
                value={formDataProgramada}
                onChange={(e) => setFormDataProgramada(e.target.value)}
              />
            </div>
          </div>

          {/* 6. MÍDIAS E ARQUIVOS DA POSTAGEM */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                <span>Mídias da Demanda ({formArquivos.length} anexadas)</span>
              </label>
              {formUploading && (
                <span className="text-[11px] text-primary flex items-center gap-1 animate-pulse font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
                </span>
              )}
            </div>

            {/* Dropzone com input de arquivo */}
            <div className="relative border-2 border-dashed border-border hover:border-foreground/30 rounded-2xl p-4 transition-all text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5">
              <input
                type="file"
                multiple={formTipo !== 'reel'}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                onChange={handleFormFilesChange}
                disabled={formUploading}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
              />
              <div className="w-8 h-8 rounded-xl bg-card border border-border/80 flex items-center justify-center text-foreground shadow-2xs">
                <UploadCloud className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-bold text-foreground">
                  Clique ou arraste as fotos/vídeo desta postagem
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formTipo === 'reel' ? 'Vídeo MP4 ou MOV em 9:16' : 'JPG, PNG ou WEBP em 4:5. Selecione várias para Carrossel.'}
                </p>
              </div>
            </div>

            {/* Miniaturas das mídias anexadas */}
            {formArquivos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {formArquivos.map((arq, idx) => (
                  <div
                    key={arq.id || idx}
                    className="relative w-16 h-20 rounded-xl overflow-hidden border border-border/80 bg-accent/50 group shadow-2xs"
                  >
                    {arq.tipo === 'video' ? (
                      <video src={arq.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={arq.url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                    )}
                    <span className="absolute bottom-1 left-1 text-[8px] font-mono font-bold bg-black/75 text-white px-1 rounded">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormArquivos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-white hover:scale-110 transition-transform cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Opção secundária: Inserir Link Manual (URL) */}
            <div className="mt-0.5">
              <button
                type="button"
                onClick={() => setShowManualUrlsForm((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
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

          {/* 7. COPY / LEGENDA */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Legenda do Post (Instagram)
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formLegenda.length} / 2.200
              </span>
            </div>
            <Textarea
              placeholder="Escreva a legenda que irá acompanhar o post no Instagram..."
              value={formLegenda}
              onChange={(e) => setFormLegenda(e.target.value)}
              rows={3}
            />
          </div>

          </div>

          {/* Footer Fixo */}
          <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalNovoAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={salvando}>
              Cadastrar Demanda
            </Button>
          </div>
        </form>
      </Sheet>

      {/* 4. Modal Duplicar Mês de Conteúdo */}
      <Sheet
        open={modalDuplicarAberto}
        onClose={() => setModalDuplicarAberto(false)}
        aria-label="Duplicar Mês"
      >
        <form onSubmit={handleDuplicarMes} className="p-6 flex flex-col gap-5 max-w-md">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Agilidade & Escala
            </span>
            <h3 className="text-lg sm:text-xl font-bold font-display text-foreground mt-0.5">
              Duplicar Mês de Conteúdo
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Clona todas as demandas do mês de origem para o novo período com status reiniciado em Planejamento.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Cliente
            </label>
            <Select
              value={duplicarClienteId}
              onChange={(e) => setDuplicarClienteId(e.target.value)}
              required
            >
              <option value="">Selecione o cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Mês de Origem
              </label>
              <Input
                type="month"
                value={duplicarMesOrigem}
                onChange={(e) => setDuplicarMesOrigem(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Mês de Destino
              </label>
              <Input
                type="month"
                value={duplicarMesDestino}
                onChange={(e) => setDuplicarMesDestino(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-accent/40 border border-border/80 text-xs text-muted-foreground flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p>
              As cópias são criadas como demandas novas independentes. Briefings, legendas e carrosséis são preservados, e o status é resetado para o início da esteira.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalDuplicarAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={duplicando}>
              Duplicar Demandas Agora
            </Button>
          </div>
        </form>
      </Sheet>

      {/* 5. Modal: Editar Demanda */}
      <Sheet
        open={!!itemEmEdicao}
        onClose={() => setItemEmEdicao(null)}
        aria-label="Editar Demanda"
      >
        {itemEmEdicao && (
          <form onSubmit={handleSalvarEdicao} className="flex flex-col max-h-[85vh] sm:max-h-[88vh] max-w-xl w-full">
            {/* Header Fixo */}
            <div className="p-5 sm:p-6 border-b border-border shrink-0 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <ClienteAvatar
                  nome={itemEmEdicao.cliente?.nome || 'Cliente'}
                  cor={itemEmEdicao.cliente?.cor}
                  fotoUrl={itemEmEdicao.cliente?.foto_url}
                  tamanho="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                      Editar Demanda
                    </span>
                    <Badge variant={STATUS_LABELS[editStatus]?.variant || 'default'} className="text-[9px]">
                      {STATUS_LABELS[editStatus]?.label || editStatus}
                    </Badge>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-display text-foreground truncate mt-0.5">
                    {itemEmEdicao.cliente?.nome} — {editTitulo || 'Sem título'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemEmEdicao(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Rolável */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Status e Formato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Status na Esteira
                  </label>
                  <Select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as StatusConteudo)}
                  >
                    {COLUNAS_KANBAN.map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st].label} ({STATUS_LABELS[st].tag})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Formato de Publicação
                  </label>
                  <Select
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value as TipoConteudo)}
                  >
                    <option value="post">Carrossel / Post (4:5)</option>
                    <option value="reel">Vídeo Reels (9:16)</option>
                    <option value="story">Story Interativo (9:16)</option>
                    <option value="avulso">Avulso / Demanda Extra</option>
                  </Select>
                </div>
              </div>

              {/* Título */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Título / Tema da Publicação
                </label>
                <Input
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  placeholder="Ex.: 5 Segredos para Aumentar Vendas"
                  required
                />
              </div>

              {/* Briefing */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Briefing / Instruções de Criação
                </label>
                <Textarea
                  value={editBriefing}
                  onChange={(e) => setEditBriefing(e.target.value)}
                  placeholder="Instruções para o designer e copywriter..."
                  rows={3}
                />
              </div>

              {/* Equipe Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Responsável Principal</span>
                  </label>
                  <Select
                    value={editResponsavelId}
                    onChange={(e) => setEditResponsavelId(e.target.value)}
                  >
                    <option value="">Nenhum responsável...</option>
                    {membros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.cargo || (m.papel === 'master' ? 'Sócio' : 'Membro')})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Designer / Editor</span>
                  </label>
                  <Select
                    value={editEditorId}
                    onChange={(e) => setEditEditorId(e.target.value)}
                  >
                    <option value="">Nenhum editor...</option>
                    {membros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.cargo || 'Especialista'})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Prazos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Prazo Interno</span>
                  </label>
                  <Input
                    type="date"
                    value={editPrazoInterno}
                    onChange={(e) => setEditPrazoInterno(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Data Programada (Postagem)</span>
                  </label>
                  <Input
                    type="date"
                    value={editDataProgramada}
                    onChange={(e) => setEditDataProgramada(e.target.value)}
                  />
                </div>
              </div>

              {/* Mídias / Arquivos */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Mídias da Demanda ({editArquivos.length} anexadas)</span>
                  </label>
                  {editUploading && (
                    <span className="text-[11px] text-primary flex items-center gap-1 animate-pulse font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
                    </span>
                  )}
                </div>

                {/* Dropzone com input de arquivo */}
                <div className="relative border-2 border-dashed border-border hover:border-foreground/30 rounded-2xl p-4 transition-all text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5">
                  <input
                    type="file"
                    multiple={editTipo !== 'reel'}
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={handleEditFilesChange}
                    disabled={editUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                  />
                  <div className="w-8 h-8 rounded-xl bg-card border border-border/80 flex items-center justify-center text-foreground shadow-2xs">
                    <UploadCloud className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-bold text-foreground">
                      Clique ou arraste novas fotos/vídeos para esta demanda
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {editTipo === 'reel' ? 'Vídeo MP4 ou MOV em 9:16' : 'JPG, PNG ou WEBP em 4:5. Selecione várias para Carrossel.'}
                    </p>
                  </div>
                </div>

                {/* Miniaturas das mídias anexadas */}
                {editArquivos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {editArquivos.map((arq, idx) => (
                      <div
                        key={arq.id || idx}
                        className="relative w-16 h-20 rounded-xl overflow-hidden border border-border/80 bg-accent/50 group shadow-2xs"
                      >
                        {arq.tipo === 'video' ? (
                          <video src={arq.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={arq.url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                        )}
                        <span className="absolute bottom-1 left-1 text-[8px] font-mono font-bold bg-black/75 text-white px-1 rounded">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditArquivos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-white hover:scale-110 transition-transform cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Opção secundária: Inserir Link Manual (URL) */}
                <div className="mt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowManualUrlsEdit((v) => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
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

              {/* Legenda do Instagram */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Legenda do Instagram
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {editLegenda.length} / 2.200
                  </span>
                </div>
                <Textarea
                  value={editLegenda}
                  onChange={(e) => setEditLegenda(e.target.value)}
                  placeholder="Legenda da postagem..."
                  rows={4}
                />
              </div>

              {/* Comentários de Revisão do Cliente (se houver) */}
              {(itemEmEdicao.comentarios_revisao || []).length > 0 && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2">
                  <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ajustes Solicitados pelo Cliente ({itemEmEdicao.comentarios_revisao.length})
                  </p>
                  <div className="space-y-1.5">
                    {itemEmEdicao.comentarios_revisao.map((c) => (
                      <div key={c.id} className="text-[11px] p-2 rounded-lg bg-card/80 border border-border/60">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono">
                          <span>{c.autor || (c.tipo === 'cliente' ? 'Cliente' : 'Equipe')}</span>
                          {c.slide_index != null && <span>Slide {c.slide_index + 1}</span>}
                        </div>
                        <p className="text-foreground mt-0.5">{c.texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico de Atividades (Audit Trail) & Comentários Internos da Equipe */}
              <div className="rounded-2xl border border-border/80 bg-accent/20 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Histórico & Atividades ({itemEmEdicao.historico_atividades?.length || 0})
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Audit trail automático</span>
                </div>

                {/* Timeline de Atividades */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {(!itemEmEdicao.historico_atividades || itemEmEdicao.historico_atividades.length === 0) ? (
                    <p className="text-[11px] text-muted-foreground/70 italic py-1">
                      Nenhuma atividade registrada ainda. As mudanças de status e notas da equipe aparecerão aqui.
                    </p>
                  ) : (
                    itemEmEdicao.historico_atividades.map((ev) => {
                      const dataFormatada = new Date(ev.criado_em).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isStatus = ev.tipo === 'status';

                      return (
                        <div
                          key={ev.id}
                          className={`p-2.5 rounded-xl border text-xs ${
                            isStatus
                              ? 'bg-card border-border/70'
                              : 'bg-primary/5 border-primary/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              {isStatus ? (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                              ) : (
                                <MessageSquare className="w-3 h-3 text-primary" />
                              )}
                              {ev.autor_nome || 'Equipe'}
                            </span>
                            <span className="font-mono text-[10px]">{dataFormatada}</span>
                          </div>

                          {isStatus && ev.de_status && ev.para_status ? (
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-foreground font-medium mt-0.5">
                              <Badge variant={STATUS_LABELS[ev.de_status]?.variant || 'default'} className="text-[9px] py-0 px-1.5 font-bold">
                                {STATUS_LABELS[ev.de_status]?.label || ev.de_status}
                              </Badge>
                              <span className="text-muted-foreground">➔</span>
                              <Badge variant={STATUS_LABELS[ev.para_status]?.variant || 'default'} className="text-[9px] py-0 px-1.5 font-bold">
                                {STATUS_LABELS[ev.para_status]?.label || ev.para_status}
                              </Badge>
                            </div>
                          ) : (
                            <p className="text-[11px] text-foreground whitespace-pre-wrap mt-0.5">{ev.texto}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input de Novo Comentário Interno */}
                <div className="pt-2 border-t border-border/60 flex flex-col gap-1.5">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={novoComentarioTexto}
                      onChange={(e) => setNovoComentarioTexto(e.target.value)}
                      placeholder="Adicionar nota interna para a equipe (ex: @design favor conferir arte)..."
                      rows={2}
                      className="text-xs resize-none flex-1 bg-background"
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
                      className="rounded-xl h-10 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                      title="Enviar comentário"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Pressione Ctrl+Enter para enviar</span>
                </div>
              </div>
            </div>

            {/* Footer Fixo */}
            <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleExcluirDemanda(itemEmEdicao.id)}
                loading={excluindoItem}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Excluir Demanda
              </Button>

              <div className="flex items-center gap-2">
                {itemEmEdicao.status === 'agendamento' && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleLevarParaAgendamento(itemEmEdicao);
                      setItemEmEdicao(null);
                    }}
                    className="bg-primary hover:bg-primary/85 text-primary-foreground font-bold shadow-xs text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Levar p/ Agendamento
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setItemEmEdicao(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={salvandoEdicao}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </form>
        )}
      </Sheet>

      {/* 5. Modal de Envio para Aprovação (WhatsApp Web Seguro) */}
      <Sheet
        open={modalAprovacaoAberto}
        onClose={() => setModalAprovacaoAberto(false)}
        aria-label="Enviar para Aprovação"
      >
        {itemParaAprovacao && (
          <div className="flex flex-col max-h-[85vh] sm:max-h-[88vh] max-w-lg w-full">
            {/* Header Fixo */}
            <div className="p-5 sm:p-6 border-b border-border shrink-0 flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Send className="w-3 h-3 text-lime" />
                  Aprovação de Conteúdo
                </span>
                <h3 className="text-xl font-bold font-display text-foreground tracking-tight mt-1">
                  Enviar no WhatsApp
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {itemParaAprovacao.cliente?.nome || 'Cliente'} · {itemParaAprovacao.titulo || 'Publicação'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAprovacaoAberto(false)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo Rolável */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* 1. Verificação de Mídias */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Mídias Anexadas à Demanda</span>
                  </label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {(itemParaAprovacao.arquivos || []).length} {itemParaAprovacao.tipo === 'reel' ? 'vídeo' : 'slide(s)'}
                  </span>
                </div>

                {(itemParaAprovacao.arquivos || []).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-3 text-xs">
                    <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Nenhuma foto ou vídeo anexado ainda!</p>
                        <p className="text-[11px] mt-0.5 text-muted-foreground">
                          O cliente precisa visualizar a arte ou vídeo para aprovar. Anexe os arquivos agora:
                        </p>
                      </div>
                    </div>

                    {/* Dropzone rápido dentro do modal de aprovação */}
                    <div className="relative border-2 border-dashed border-amber-500/30 rounded-xl p-4 text-center bg-card hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5">
                      <input
                        type="file"
                        multiple={itemParaAprovacao.tipo !== 'reel'}
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                        disabled={uploadingAprovacao}
                        onChange={async (e) => {
                          if (!e.target.files?.length) return;
                          setUploadingAprovacao(true);
                          try {
                            const novos = await handleUploadArquivos(e.target.files);
                            const atualizados = [...(itemParaAprovacao.arquivos || []), ...novos];
                            await fetch(`/api/conteudo/${itemParaAprovacao.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ arquivos: atualizados }),
                            });
                            setItemParaAprovacao({ ...itemParaAprovacao, arquivos: atualizados });
                            setItems((prev) =>
                              prev.map((i) => (i.id === itemParaAprovacao.id ? { ...i, arquivos: atualizados } : i))
                            );
                            showToast(`${novos.length} mídia(s) anexada(s) à demanda!`, 'success');
                          } catch (err: any) {
                            showToast(err.message || 'Erro ao anexar arquivos.', 'error');
                          } finally {
                            setUploadingAprovacao(false);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                      />
                      <UploadCloud className="w-5 h-5 text-primary" />
                      <span className="text-xs font-bold text-foreground">
                        {uploadingAprovacao ? 'Enviando arquivos...' : 'Clique para selecionar fotos ou vídeo'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        JPG, PNG ou MP4 da postagem
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/70 space-y-3">
                    {/* Miniaturas das Mídias */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {itemParaAprovacao.arquivos.map((arq, idx) => (
                        <div
                          key={arq.id || idx}
                          className="relative w-14 h-16 rounded-xl overflow-hidden border border-border/80 shrink-0 shadow-2xs"
                        >
                          {arq.tipo === 'video' ? (
                            <video src={arq.url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={arq.url} alt="" className="w-full h-full object-cover" />
                          )}
                          <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/80 text-white font-mono px-1 rounded">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Card de Simulação de Prévia Visual do Link no WhatsApp */}
                    <div className="p-2.5 rounded-xl bg-card border border-border/80 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-border/60">
                          {itemParaAprovacao.arquivos[0]?.tipo === 'video' ? (
                            <video src={itemParaAprovacao.arquivos[0]?.url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={itemParaAprovacao.arquivos[0]?.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {itemParaAprovacao.titulo || 'Publicação'}
                            </span>
                            <span className="text-[9px] font-mono font-bold bg-lime text-foreground px-1.5 py-0.5 rounded">
                              {itemParaAprovacao.tipo === 'reel'
                                ? '9:16 Reels'
                                : itemParaAprovacao.tipo === 'story'
                                ? '9:16 Story'
                                : itemParaAprovacao.arquivos.length > 1
                                ? `4:5 Carrossel (${itemParaAprovacao.arquivos.length})`
                                : '4:5 Feed'}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            Prévia renderizada sem barras pretas no link do cliente.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {itemParaAprovacao.arquivos[0]?.url && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = itemParaAprovacao.arquivos[0].url;
                              a.download = `previa-${itemParaAprovacao.titulo || 'post'}.jpg`;
                              a.target = '_blank';
                              a.click();
                              showToast('Download da imagem iniciado!', 'success');
                            }}
                            className="text-[11px] h-7 px-2"
                            title="Baixar capa para anexar direto no WhatsApp se desejar"
                          >
                            Baixar Capa
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            window.open(`/aprovacao/${itemParaAprovacao.token_aprovacao}`, '_blank');
                          }}
                          className="text-[11px] h-7 px-2 text-primary"
                          title="Abrir como o cliente visualiza"
                        >
                          Ver no Link
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Destinatário no WhatsApp */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <span>Destinatário no WhatsApp</span>
                </label>

                {/* Contatos cadastrados no cliente */}
                {(itemParaAprovacao.cliente?.contatos || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {itemParaAprovacao.cliente?.contatos?.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setTelefoneAprovacaoCustom(c.telefone || '')}
                        className={`text-xs px-2.5 py-1 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-all ${
                          telefoneAprovacaoCustom === (c.telefone || '')
                            ? 'bg-foreground text-background border-foreground font-bold'
                            : 'bg-card text-muted-foreground hover:text-foreground border-border/80'
                        }`}
                      >
                        <span>{c.nome}</span>
                        {c.e_grupo_whatsapp && (
                          <span className="text-[9px] bg-lime/20 text-lime-800 dark:text-lime-300 px-1 rounded font-semibold">
                            Grupo
                          </span>
                        )}
                        {c.telefone && <span className="font-mono text-[10px] opacity-80">({c.telefone})</span>}
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  placeholder="Número de WhatsApp com DDD (ex: 11987654321)"
                  value={telefoneAprovacaoCustom}
                  onChange={(e) => setTelefoneAprovacaoCustom(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* 3. Prévia da Mensagem */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span>Mensagem Formatada para Envio</span>
                </label>
                <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/70 text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {gerarMensagemAprovacao({
                    nomeCliente: itemParaAprovacao.cliente?.nome || 'Cliente',
                    tituloPost: itemParaAprovacao.titulo || 'Publicação',
                    token: itemParaAprovacao.token_aprovacao,
                  }).texto}
                </div>
              </div>
            </div>

            {/* Footer Fixo com Botão WhatsApp Web Imune a Bloqueadores de Popup */}
            <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleCopiarLinkAprovacao(itemParaAprovacao.token_aprovacao);
                  }}
                  className="text-xs flex-1 sm:flex-none"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar Link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const { texto } = gerarMensagemAprovacao({
                      nomeCliente: itemParaAprovacao.cliente?.nome || 'Cliente',
                      tituloPost: itemParaAprovacao.titulo || 'Publicação',
                      token: itemParaAprovacao.token_aprovacao,
                    });
                    navigator.clipboard.writeText(texto);
                    showToast('Mensagem formatada copiada para o WhatsApp!', 'success');
                  }}
                  className="text-xs flex-1 sm:flex-none"
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Copiar Texto
                </Button>
              </div>

              {/* Link direto no WhatsApp Web (Abre em nova aba diretamente sem bloqueio do navegador) */}
              <a
                href={gerarLinkWhatsAppAprovacao({
                  telefone: telefoneAprovacaoCustom || null,
                  nomeCliente: itemParaAprovacao.cliente?.nome || 'Cliente',
                  tituloPost: itemParaAprovacao.titulo || 'Publicação',
                  token: itemParaAprovacao.token_aprovacao,
                  preferWeb: true,
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={async () => {
                  if (itemParaAprovacao.status !== 'revisao_cliente') {
                    try {
                      await fetch(`/api/conteudo/${itemParaAprovacao.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'revisao_cliente' }),
                      });
                      setItems((prev) =>
                        prev.map((i) =>
                          i.id === itemParaAprovacao.id ? { ...i, status: 'revisao_cliente' } : i
                        )
                      );
                    } catch {
                      // silencioso
                    }
                  }
                  showToast('WhatsApp Web aberto com sucesso!', 'success');
                  setModalAprovacaoAberto(false);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-lime hover:bg-lime/85 text-foreground font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Abrir WhatsApp Web</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
