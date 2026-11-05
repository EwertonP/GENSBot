'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FilterBar, type FiltroSelect } from '@/components/ui/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Tip } from '@/components/ui/tooltip';
import { ClienteAvatar } from '@/components/cliente-avatar';
import CrmKanban from './crm-kanban';
import CrmTabela from './crm-tabela';
import CrmDealDrawer from './crm-deal-drawer';
import CrmNovoNegocioModal from './crm-novo-negocio-modal';
import CrmPipelineModal from './crm-pipeline-modal';
import CrmAiConfigModal from './crm-ai-config-modal';
import { formatarMoeda, calcularDiasSemContato } from '@/lib/crm';
import type { CrmPipeline, CrmEstagio, CrmNegocio, CrmMetricas, CrmStatus } from '@/types/crm';
import type { Cliente } from '@/lib/clientes';
import {
  Target,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Columns3,
  Table as TableIcon,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Building2,
  User,
  Layers,
  Settings,
  Edit3,
  Bot,
  Sparkles,
} from 'lucide-react';

interface CrmTabProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
  clienteSelecionado?: string | null;
}

export default function CrmTab({
  showToast = (msg) => console.log(msg),
  clienteSelecionado: clienteInicialId = null,
}: CrmTabProps) {
  // Contexto: null = Agência GENS, string = id do cliente
  const [contextoClienteId, setContextoClienteId] = useState<string | null>(clienteInicialId);

  // Dados
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<{ id: string; nome: string }[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [pipelineAtivoId, setPipelineAtivoId] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<CrmNegocio[]>([]);
  const [metricas, setMetricas] = useState<CrmMetricas | null>(null);

  // Filtros & Visualização
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela'>('kanban');
  const [busca, setBusca] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState<'aberto' | 'todos' | 'ganho' | 'perdido'>('aberto');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');

  // Estados de Loading & Modais
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [dealDrawerId, setDealDrawerId] = useState<string | null>(null);
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novoModalEstagioId, setNovoModalEstagioId] = useState<string | null>(null);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [pipelineParaEditar, setPipelineParaEditar] = useState<CrmPipeline | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Perfil do usuário (admin/membro vs cliente/secretária) & Toggle rápido de IA
  const [usuarioPapel, setUsuarioPapel] = useState<'admin' | 'membro' | 'cliente' | null>(null);
  const [aiAtivo, setAiAtivo] = useState(false);
  const [alternandoAi, setAlternandoAi] = useState(false);

  // Sincroniza cliente inicial se passado externamente
  useEffect(() => {
    if (clienteInicialId !== undefined) {
      setContextoClienteId(clienteInicialId);
    }
  }, [clienteInicialId]);

  // Carrega lista de clientes, membros e perfil do usuário logado
  useEffect(() => {
    async function carregarDependencias() {
      try {
        const [resClientes, resEquipe, resMe] = await Promise.all([
          fetch('/api/clientes').then((r) => (r.ok ? r.json() : { clientes: [] })),
          fetch('/api/equipe').then((r) => (r.ok ? r.json() : { membros: [] })),
          fetch('/api/membros/me').then((r) => (r.ok ? r.json() : null)),
        ]);

        if (Array.isArray(resClientes.clientes)) {
          setClientes(resClientes.clientes);
        }
        if (Array.isArray(resEquipe.membros)) {
          setMembros(resEquipe.membros.map((m: { id: string; nome: string }) => ({ id: m.id, nome: m.nome })));
        }
        if (resMe?.membro?.papel) {
          setUsuarioPapel(resMe.membro.papel);
        }
      } catch (err) {
        console.error('Erro ao carregar clientes/equipe/me:', err);
      }
    }
    carregarDependencias();
  }, []);

  // Carrega status da IA para o contexto selecionado
  const carregarStatusAi = useCallback(async () => {
    try {
      const url = contextoClienteId
        ? `/api/crm/ai/config?cliente_id=${encodeURIComponent(contextoClienteId)}`
        : '/api/crm/ai/config';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAiAtivo(Boolean(data?.ativo));
      }
    } catch (err) {
      console.error('Erro ao carregar status da IA:', err);
    }
  }, [contextoClienteId]);

  useEffect(() => {
    carregarStatusAi();
  }, [carregarStatusAi]);

  // Alterna rapidamente o status da IA
  const handleAlternarAi = async () => {
    setAlternandoAi(true);
    const novoStatus = !aiAtivo;
    setAiAtivo(novoStatus); // Otimista

    try {
      const res = await fetch('/api/crm/ai/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: contextoClienteId,
          ativo: novoStatus,
        }),
      });

      if (!res.ok) throw new Error('Falha ao alternar status da IA.');
      const data = await res.json();
      setAiAtivo(Boolean(data.ativo));
      showToast(
        novoStatus ? 'Atendimento por IA ativado com sucesso!' : 'Atendimento por IA pausado.',
        'success'
      );
    } catch (err) {
      setAiAtivo(!novoStatus); // Reverte
      showToast('Erro ao alternar status da IA.', 'error');
    } finally {
      setAlternandoAi(false);
    }
  };

  // Carrega pipelines do contexto selecionado (Agência ou Cliente)
  const carregarPipelines = useCallback(async () => {
    try {
      const url = contextoClienteId
        ? `/api/crm/pipelines?cliente_id=${encodeURIComponent(contextoClienteId)}`
        : '/api/crm/pipelines';

      const res = await fetch(url);
      const data = await res.json();
      const listaPipelines: CrmPipeline[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.pipelines)
        ? data.pipelines
        : [];

      if (res.ok && listaPipelines.length > 0) {
        setPipelines(listaPipelines);
        // Mantém o ativo se ainda existir na lista, senão escolhe o padrão ou o primeiro
        setPipelineAtivoId((prevId) => {
          if (prevId && listaPipelines.some((p) => p.id === prevId)) return prevId;
          const padrao = listaPipelines.find((p) => p.padrao) || listaPipelines[0];
          return padrao.id;
        });
      } else {
        setPipelines([]);
        setPipelineAtivoId(null);
      }
    } catch (err) {
      console.error('Erro ao carregar pipelines:', err);
      showToast('Erro ao carregar funis de vendas.', 'error');
    }
  }, [contextoClienteId, showToast]);

  useEffect(() => {
    carregarPipelines();
  }, [carregarPipelines]);

  // Carrega negócios e métricas do pipeline ativo
  const carregarNegocios = useCallback(async (isSilent = false) => {
    if (!pipelineAtivoId) {
      setNegocios([]);
      setMetricas(null);
      setLoading(false);
      return;
    }

    if (!isSilent) setLoading(true);
    else setRecarregando(true);

    try {
      const params = new URLSearchParams({
        pipeline_id: pipelineAtivoId,
      });

      if (contextoClienteId) {
        params.set('cliente_id', contextoClienteId);
      }

      if (filtroStatus !== 'todos') {
        params.set('status', filtroStatus);
      }

      const [resNegocios, resMetricas] = await Promise.all([
        fetch(`/api/crm/negocios?${params.toString()}`).then((r) => r.json()),
        fetch(`/api/crm/metricas?pipeline_id=${pipelineAtivoId}${contextoClienteId ? `&cliente_id=${contextoClienteId}` : ''}`).then((r) => r.json()),
      ]);

      const listaNegocios = Array.isArray(resNegocios)
        ? resNegocios
        : Array.isArray(resNegocios?.negocios)
        ? resNegocios.negocios
        : [];
      setNegocios(listaNegocios);

      if (resMetricas?.totalNegocios !== undefined) {
        setMetricas(resMetricas);
      } else if (resMetricas?.metricas) {
        setMetricas(resMetricas.metricas);
      } else {
        setMetricas(null);
      }
    } catch (err) {
      console.error('Erro ao carregar negócios:', err);
      showToast('Erro ao atualizar oportunidades.', 'error');
    } finally {
      setLoading(false);
      setRecarregando(false);
    }
  }, [pipelineAtivoId, contextoClienteId, filtroStatus, showToast]);

  useEffect(() => {
    carregarNegocios();
  }, [carregarNegocios]);

  // Pipeline ativo e seus estágios
  const pipelineAtivo = useMemo(() => {
    return pipelines.find((p) => p.id === pipelineAtivoId) || null;
  }, [pipelines, pipelineAtivoId]);

  const estagios = useMemo(() => {
    return pipelineAtivo?.estagios || [];
  }, [pipelineAtivo]);

  // Negócios filtrados por texto e responsável
  const negociosFiltrados = useMemo(() => {
    return negocios.filter((neg) => {
      // Filtro de busca
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTitulo = neg.titulo?.toLowerCase().includes(termo);
        const matchContato = neg.nome_contato?.toLowerCase().includes(termo);
        const matchEmpresa = neg.empresa?.toLowerCase().includes(termo);
        const matchEmail = neg.email?.toLowerCase().includes(termo);
        if (!matchTitulo && !matchContato && !matchEmpresa && !matchEmail) {
          return false;
        }
      }

      // Filtro de responsável
      if (filtroResponsavel !== 'todos') {
        if (filtroResponsavel === 'sem_responsavel' && neg.responsavel_id) return false;
        if (filtroResponsavel !== 'sem_responsavel' && neg.responsavel_id !== filtroResponsavel) return false;
      }

      // Filtro de origem
      if (filtroOrigem !== 'todos' && neg.origem !== filtroOrigem) {
        return false;
      }

      return true;
    });
  }, [negocios, busca, filtroResponsavel, filtroOrigem]);

  // Mover negócio no Kanban (Drag & Drop)
  const handleMoverNegocio = async (
    negocioId: string,
    novoEstagioId: string,
    targetNegocioId?: string | null
  ) => {
    // Atualização otimista imediata na UI
    const negocioOriginal = negocios.find((n) => n.id === negocioId);
    if (!negocioOriginal) return;

    const estagioDestino = estagios.find((e) => e.id === novoEstagioId);
    let novoStatus: CrmStatus = negocioOriginal.status;
    if (estagioDestino?.tipo_conclusao === 'ganho') novoStatus = 'ganho';
    else if (estagioDestino?.tipo_conclusao === 'perdido') novoStatus = 'perdido';
    else if (negocioOriginal.status !== 'aberto') novoStatus = 'aberto';

    const negociosAtualizados = negocios.map((n) =>
      n.id === negocioId
        ? {
            ...n,
            estagio_id: novoEstagioId,
            status: novoStatus,
            atualizado_em: new Date().toISOString(),
          }
        : n
    );
    setNegocios(negociosAtualizados);

    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/mover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estagio_id: novoEstagioId,
          target_negocio_id: targetNegocioId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao mover negócio');
      }

      // Recarrega silenciosamente métricas e ordem consolidada
      carregarNegocios(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao mover negócio', 'error');
      // Rollback se falhar
      carregarNegocios(true);
    }
  };

  const clienteAtual = useMemo(() => {
    if (!contextoClienteId) return null;
    return clientes.find((c) => c.id === contextoClienteId) || null;
  }, [clientes, contextoClienteId]);

  const totalEstagnados = useMemo(() => {
    return negocios.filter((n) => n.status === 'aberto' && calcularDiasSemContato(n.ultimo_contato_em) >= 7).length;
  }, [negocios]);

  const filtrosCrm: FiltroSelect[] = useMemo(() => [
    {
      id: 'status',
      rotulo: 'Status',
      valor: filtroStatus,
      onChange: (v) => setFiltroStatus(v as any),
      padrao: 'aberto',
      opcoes: [
        { valor: 'aberto', rotulo: 'Em Aberto' },
        { valor: 'todos', rotulo: 'Todos os Status' },
        { valor: 'ganho', rotulo: 'Ganhos' },
        { valor: 'perdido', rotulo: 'Perdidos' },
      ],
    },
    {
      id: 'responsavel',
      rotulo: 'Responsável',
      valor: filtroResponsavel,
      onChange: (v) => setFiltroResponsavel(v),
      padrao: 'todos',
      opcoes: [
        { valor: 'todos', rotulo: 'Todos os Responsáveis' },
        { valor: 'sem_responsavel', rotulo: 'Não Atribuídos' },
        ...membros.map((m) => ({ valor: m.id, rotulo: m.nome })),
      ],
    },
    {
      id: 'origem',
      rotulo: 'Origem',
      valor: filtroOrigem,
      onChange: (v) => setFiltroOrigem(v),
      padrao: 'todos',
      opcoes: [
        { valor: 'todos', rotulo: 'Todas as Origens' },
        { valor: 'presencial', rotulo: 'Presencial' },
        { valor: 'ligacao', rotulo: 'Ligação' },
        { valor: 'whatsapp', rotulo: 'WhatsApp' },
        { valor: 'instagram', rotulo: 'Instagram' },
        { valor: 'google', rotulo: 'Google' },
        { valor: 'site', rotulo: 'Site' },
        { valor: 'webhook_ads', rotulo: 'Meta Ads' },
        { valor: 'formulario', rotulo: 'Formulário' },
        { valor: 'indicacao', rotulo: 'Indicação' },
        { valor: 'manual', rotulo: 'Manual' },
      ],
    },
  ], [filtroStatus, filtroResponsavel, filtroOrigem, membros]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in w-full min-w-0 max-w-full">
      {/* ──────────────── Topo: Seletor de Contexto (Agência vs Clientes) & Pipeline ──────────────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm w-full min-w-0">
        {/* Lado Esquerdo: Identificador Estrito de Escopo do CRM */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/40 border border-border/80 text-xs">
            {contextoClienteId ? (
              (() => {
                const cli = clientes.find((c) => c.id === contextoClienteId);
                return (
                  <div className="flex items-center gap-2">
                    <ClienteAvatar
                      nome={cli?.nome || 'Cliente'}
                      cor={cli?.cor}
                      fotoUrl={cli?.foto_url}
                      tamanho="xs"
                    />
                    <span className="font-bold text-foreground">{cli?.nome || 'Cliente'}</span>
                    <Badge variant="brand" className="text-[10px] py-0 px-1.5 h-5">
                      CRM Exclusivo
                    </Badge>
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-foreground">Agência GENS</span>
                <Badge variant="brand" className="text-[10px] py-0 px-1.5 h-5">
                  Prospecção Interna
                </Badge>
              </div>
            )}
          </div>

          {/* Pipeline Selector & Ações de Funil */}
          <div className="flex flex-wrap items-center gap-1.5 sm:pl-2 sm:border-l border-border/70">
            {pipelines.length > 0 && (
              <>
                <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Select
                  value={pipelineAtivoId || ''}
                  onChange={(e) => setPipelineAtivoId(e.target.value)}
                  className="text-xs h-10 md:h-9 font-semibold min-w-[160px]"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.padrao ? '★' : ''}
                    </option>
                  ))}
                </Select>

                {pipelineAtivo && (
                  <Tip label="Editar etapas e configurações deste funil">
                    <button
                      type="button"
                      onClick={() => {
                        setPipelineParaEditar(pipelineAtivo);
                        setShowPipelineModal(true);
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </Tip>
                )}
              </>
            )}

            <Tip label="Criar novo funil de vendas">
              <button
                type="button"
                onClick={() => {
                  setPipelineParaEditar(null);
                  setShowPipelineModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-accent/70 hover:bg-accent text-foreground transition-colors border border-border cursor-pointer h-10 md:h-9"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="inline">Novo Funil</span>
              </button>
            </Tip>
          </div>
        </div>

        {/* Lado Direito: Ações Principais */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between sm:justify-end">
          {/* Alternador de Visualização (Kanban vs Tabela) */}
          <div className="flex items-center p-0.5 rounded-xl bg-accent/40 border border-border/80">
            <Tip label="Visualização em Kanban">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Columns3 className="w-4 h-4" />
              </button>
            </Tip>
            <Tip label="Visualização em Tabela">
              <button
                type="button"
                onClick={() => setViewMode('tabela')}
                className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'tabela'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </Tip>
          </div>

          {/* Atualizar */}
          <Tip label="Atualizar funil">
            <Button
              variant="outline"
              size="sm"
              onClick={() => carregarNegocios(false)}
              disabled={loading || recarregando}
              className="h-10 w-10 md:h-9 md:w-9 p-0 rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 ${recarregando ? 'animate-spin' : ''}`} />
            </Button>
          </Tip>

          {/* Controle do Agente de IA: Toggle simples para secretária ou Configuração completa para Admin */}
          {usuarioPapel === 'cliente' ? (
            <Tip label={aiAtivo ? 'IA Ativa (Clique para pausar atendimento automático)' : 'IA Pausada (Clique para ligar)'}>
              <button
                type="button"
                onClick={handleAlternarAi}
                disabled={alternandoAi}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs cursor-pointer h-10 md:h-9 ${
                  aiAtivo
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-muted/40 text-muted-foreground border-border/80 hover:bg-muted/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${aiAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'}`} />
                <Sparkles className={`w-3.5 h-3.5 ${aiAtivo ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <span>{aiAtivo ? 'IA Ligada' : 'IA Desligada'}</span>
              </button>
            </Tip>
          ) : (
            <Tip label="Configurar Agente de IA (OpenAI, Gemini, Claude) para atendimento e CRM">
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all shadow-2xs cursor-pointer h-10 md:h-9"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="inline">Agente IA SDR</span>
              </button>
            </Tip>
          )}

          {/* Botão + Nova Oportunidade */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setNovoModalEstagioId(null);
              setShowNovoModal(true);
            }}
            disabled={!pipelineAtivoId || estagios.length === 0}
            className="h-10 md:h-9 text-xs font-semibold shadow-sm rounded-xl px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* ──────────────── Métricas Resumo do Funil ──────────────── */}
      {metricas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Card 1: Em Aberto */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Em Negociação</span>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold font-display text-foreground">
              {formatarMoeda(metricas.valorTotalAberto)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {metricas.negociosAbertos} oportunidades ativas
            </div>
          </div>

          {/* Card 2: Receita Ganha */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Negócios Ganhos</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {formatarMoeda(metricas.valorTotalGanho)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {metricas.negociosGanhos} convertidos
            </div>
          </div>

          {/* Card 3: Taxa de Conversão */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Conversão Geral</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-display text-foreground">
              {metricas.taxaConversao.toFixed(1)}%
            </div>
            <div className="text-[11px] text-muted-foreground">
              {metricas.negociosGanhos} ganhos vs {metricas.negociosPerdidos} perdidos
            </div>
          </div>

          {/* Card 4: Alerta Estagnação */}
          <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Atenção Comercial</span>
              <AlertTriangle className={`w-4 h-4 ${totalEstagnados > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>
            <div className={`text-xl font-bold font-display ${totalEstagnados > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {totalEstagnados}
            </div>
            <div className="text-[11px] text-muted-foreground">
              sem contato &gt; 7 dias
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── Barra de Filtros & Busca ──────────────── */}
      <FilterBar
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por lead, empresa, e-mail..."
        filtros={filtrosCrm}
      />

      {/* ──────────────── Conteúdo Principal (Kanban ou Tabela) ──────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-xs text-muted-foreground">Carregando oportunidades do funil...</p>
        </div>
      ) : estagios.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/50 max-w-lg mx-auto">
          <Target className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-foreground">
            {contextoClienteId ? 'Funil do cliente pronto para inicializar' : 'Funil da Agência'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Gere o funil de vendas com as etapas comerciais padrão para começar a gerenciar leads e oportunidades.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => carregarPipelines()}
              className="text-xs font-semibold shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Carregar Funil Padrão
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPipelineParaEditar(null);
                setShowPipelineModal(true);
              }}
              className="text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Criar Novo Funil
            </Button>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <CrmKanban
          estagios={estagios}
          negocios={negociosFiltrados}
          onMoverNegocio={handleMoverNegocio}
          onAbrirNegocio={(neg) => setDealDrawerId(neg.id)}
          onNovoNegocioNoEstagio={(estagioId) => {
            setNovoModalEstagioId(estagioId);
            setShowNovoModal(true);
          }}
        />
      ) : (
        <CrmTabela
          negocios={negociosFiltrados}
          estagios={estagios}
          onAbrirNegocio={(neg) => setDealDrawerId(neg.id)}
        />
      )}

      {/* ──────────────── Drawer de Detalhes da Oportunidade ──────────────── */}
      <CrmDealDrawer
        negocioId={dealDrawerId}
        estagios={estagios}
        membros={membros}
        onClose={() => setDealDrawerId(null)}
        onAtualizado={() => carregarNegocios(true)}
        showToast={showToast}
      />

      {/* ──────────────── Modal Criar Nova Oportunidade ──────────────── */}
      {pipelineAtivoId && (
        <CrmNovoNegocioModal
          open={showNovoModal}
          onClose={() => {
            setShowNovoModal(false);
            setNovoModalEstagioId(null);
          }}
          pipelineId={pipelineAtivoId}
          estagios={estagios}
          estagioInicialId={novoModalEstagioId}
          clienteId={contextoClienteId}
          membros={membros}
          onCriado={(novoNeg) => {
            setNegocios((prev) => [novoNeg, ...prev]);
            carregarNegocios(true);
          }}
          showToast={showToast}
        />
      )}

      {/* ──────────────── Modal Criar / Editar Funil de Vendas ──────────────── */}
      <CrmPipelineModal
        open={showPipelineModal}
        onClose={() => {
          setShowPipelineModal(false);
          setPipelineParaEditar(null);
        }}
        clienteId={contextoClienteId}
        pipelineParaEditar={pipelineParaEditar}
        onSalvo={() => carregarPipelines()}
        showToast={showToast}
      />

      {/* ──────────────── Modal Configuração Agente de IA SDR ──────────────── */}
      <CrmAiConfigModal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        clienteId={contextoClienteId}
        pipelines={pipelines}
        showToast={showToast}
      />
    </div>
  );
}
