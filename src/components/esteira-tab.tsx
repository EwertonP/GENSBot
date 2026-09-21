'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Columns3,
  Calendar,
  Layers,
  Send,
  MessageSquare,
  Clock,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Share2,
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
  formatarTimecode,
  gerarLinkWhatsAppAprovacao,
  type ConteudoItem,
  type StatusConteudo,
  type TipoConteudo,
} from '@/lib/conteudo';
import type { Cliente } from '@/lib/clientes';

interface EsteiraTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  clienteFiltroId?: string | null;
}

export default function EsteiraTab({ showToast, clienteFiltroId }: EsteiraTabProps) {
  const [items, setItems] = useState<ConteudoItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>(clienteFiltroId || 'all');
  const [busca, setBusca] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modal Novo Item
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<ConteudoItem | null>(null);

  // Form states
  const [formClienteId, setFormClienteId] = useState('');
  const [formTipo, setFormTipo] = useState<TipoConteudo>('post');
  const [formTitulo, setFormTitulo] = useState('');
  const [formLegenda, setFormLegenda] = useState('');
  const [formUrls, setFormUrls] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Carrega clientes e itens
  async function carregarDados() {
    setCarregando(true);
    try {
      const [resClientes, resConteudo] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/conteudo'),
      ]);

      const dataCli = await resClientes.json();
      const dataCont = await resConteudo.json();

      if (resClientes.ok && dataCli.clientes) setClientes(dataCli.clientes);
      if (resConteudo.ok && dataCont.items) setItems(dataCont.items);
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
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTitulo = (item.titulo || '').toLowerCase().includes(termo);
        const matchLegenda = (item.legenda || '').toLowerCase().includes(termo);
        const matchCliente = (item.cliente?.nome || '').toLowerCase().includes(termo);
        if (!matchTitulo && !matchLegenda && !matchCliente) return false;
      }
      return true;
    });
  }, [items, clienteSelecionado, busca]);

  async function handleMudarStatus(itemId: string, novoStatus: StatusConteudo) {
    try {
      const res = await fetch(`/api/conteudo/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: novoStatus } : i))
      );
      showToast('Status atualizado.', 'success');
    } catch {
      showToast('Erro ao atualizar status.', 'error');
    }
  }

  async function handleSalvarNovo(e: React.FormEvent) {
    e.preventDefault();
    if (!formClienteId) {
      showToast('Selecione um cliente.', 'error');
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
          titulo: formTitulo || null,
          legenda: formLegenda || null,
          arquivos: urlsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setItems((prev) => [data.item, ...prev]);
      setModalNovoAberto(false);
      setFormTitulo('');
      setFormLegenda('');
      setFormUrls('');
      showToast('Publicação criada na esteira!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar item.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  function handleCopiarLinkAprovacao(token: string) {
    const link = `${window.location.origin}/aprovacao/${token}`;
    navigator.clipboard.writeText(link);
    showToast('Link de aprovação copiado!', 'success');
  }

  function handleDisparoWhatsApp(item: ConteudoItem) {
    const linkWa = gerarLinkWhatsAppAprovacao({
      nomeCliente: item.cliente?.nome || 'Cliente',
      tituloPost: item.titulo || 'Publicação',
      token: item.token_aprovacao,
    });
    window.open(linkWa, '_blank');
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 1. Header de Ações & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar demandas..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select
            value={clienteSelecionado}
            onChange={(e) => setClienteSelecionado(e.target.value)}
            className="h-9 text-xs w-48"
          >
            <option value="all">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
              }`}
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={() => {
              if (clienteSelecionado !== 'all') setFormClienteId(clienteSelecionado);
              setModalNovoAberto(true);
            }}
            variant="primary"
            size="sm"
            className="rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova Demanda
          </Button>
        </div>
      </div>

      {/* 2. Visualização Kanban (13 Etapas / Slothban Style) */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhuma demanda na esteira"
          description="Crie o primeiro post, reels ou carrossel para acompanhar o fluxo de produção e aprovação."
          action={{
            label: 'Criar Demanda',
            icon: Plus,
            onClick: () => setModalNovoAberto(true),
          }}
        />
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
          {COLUNAS_KANBAN.map((colStatus) => {
            const itensDaColuna = itemsFiltrados.filter((it) => it.status === colStatus);
            const info = STATUS_LABELS[colStatus];

            return (
              <div
                key={colStatus}
                className="w-72 shrink-0 flex flex-col gap-3 p-3 rounded-2xl bg-accent/25 border border-border/60 min-h-[500px]"
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

                    return (
                      <Card
                        key={item.id}
                        className={`group p-4 rounded-2xl border border-border/80 hover:border-foreground/30 bg-card shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col gap-3 ${
                          temAjustes ? 'border-destructive/40 bg-destructive/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClienteAvatar
                              nome={item.cliente?.nome || 'Cliente'}
                              cor={item.cliente?.cor}
                              fotoUrl={item.cliente?.foto_url}
                              tamanho="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{item.cliente?.nome}</p>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                {item.tipo}
                              </span>
                            </div>
                          </div>

                          <Badge variant={info.variant} className="text-[9px] font-bold">
                            {info.label}
                          </Badge>
                        </div>

                        {item.titulo && (
                          <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                            {item.titulo}
                          </h4>
                        )}

                        {/* Badges de Slides ou Timecode */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {item.arquivos?.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-accent/60 text-muted-foreground font-mono font-medium border border-border/50">
                              {item.arquivos.length} {item.tipo === 'reel' ? 'vídeo' : 'slides'}
                            </span>
                          )}

                          {temComentarios && (
                            <span className={`px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 border ${
                              temAjustes 
                                ? 'bg-destructive/15 text-destructive border-destructive/20' 
                                : 'bg-lime/40 text-foreground border-foreground/10'
                            }`}>
                              <MessageSquare className="w-3 h-3" />
                              {item.comentarios_revisao.length} ajustes
                            </span>
                          )}
                        </div>

                        {/* Botões de Ação de Aprovação WhatsApp */}
                        <div className="border-t border-border/60 pt-2.5 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleCopiarLinkAprovacao(item.token_aprovacao)}
                            title="Copiar link de aprovação"
                            className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Link</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDisparoWhatsApp(item)}
                            title="Enviar para o WhatsApp do cliente"
                            className="text-[11px] font-bold text-foreground bg-lime/60 hover:bg-lime px-2 py-1 rounded-lg flex items-center gap-1 border border-foreground/10 transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
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
                  <th className="py-2.5 px-3">Título / Tipo</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Mídia</th>
                  <th className="py-2.5 px-3">Ajustes</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {itemsFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <ClienteAvatar nome={item.cliente?.nome || 'Cliente'} cor={item.cliente?.cor} tamanho="sm" />
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
                    <td className="py-3 px-3 font-mono">{item.arquivos?.length || 0} arquivos</td>
                    <td className="py-3 px-3 font-mono">{item.comentarios_revisao?.length || 0}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDisparoWhatsApp(item)}
                        className="p-1.5 rounded-lg bg-lime text-foreground hover:bg-lime/80 font-bold"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal / Sheet para Criar Nova Demanda */}
      <Sheet open={modalNovoAberto} onClose={() => setModalNovoAberto(false)} aria-label="Nova Demanda">
        <form onSubmit={handleSalvarNovo} className="p-6 flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Esteira de Produção</span>
            <h3 className="text-lg font-bold font-display text-foreground mt-0.5">Nova Publicação / Conteúdo</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Cliente</label>
            <Select value={formClienteId} onChange={(e) => setFormClienteId(e.target.value)} required>
              <option value="">Selecione o cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Formato</label>
            <Select value={formTipo} onChange={(e) => setFormTipo(e.target.value as TipoConteudo)}>
              <option value="post">Carrossel / Post Feed</option>
              <option value="reel">Vídeo Reels</option>
              <option value="story">Story</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Título de Referência</label>
            <Input
              placeholder="Ex.: 5 Dicas para Clientes / Vídeo Apresentação"
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">URLs das Mídias (Uma por linha)</label>
            <Textarea
              placeholder="https://.../slide1.png&#10;https://.../slide2.png"
              value={formUrls}
              onChange={(e) => setFormUrls(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Legenda do Post</label>
            <Textarea
              placeholder="Digite a copy/legenda do post..."
              value={formLegenda}
              onChange={(e) => setFormLegenda(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setModalNovoAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={salvando}>
              Criar na Esteira
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
