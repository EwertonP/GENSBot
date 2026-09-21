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
  Check,
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
import {
  STATUS_LABELS,
  COLUNAS_KANBAN,
  gerarLinkWhatsAppAprovacao,
  gerarMensagemAprovacao,
  type ConteudoItem,
  type StatusConteudo,
  type TipoConteudo,
} from '@/lib/conteudo';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';

interface EsteiraTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  clienteFiltroId?: string | null;
}

export default function EsteiraTab({ showToast, clienteFiltroId }: EsteiraTabProps) {
  const [items, setItems] = useState<ConteudoItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [clienteSelecionado, setClienteSelecionado] = useState<string>(clienteFiltroId || 'all');
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>('all');
  const [busca, setBusca] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

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

  // Envio Inteligente para WhatsApp Web
  async function handleEnviarParaAprovacao(item: ConteudoItem) {
    // 1. Se ainda não estiver em revisao_cliente, transiciona automaticamente
    if (item.status !== 'revisao_cliente') {
      try {
        const res = await fetch(`/api/conteudo/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'revisao_cliente' }),
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'revisao_cliente' } : i))
          );
        }
      } catch {
        // segue com envio
      }
    }

    // 2. Localiza contato do cliente (prioriza grupo de whatsapp ou contato com telefone)
    const contatos = item.cliente?.contatos || [];
    const grupo = contatos.find((c) => c.e_grupo_whatsapp && c.telefone);
    const primeiroComTelefone = contatos.find((c) => c.telefone);
    const telefoneFinal = grupo?.telefone || primeiroComTelefone?.telefone || null;

    // 3. Gera link do WhatsApp Web
    const linkWa = gerarLinkWhatsAppAprovacao({
      telefone: telefoneFinal,
      nomeCliente: item.cliente?.nome || 'Cliente',
      tituloPost: item.titulo || 'Publicação',
      token: item.token_aprovacao,
      preferWeb: true,
    });

    // 4. Copia o link e o texto para o clipboard como garantia
    const { texto, linkAprovacao } = gerarMensagemAprovacao({
      nomeCliente: item.cliente?.nome || 'Cliente',
      tituloPost: item.titulo || 'Publicação',
      token: item.token_aprovacao,
    });
    try {
      await navigator.clipboard.writeText(`${texto}\n\nLink direto: ${linkAprovacao}`);
    } catch {
      // silencioso
    }

    // 5. Abre no WhatsApp Web
    window.open(linkWa, '_blank');
    showToast(
      telefoneFinal
        ? 'Aprovando: WhatsApp Web aberto com a mensagem pronta!'
        : 'WhatsApp Web aberto! Escolha a conversa ou grupo para colar a mensagem.',
      'success'
    );
  }

  function handleCopiarLinkAprovacao(token: string) {
    const link = `${window.location.origin}/aprovacao/${token}`;
    navigator.clipboard.writeText(link);
    showToast('Link de aprovação copiado!', 'success');
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
          ordem: idx + 1,
        }));

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
          arquivos: urlsArray,
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

        <div className="flex items-center gap-2">
          {/* Alternador Kanban / Lista */}
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
          </div>

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

      {/* Banner de Ações Rápidas do Cliente Ativo (Aprovação de Feed e Status) */}
      {clienteAtivo && (
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
              variant="outline"
              size="sm"
              onClick={() => {
                const token = clienteAtivo.token_aprovacao_mes || clienteAtivo.id;
                window.open(`/aprovacao/feed/${token}`, '_blank');
              }}
              className="rounded-xl text-xs h-8.5 font-semibold"
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Ver Feed (Grade 3xN)
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
      )}

      {/* 2. Visualização Kanban com Drag-and-Drop */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse rounded-2xl" />
          ))}
        </div>
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
                        onDragStart={(e) => {
                          setDraggingItemId(item.id);
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDraggingItemId(null)}
                        className={`group p-4 rounded-2xl border bg-card shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col gap-3 cursor-grab active:cursor-grabbing ${
                          isDragging ? 'opacity-40 scale-95' : 'opacity-100'
                        } ${
                          temAjustes
                            ? 'border-destructive/40 bg-destructive/5'
                            : 'border-border/80 hover:border-foreground/30'
                        }`}
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

                          <Badge variant={info.variant} className="text-[9px] font-bold">
                            {info.label}
                          </Badge>
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

                        {/* Ações Rápidas: Link e Enviar p/ Aprovação */}
                        <div className="border-t border-border/60 pt-2.5 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopiarLinkAprovacao(item.token_aprovacao)}
                            title="Copiar link público de aprovação"
                            className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-accent/60 transition-colors"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Link</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEnviarParaAprovacao(item)}
                            title="Avança para revisão e abre no WhatsApp Web do cliente/grupo"
                            className="text-[11px] font-bold text-foreground bg-lime hover:bg-lime/85 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-foreground/15 shadow-2xs transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Enviar p/ Aprovação</span>
                          </button>
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
                  <tr key={item.id} className="hover:bg-accent/30 transition-colors">
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
                          onClick={() => handleCopiarLinkAprovacao(item.token_aprovacao)}
                          title="Copiar Link"
                          className="p-1.5 rounded-lg border border-border hover:bg-accent"
                        >
                          <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEnviarParaAprovacao(item)}
                          title="Enviar p/ Aprovação no WhatsApp"
                          className="px-2.5 py-1 rounded-lg bg-lime text-foreground font-bold flex items-center gap-1 shadow-2xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>Enviar WhatsApp</span>
                        </button>
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
        <form onSubmit={handleSalvarNovo} className="p-6 flex flex-col gap-5 max-w-xl">
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
                    <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={c.foto_url} tamanho="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.nicho || 'Geral'}</p>
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

          {/* 6. MÍDIAS E ARQUIVOS INICIAIS */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Links das Mídias / Slides (Um por linha)
            </label>
            <Textarea
              placeholder="https://.../slide-01.png&#10;https://.../slide-02.png"
              value={formUrls}
              onChange={(e) => setFormUrls(e.target.value)}
              rows={2}
            />
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

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
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
    </div>
  );
}
