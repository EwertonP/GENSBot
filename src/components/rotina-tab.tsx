'use client';
import { Avatar } from '@/components/ui/avatar';
import { SegmentedItem } from '@/components/ui/segmented';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  CheckSquare,
  Clock,
  Hourglass,
  Layers,
  Plus,
  Search,
  Timer,
  Trash2,
  User,
  Repeat,
  Rocket,
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
import { MoverEtapaMenu } from '@/components/mover-etapa-menu';
import { toast } from '@/components/ui/toast';
import { RotinaRecorrentesSheet } from '@/components/rotina-recorrentes';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';
import { STATUS_LABELS, type StatusConteudo } from '@/lib/conteudo';
import {
  COLUNAS_ROTINA,
  TIPO_TAREFA_LABELS,
  colunaDaDemanda,
  compararCards,
  estaAtrasado,
  etapaAoSoltarDemanda,
  formatarEstimativa,
  normalizarStatusTarefa,
  type DemandaRotina,
  type PrioridadeTarefa,
  type StatusTarefa,
  type TarefaRotina,
  type TipoTarefa,
} from '@/lib/rotina';

interface RotinaTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  /** Abre a demanda na esteira (aba Demandas). */
  onAbrirDemanda?: (demandaId: string) => void;
}

const PRIORIDADE_LABELS: Record<string, { label: string; variant: 'muted' | 'info' | 'warning' | 'destructive' }> = {
  baixa: { label: 'Baixa', variant: 'muted' },
  normal: { label: 'Normal', variant: 'info' },
  media: { label: 'Média', variant: 'info' },
  alta: { label: 'Alta', variant: 'warning' },
  urgente: { label: 'Urgente', variant: 'destructive' },
};

const ESTIMATIVAS = [
  { value: '', label: 'Sem estimativa' },
  { value: '15', label: '15min' },
  { value: '30', label: '30min' },
  { value: '60', label: '1h' },
  { value: '120', label: '2h' },
  { value: '240', label: '4h' },
  { value: '480', label: '1 dia' },
];

type FiltroTipo = 'todos' | 'demandas' | TipoTarefa;

type QuadroCard =
  | { kind: 'tarefa'; id: string; coluna: StatusTarefa; atrasado: boolean; prazo: string | null; prioridade: string; tarefa: TarefaRotina }
  | { kind: 'demanda'; id: string; coluna: StatusTarefa; atrasado: boolean; prazo: string | null; prioridade: string; demanda: DemandaRotina };

function formatarData(data: string) {
  const [y, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}${y !== String(new Date().getFullYear()) ? `/${y.slice(2)}` : ''}`;
}

export default function RotinaTab({ showToast, onAbrirDemanda }: RotinaTabProps) {
  const [tarefas, setTarefas] = useState<TarefaRotina[]>([]);
  const [demandas, setDemandas] = useState<DemandaRotina[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [eu, setEu] = useState<{ id: string; papel: 'master' | 'membro' } | null>(null);
  const [carregando, setCarregando] = useState(true);

  // De quem é o quadro. '' = eu. Só master troca.
  const [verDe, setVerDe] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('all');
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>('todos');

  // Quick add
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoTarefa>('interno');
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoSolicitante, setNovoSolicitante] = useState('');
  const [novaDemandaId, setNovaDemandaId] = useState('');
  const [novoResponsavelId, setNovoResponsavelId] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState<PrioridadeTarefa>('normal');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [novaEstimativa, setNovaEstimativa] = useState('');
  const [criando, setCriando] = useState(false);

  const [colunaSobre, setColunaSobre] = useState<StatusTarefa | null>(null);
  const [editando, setEditando] = useState<TarefaRotina | null>(null);
  const [recorrentesAberto, setRecorrentesAberto] = useState(false);
  // Incrementa para recarregar o quadro (ex.: rotina nova gerou a tarefa de hoje).
  const [versaoQuadro, setVersaoQuadro] = useState(0);

  // showToast vem recriado a cada render da página; a ref evita refazer o fetch do quadro por isso.
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  });

  const ehMaster = eu?.papel === 'master';
  const alvo = verDe || eu?.id || '';

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes').then((r) => (r.ok ? r.json() : { clientes: [] })).catch(() => ({ clientes: [] })),
      fetch('/api/equipe').then((r) => (r.ok ? r.json() : { membros: [] })).catch(() => ({ membros: [] })),
    ]).then(([cli, eq]) => {
      if (cli.clientes) setClientes(cli.clientes);
      if (eq.membros) setMembros(eq.membros.filter((m: MembroEquipe) => m.ativo));
    });
  }, []);

  // Recarrega o quadro quando muda de quem ele é. O "carregando" liga no onChange do seletor.
  useEffect(() => {
    let ativo = true;
    const qs = verDe ? `?membro_id=${encodeURIComponent(verDe)}` : '';
    fetch(`/api/rotina${qs}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!ativo) return;
        setTarefas(data.tarefas || []);
        setDemandas(data.demandas || []);
        if (data.eu) setEu(data.eu);
      })
      .catch((err) => {
        if (ativo) showToastRef.current(err instanceof Error && err.message ? err.message : 'Erro ao carregar sua rotina.', 'error');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [verDe, versaoQuadro]);

  const nomeMembro = (id: string | null) => membros.find((m) => m.id === id)?.nome || null;

  // ---------- Cards ----------
  const subTarefasPorDemanda = useMemo(() => {
    const mapa = new Map<string, { total: number; abertas: number }>();
    for (const t of tarefas) {
      if (!t.demanda_id) continue;
      const atual = mapa.get(t.demanda_id) || { total: 0, abertas: 0 };
      atual.total += 1;
      if (normalizarStatusTarefa(t.status) !== 'concluido') atual.abertas += 1;
      mapa.set(t.demanda_id, atual);
    }
    return mapa;
  }, [tarefas]);

  const cards = useMemo<QuadroCard[]>(() => {
    const termo = busca.trim().toLowerCase();
    const lista: QuadroCard[] = [];

    if (tipoFiltro !== 'demandas') {
      for (const t of tarefas) {
        if (tipoFiltro !== 'todos' && t.tipo !== tipoFiltro) continue;
        if (clienteFiltro !== 'all' && t.cliente_id !== clienteFiltro) continue;
        if (termo) {
          const texto = [t.titulo, t.cliente?.nome, t.solicitante, t.demanda?.titulo].filter(Boolean).join(' ').toLowerCase();
          if (!texto.includes(termo)) continue;
        }
        const coluna = normalizarStatusTarefa(t.status);
        lista.push({ kind: 'tarefa', id: t.id, coluna, prazo: t.prazo, prioridade: t.prioridade, atrasado: estaAtrasado(t.prazo, coluna), tarefa: t });
      }
    }

    if (tipoFiltro === 'todos' || tipoFiltro === 'demandas') {
      for (const d of demandas) {
        if (clienteFiltro !== 'all' && d.cliente_id !== clienteFiltro) continue;
        if (termo) {
          const texto = [d.titulo, d.cliente?.nome].filter(Boolean).join(' ').toLowerCase();
          if (!texto.includes(termo)) continue;
        }
        const coluna = colunaDaDemanda(d.status);
        const prazo = d.prazo || d.data_programada;
        lista.push({ kind: 'demanda', id: d.id, coluna, prazo, prioridade: d.prioridade || 'normal', atrasado: estaAtrasado(prazo, coluna), demanda: d });
      }
    }

    return lista.sort(compararCards);
  }, [tarefas, demandas, busca, clienteFiltro, tipoFiltro]);

  const porColuna = useMemo(() => {
    const grupos: Record<StatusTarefa, QuadroCard[]> = { a_fazer: [], fazendo: [], aguardando: [], concluido: [] };
    for (const c of cards) grupos[c.coluna].push(c);
    return grupos;
  }, [cards]);

  const resumo = useMemo(() => {
    const abertos = cards.filter((c) => c.coluna !== 'concluido');
    const minutos = abertos.reduce((soma, c) => soma + (c.kind === 'tarefa' ? c.tarefa.estimativa_min || 0 : 0), 0);
    return {
      abertos: abertos.length,
      atrasados: abertos.filter((c) => c.atrasado).length,
      aguardando: porColuna.aguardando.length,
      minutos,
    };
  }, [cards, porColuna]);

  // ---------- Ações ----------
  async function handleCriarTarefa(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    if (novoTipo === 'sub_tarefa' && !novaDemandaId) {
      showToast('Escolha a demanda desta sub-tarefa.', 'error');
      return;
    }

    setCriando(true);
    try {
      const res = await fetch('/api/rotina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novoTitulo.trim(),
          tipo: novoTipo,
          cliente_id: novoTipo === 'sub_tarefa' ? null : novoClienteId || null,
          solicitante: novoTipo === 'peca_avulsa' && !novoClienteId ? novoSolicitante : null,
          demanda_id: novoTipo === 'sub_tarefa' ? novaDemandaId : null,
          responsavel_id: novoResponsavelId || (verDe && verDe !== 'all' ? verDe : null),
          prioridade: novaPrioridade,
          prazo: novoPrazo || null,
          estimativa_min: novaEstimativa ? Number(novaEstimativa) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTarefas((prev) => [data.tarefa, ...prev]);
      setNovoTitulo('');
      setNovoPrazo('');
      setNovoSolicitante('');
      setNovaEstimativa('');
      showToast('Tarefa adicionada.', 'success');
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Erro ao criar tarefa.', 'error');
    } finally {
      setCriando(false);
    }
  }

  async function moverTarefa(tarefa: TarefaRotina, destino: StatusTarefa) {
    if (normalizarStatusTarefa(tarefa.status) === destino) return;
    const anterior = tarefa;
    setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? { ...t, status: destino } : t)));
    try {
      const res = await fetch(`/api/rotina/${tarefa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destino }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? data.tarefa : t)));
      if (destino === 'concluido') showToast('Tarefa concluída.', 'success');
    } catch {
      setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? anterior : t)));
      showToast('Não foi possível mover a tarefa.', 'error');
    }
  }

  async function moverDemanda(demanda: DemandaRotina, destino: StatusTarefa) {
    const novaEtapa = etapaAoSoltarDemanda(demanda.status, destino);
    if (!novaEtapa) {
      showToast('Demanda vai para Concluído quando for publicada, pela esteira.', 'error');
      return;
    }
    if (novaEtapa === demanda.status) return;
    const anterior = demanda.status;
    setDemandas((prev) => prev.map((d) => (d.id === demanda.id ? { ...d, status: novaEtapa } : d)));
    try {
      const res = await fetch(`/api/conteudo/${demanda.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novaEtapa }),
      });
      if (!res.ok) throw new Error();
      showToast(`Demanda movida para ${STATUS_LABELS[novaEtapa].label} na esteira.`, 'success');
    } catch {
      setDemandas((prev) => prev.map((d) => (d.id === demanda.id ? { ...d, status: anterior } : d)));
      showToast('Não foi possível mover a demanda.', 'error');
    }
  }

  function moverCard(card: QuadroCard, destino: StatusTarefa) {
    if (card.kind === 'tarefa') moverTarefa(card.tarefa, destino);
    else moverDemanda(card.demanda, destino);
  }

  async function salvarAguardandoDe(tarefa: TarefaRotina, valor: string) {
    const aguardando_de = valor.trim() || null;
    if (aguardando_de === (tarefa.aguardando_de || null)) return;
    setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? { ...t, aguardando_de } : t)));
    try {
      const res = await fetch(`/api/rotina/${tarefa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aguardando_de }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showToast('Não foi possível salvar.', 'error');
    }
  }

  // Excluir com "Desfazer": o DELETE só vai pro servidor quando o toast fecha.
  function handleExcluir(tarefa: TarefaRotina) {
    setTarefas((prev) => prev.filter((t) => t.id !== tarefa.id));
    const restaurar = () => setTarefas((prev) => (prev.some((t) => t.id === tarefa.id) ? prev : [tarefa, ...prev]));
    let desfeito = false;
    toast.undo(
      'Tarefa excluída',
      () => {
        desfeito = true;
        restaurar();
      },
      {
        description: tarefa.titulo,
        onClose: async () => {
          if (desfeito) return;
          try {
            const res = await fetch(`/api/rotina/${tarefa.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
          } catch {
            restaurar();
            toast.error('Não foi possível excluir a tarefa', { description: 'Ela voltou para o quadro.' });
          }
        },
      }
    );
  }

  async function salvarEdicao(atualizada: TarefaRotina) {
    const original = tarefas.find((t) => t.id === atualizada.id);
    const campos = ['titulo', 'descricao', 'tipo', 'cliente_id', 'solicitante', 'responsavel_id', 'prioridade', 'prazo', 'estimativa_min', 'aguardando_de'] as const;
    const body: Record<string, unknown> = {};
    for (const c of campos) {
      if (!original || original[c] !== atualizada[c]) body[c] = atualizada[c];
    }
    if (Object.keys(body).length === 0) {
      setEditando(null);
      return;
    }
    try {
      const res = await fetch(`/api/rotina/${atualizada.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTarefas((prev) => {
        // Reatribuída para outra pessoa: sai deste quadro.
        const saiuDoQuadro = alvo !== 'all' && data.tarefa.responsavel_id !== alvo;
        return saiuDoQuadro ? prev.filter((t) => t.id !== data.tarefa.id) : prev.map((t) => (t.id === data.tarefa.id ? data.tarefa : t));
      });
      setEditando(null);
      showToast('Tarefa atualizada.', 'success');
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Erro ao salvar tarefa.', 'error');
    }
  }

  async function promoverTarefa(tarefa: TarefaRotina, tipo: string, clienteId: string | null) {
    try {
      const res = await fetch(`/api/rotina/${tarefa.id}/promover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, cliente_id: clienteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditando(null);
      setCarregando(true);
      setVersaoQuadro((v) => v + 1);
      toast.success('Virou demanda na esteira', {
        description: `"${tarefa.titulo}" entrou em Planejamento.`,
        action: onAbrirDemanda ? { label: 'Abrir', onClick: () => onAbrirDemanda(data.demanda.id) } : undefined,
      });
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Não foi possível criar a demanda.', 'error');
    }
  }

  // ---------- Render ----------
  const demandasAbertas = demandas.filter((d) => d.status !== 'publicado');
  const etapasMenu = COLUNAS_ROTINA.map((c) => ({ status: c.id, label: c.label }));
  const titulo =
    alvo === 'all' ? 'Trabalho da equipe' : verDe && verDe !== eu?.id ? `Trabalho de ${nomeMembro(verDe) || 'membro'}` : 'Meu trabalho';

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">Rotina & afazeres</span>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">{titulo}</h2>
          <p className="text-xs text-muted-foreground">
            Demandas da esteira e tarefas num quadro só. Arrastar uma demanda move a etapa dela na esteira.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setRecorrentesAberto(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-accent text-foreground font-semibold cursor-pointer"
          >
            <Repeat className="w-3.5 h-3.5 text-primary" /> Recorrentes
          </button>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card font-mono">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" /> {resumo.abertos} em aberto
          </span>
          {resumo.atrasados > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive-soft text-destructive font-mono font-bold">
              <AlertCircle className="w-3.5 h-3.5" /> {resumo.atrasados} atrasado{resumo.atrasados > 1 ? 's' : ''}
            </span>
          )}
          {resumo.aguardando > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning-soft text-warning font-mono">
              <Hourglass className="w-3.5 h-3.5" /> {resumo.aguardando} aguardando
            </span>
          )}
          {resumo.minutos > 0 && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card font-mono"
              title="Soma das estimativas das tarefas em aberto"
            >
              <Timer className="w-3.5 h-3.5 text-muted-foreground" /> ~{formatarEstimativa(resumo.minutos)}
            </span>
          )}
        </div>
      </div>

      {/* Quick add */}
      <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs">
        <form onSubmit={handleCriarTarefa} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div
              className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border text-xs shrink-0"
              role="radiogroup"
              aria-label="Tipo da tarefa"
            >
              {(Object.keys(TIPO_TAREFA_LABELS) as TipoTarefa[]).map((tipo) => (
                <SegmentedItem
                  key={tipo}
                  type="button"
                  role="radio"
                  aria-checked={novoTipo === tipo}
                  onClick={() => setNovoTipo(tipo)}
                  group="rotina-tab-430"
                  active={novoTipo === tipo}
                  className="px-2.5 py-1.5 rounded-lg font-semibold"
                >
                  {TIPO_TAREFA_LABELS[tipo]}
                </SegmentedItem>
              ))}
            </div>
            <Input
              placeholder={
                novoTipo === 'peca_avulsa'
                  ? 'Ex: Flyer do evento de outubro, capa do Facebook…'
                  : novoTipo === 'sub_tarefa'
                    ? 'Ex: Pedir fotos pro cliente, ajustar legenda…'
                    : 'Ex: Emitir nota do Dr. Paulo, fechar relatório do mês…'
              }
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              className="h-10 text-xs flex-1 rounded-xl"
              aria-label="Título da tarefa"
              required
            />
            <Button type="submit" variant="primary" size="sm" loading={criando} className="rounded-xl shadow-xs shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {novoTipo === 'sub_tarefa' ? (
              <Select
                value={novaDemandaId}
                onChange={(e) => setNovaDemandaId(e.target.value)}
                className="h-8 text-xs w-64 rounded-lg"
                aria-label="Demanda"
              >
                <option value="">Escolha a demanda…</option>
                {demandasAbertas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.cliente?.nome ? `${d.cliente.nome} · ` : ''}
                    {d.titulo || 'Demanda sem título'}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={novoClienteId}
                onChange={(e) => setNovoClienteId(e.target.value)}
                className="h-8 text-xs w-44 rounded-lg"
                aria-label="Cliente"
              >
                <option value="">{novoTipo === 'interno' ? 'Agência (sem cliente)' : 'Sem cliente cadastrado'}</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            )}

            {novoTipo === 'peca_avulsa' && !novoClienteId && (
              <Input
                placeholder="Quem pediu? (nome/empresa)"
                value={novoSolicitante}
                onChange={(e) => setNovoSolicitante(e.target.value)}
                className="h-8 text-xs w-52 rounded-lg"
                aria-label="Solicitante"
              />
            )}

            {ehMaster && (
              <Select
                value={novoResponsavelId}
                onChange={(e) => setNovoResponsavelId(e.target.value)}
                className="h-8 text-xs w-40 rounded-lg"
                aria-label="Responsável"
              >
                <option value="">{verDe && verDe !== 'all' ? `Para ${nomeMembro(verDe) || 'este membro'}` : 'Para mim'}</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            )}

            <Select
              value={novaPrioridade}
              onChange={(e) => setNovaPrioridade(e.target.value as PrioridadeTarefa)}
              className="h-8 text-xs w-28 rounded-lg"
              aria-label="Prioridade"
            >
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>

            <Input
              type="date"
              value={novoPrazo}
              onChange={(e) => setNovoPrazo(e.target.value)}
              className="h-8 text-xs w-36 rounded-lg"
              aria-label="Prazo"
            />

            <Select
              value={novaEstimativa}
              onChange={(e) => setNovaEstimativa(e.target.value)}
              className="h-8 text-xs w-36 rounded-lg"
              aria-label="Estimativa de tempo"
            >
              {ESTIMATIVAS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {ehMaster && (
          <Select
            value={verDe}
            onChange={(e) => {
              setCarregando(true);
              setVerDe(e.target.value);
            }} className="h-8 text-xs w-44 rounded-xl" aria-label="Ver quadro de">
            <option value="">Meu quadro</option>
            <option value="all">Toda a equipe</option>
            {membros
              .filter((m) => m.id !== eu?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
          </Select>
        )}
        <div className="relative w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-8 text-xs rounded-xl"
            aria-label="Buscar"
          />
        </div>
        <Select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as FiltroTipo)}
          className="h-8 text-xs w-40 rounded-xl"
          aria-label="Filtrar por tipo"
        >
          <option value="todos">Tudo</option>
          <option value="demandas">Só demandas</option>
          <option value="interno">Internas</option>
          <option value="peca_avulsa">Peças avulsas</option>
          <option value="sub_tarefa">Sub-tarefas</option>
        </Select>
        <Select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="h-8 text-xs w-44 rounded-xl"
          aria-label="Filtrar por cliente"
        >
          <option value="all">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </div>

      {/* Quadro */}
      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {COLUNAS_ROTINA.map((c) => (
            <Card key={c.id} className="h-64 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : cards.length === 0 && !busca && tipoFiltro === 'todos' && clienteFiltro === 'all' ? (
        <EmptyState
          icon={CheckSquare}
          title="Quadro vazio"
          description="Nenhuma demanda atribuída e nenhuma tarefa por aqui. Adicione um afazer acima."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {COLUNAS_ROTINA.map((coluna) => {
            const itens = porColuna[coluna.id];
            return (
              <section
                key={coluna.id}
                aria-label={coluna.label}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (colunaSobre !== coluna.id) setColunaSobre(coluna.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setColunaSobre((atual) => (atual === coluna.id ? null : atual));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setColunaSobre(null);
                  const chave = e.dataTransfer.getData('text/plain');
                  const card = cards.find((c) => `${c.kind}:${c.id}` === chave);
                  if (card) moverCard(card, coluna.id);
                }}
                className={`flex flex-col gap-2 rounded-2xl border p-2.5 min-h-40 transition-colors ${
                  colunaSobre === coluna.id ? 'border-primary bg-accent/50' : 'border-border bg-accent/20'
                }`}
              >
                <header className="flex items-center justify-between gap-2 px-1 pt-0.5">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">{coluna.label}</h3>
                    <span className="text-xs font-mono text-muted-foreground">{itens.length}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">{coluna.descricao}</span>
                </header>

                {itens.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nada aqui.</p>}

                {itens.map((card) =>
                  card.kind === 'tarefa' ? (
                    <TarefaCard
                      key={`t-${card.id}:${card.tarefa.aguardando_de ?? ''}`}
                      card={card}
                      mostrarResponsavel={alvo === 'all'}
                      etapasMenu={etapasMenu}
                      onMover={(destino) => moverCard(card, destino)}
                      onEditar={() => setEditando(card.tarefa)}
                      onExcluir={() => handleExcluir(card.tarefa)}
                      onAguardandoDe={(v) => salvarAguardandoDe(card.tarefa, v)}
                      onAbrirDemanda={onAbrirDemanda}
                    />
                  ) : (
                    <DemandaCard
                      key={`d-${card.id}`}
                      card={card}
                      sub={subTarefasPorDemanda.get(card.id) || null}
                      responsavel={alvo === 'all' ? nomeMembro(card.demanda.responsavel_id) : null}
                      etapasMenu={etapasMenu}
                      onMover={(destino) => moverCard(card, destino)}
                      onAbrirDemanda={onAbrirDemanda}
                    />
                  )
                )}
              </section>
            );
          })}
        </div>
      )}

      <EditarTarefaSheet
        key={editando?.id || 'nenhuma'}
        tarefa={editando}
        clientes={clientes}
        membros={membros}
        podeReatribuir={ehMaster || editando?.responsavel_id === eu?.id}
        onClose={() => setEditando(null)}
        onSalvar={salvarEdicao}
        onPromover={promoverTarefa}
      />

      <RotinaRecorrentesSheet
        aberto={recorrentesAberto}
        onClose={() => setRecorrentesAberto(false)}
        clientes={clientes}
        membros={membros}
        ehMaster={ehMaster}
        showToast={showToast}
        onMudou={() => {
          setCarregando(true);
          setVersaoQuadro((v) => v + 1);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function inicioDrag(e: React.DragEvent, chave: string) {
  e.dataTransfer.setData('text/plain', chave);
  e.dataTransfer.effectAllowed = 'move';
}

function PrazoChip({ prazo, atrasado }: { prazo: string | null; atrasado: boolean }) {
  if (!prazo) return null;
  return (
    <span className={`flex items-center gap-1 font-mono ${atrasado ? 'text-destructive font-bold' : ''}`}>
      <Clock className="w-3 h-3" /> {formatarData(prazo)}
      {atrasado && <span className="sr-only">(atrasado)</span>}
    </span>
  );
}

function TarefaCard({
  card,
  mostrarResponsavel,
  etapasMenu,
  onMover,
  onEditar,
  onExcluir,
  onAguardandoDe,
  onAbrirDemanda,
}: {
  card: Extract<QuadroCard, { kind: 'tarefa' }>;
  mostrarResponsavel: boolean;
  etapasMenu: { status: StatusTarefa; label: string }[];
  onMover: (destino: StatusTarefa) => void;
  onEditar: () => void;
  onExcluir: () => void;
  onAguardandoDe: (valor: string) => void;
  onAbrirDemanda?: (id: string) => void;
}) {
  const t = card.tarefa;
  const prio = PRIORIDADE_LABELS[t.prioridade] || PRIORIDADE_LABELS.normal;
  const concluida = card.coluna === 'concluido';
  // O card é remontado (key) quando aguardando_de muda no servidor.
  const [aguardandoDe, setAguardandoDe] = useState(t.aguardando_de || '');

  return (
    <article
      draggable
      onDragStart={(e) => inicioDrag(e, `tarefa:${t.id}`)}
      className={`group relative rounded-xl border bg-card p-3 shadow-2xs cursor-grab active:cursor-grabbing hover:border-border-strong transition-colors ${
        card.atrasado ? 'border-destructive/50' : 'border-border'
      } ${concluida ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onEditar}
          className={`text-left text-xs font-semibold text-foreground leading-snug hover:underline cursor-pointer ${
            concluida ? 'line-through text-muted-foreground' : ''
          }`}
        >
          {t.titulo}
        </button>
        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          <MoverEtapaMenu etapas={etapasMenu} atual={card.coluna} onMover={onMover} />
          <button
            type="button"
            onClick={onExcluir}
            className="grid place-items-center size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            aria-label="Excluir tarefa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <Badge variant={t.tipo === 'peca_avulsa' ? 'brand' : 'muted'} className="text-[11px]">
          {TIPO_TAREFA_LABELS[t.tipo] || 'Interno'}
        </Badge>
        {t.recorrencia_id && (
          <span className="flex items-center" title="Tarefa recorrente">
            <Repeat className="w-3 h-3" aria-label="Recorrente" />
          </span>
        )}
        {t.prioridade !== 'normal' && (
          <Badge variant={prio.variant} className="text-[11px] font-bold">
            {prio.label}
          </Badge>
        )}
        {t.cliente ? (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <ClienteAvatar nome={t.cliente.nome} cor={t.cliente.cor} tamanho="xs" />
            <span className="truncate max-w-[110px]">{t.cliente.nome}</span>
          </span>
        ) : t.solicitante ? (
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> {t.solicitante}
          </span>
        ) : null}
        <PrazoChip prazo={t.prazo} atrasado={card.atrasado} />
        {t.estimativa_min ? (
          <span className="flex items-center gap-1 font-mono">
            <Timer className="w-3 h-3" /> {formatarEstimativa(t.estimativa_min)}
          </span>
        ) : null}
        {mostrarResponsavel && t.responsavel && (
          <span className="flex items-center gap-1.5">
            <Avatar nome={t.responsavel.nome} size="xs" className="ring-1" /> {t.responsavel.nome}
          </span>
        )}
      </div>

      {t.demanda && (
        <button
          type="button"
          onClick={() => onAbrirDemanda?.(t.demanda!.id)}
          className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer text-left"
        >
          <ArrowUpRight className="w-3 h-3 shrink-0" /> {t.demanda.titulo || 'Demanda'} · {STATUS_LABELS[t.demanda.status]?.label}
        </button>
      )}

      {card.coluna === 'aguardando' && (
        <div className="mt-2 flex items-center gap-1.5">
          <Hourglass className="w-3 h-3 text-warning shrink-0" />
          <input
            value={aguardandoDe}
            onChange={(e) => setAguardandoDe(e.target.value)}
            onBlur={() => onAguardandoDe(aguardandoDe)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            placeholder="Aguardando quem?"
            aria-label="Aguardando quem"
            className="flex-1 min-w-0 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground border-b border-dashed border-border focus:border-primary focus:outline-none py-0.5"
          />
        </div>
      )}
    </article>
  );
}

function DemandaCard({
  card,
  sub,
  responsavel,
  etapasMenu,
  onMover,
  onAbrirDemanda,
}: {
  card: Extract<QuadroCard, { kind: 'demanda' }>;
  sub: { total: number; abertas: number } | null;
  responsavel: string | null;
  etapasMenu: { status: StatusTarefa; label: string }[];
  onMover: (destino: StatusTarefa) => void;
  onAbrirDemanda?: (id: string) => void;
}) {
  const d = card.demanda;
  const etapa = STATUS_LABELS[d.status as StatusConteudo];
  const publicada = d.status === 'publicado';

  return (
    <article
      draggable={!publicada}
      onDragStart={(e) => inicioDrag(e, `demanda:${d.id}`)}
      className={`group rounded-xl border bg-card p-3 shadow-2xs border-l-4 ${
        publicada ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'
      } ${card.atrasado ? 'border-destructive/50' : 'border-border'}`}
      style={{ borderLeftColor: d.cliente?.cor || undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onAbrirDemanda?.(d.id)}
          className="text-left text-xs font-semibold text-foreground leading-snug hover:underline cursor-pointer"
        >
          {d.titulo || 'Demanda sem título'}
        </button>
        {!publicada && (
          <div className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
            <MoverEtapaMenu etapas={etapasMenu.filter((e) => e.status !== 'concluido')} atual={card.coluna} onMover={onMover} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <Badge variant={etapa?.variant || 'muted'} className="text-[11px]">
          Demanda · {etapa?.label}
        </Badge>
        <span className="uppercase font-mono text-[11px]">{d.tipo}</span>
        {d.cliente && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <ClienteAvatar nome={d.cliente.nome} cor={d.cliente.cor} tamanho="xs" />
            <span className="truncate max-w-[110px]">{d.cliente.nome}</span>
          </span>
        )}
        <PrazoChip prazo={card.prazo} atrasado={card.atrasado} />
        {responsavel && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {responsavel}
          </span>
        )}
        {sub && (
          <span className="flex items-center gap-1 font-mono" title="Sub-tarefas concluídas / total">
            <CheckSquare className="w-3 h-3" /> {sub.total - sub.abertas}/{sub.total}
          </span>
        )}
      </div>
    </article>
  );
}

function EditarTarefaSheet({
  tarefa,
  clientes,
  membros,
  podeReatribuir,
  onClose,
  onSalvar,
  onPromover,
}: {
  tarefa: TarefaRotina | null;
  clientes: Cliente[];
  membros: MembroEquipe[];
  podeReatribuir: boolean;
  onClose: () => void;
  onSalvar: (t: TarefaRotina) => Promise<void>;
  onPromover: (t: TarefaRotina, tipo: string, clienteId: string | null) => Promise<void>;
}) {
  // Remontado (key) a cada tarefa aberta, então o rascunho nasce da prop.
  const [rascunho, setRascunho] = useState<TarefaRotina | null>(tarefa);
  const [salvando, setSalvando] = useState(false);

  if (!tarefa || !rascunho) return null;
  const set = <K extends keyof TarefaRotina>(k: K, v: TarefaRotina[K]) => setRascunho((r) => (r ? { ...r, [k]: v } : r));
  const dirty = JSON.stringify(rascunho) !== JSON.stringify(tarefa);

  return (
    <Sheet open={!!tarefa} onClose={onClose} dirty={dirty} aria-label="Editar tarefa">
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!rascunho.titulo.trim()) return;
          setSalvando(true);
          await onSalvar({ ...rascunho, titulo: rascunho.titulo.trim() });
          setSalvando(false);
        }}
      >
        <h3 className="text-base font-bold font-display text-foreground">Editar tarefa</h3>

        <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
          Título
          <Input value={rascunho.titulo} onChange={(e) => set('titulo', e.target.value)} className="h-9 text-xs" required />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
          Descrição
          <Textarea value={rascunho.descricao || ''} onChange={(e) => set('descricao', e.target.value || null)} rows={4} className="text-xs" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Tipo
            <Select
              value={rascunho.tipo}
              onChange={(e) => set('tipo', e.target.value as TipoTarefa)}
              className="h-9 text-xs"
              disabled={!!rascunho.demanda_id}
            >
              <option value="interno">Interno</option>
              <option value="peca_avulsa">Peça avulsa</option>
              {rascunho.demanda_id && <option value="sub_tarefa">Sub-tarefa</option>}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Prioridade
            <Select value={rascunho.prioridade} onChange={(e) => set('prioridade', e.target.value as PrioridadeTarefa)} className="h-9 text-xs">
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Cliente
            <Select
              value={rascunho.cliente_id || ''}
              onChange={(e) => set('cliente_id', e.target.value || null)}
              className="h-9 text-xs"
              disabled={!!rascunho.demanda_id}
            >
              <option value="">Nenhum</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Solicitante
            <Input
              value={rascunho.solicitante || ''}
              onChange={(e) => set('solicitante', e.target.value || null)}
              placeholder="Quem pediu"
              className="h-9 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Prazo
            <Input
              type="date"
              value={rascunho.prazo?.slice(0, 10) || ''}
              onChange={(e) => set('prazo', e.target.value || null)}
              className="h-9 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Estimativa
            <Select
              value={rascunho.estimativa_min ? String(rascunho.estimativa_min) : ''}
              onChange={(e) => set('estimativa_min', e.target.value ? Number(e.target.value) : null)}
              className="h-9 text-xs"
            >
              {ESTIMATIVAS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              {rascunho.estimativa_min && !ESTIMATIVAS.some((o) => o.value === String(rascunho.estimativa_min)) && (
                <option value={String(rascunho.estimativa_min)}>{formatarEstimativa(rascunho.estimativa_min)}</option>
              )}
            </Select>
          </label>

          {podeReatribuir && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground col-span-2">
              Responsável
              <Select
                value={rascunho.responsavel_id || ''}
                onChange={(e) => set('responsavel_id', e.target.value || null)}
                className="h-9 text-xs"
              >
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            </label>
          )}

          {normalizarStatusTarefa(rascunho.status) === 'aguardando' && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground col-span-2">
              Aguardando quem?
              <Input
                value={rascunho.aguardando_de || ''}
                onChange={(e) => set('aguardando_de', e.target.value || null)}
                className="h-9 text-xs"
              />
            </label>
          )}
        </div>

        {!rascunho.demanda_id && rascunho.tipo !== 'sub_tarefa' && (
          <PromoverParaDemanda tarefa={tarefa} clientes={clientes} onPromover={onPromover} />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={salvando} disabled={!dirty}>
            Salvar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** A tarefa cresceu: vira demanda da esteira (entra em Planejamento) e a tarefa é concluída. */
function PromoverParaDemanda({
  tarefa,
  clientes,
  onPromover,
}: {
  tarefa: TarefaRotina;
  clientes: Cliente[];
  onPromover: (t: TarefaRotina, tipo: string, clienteId: string | null) => Promise<void>;
}) {
  const [tipo, setTipo] = useState('avulso');
  const [clienteId, setClienteId] = useState(tarefa.cliente_id || '');
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Rocket className="w-3.5 h-3.5 text-primary" /> Transformar em demanda
      </span>
      <span className="text-[11px] text-muted-foreground">
        Cria a demanda na esteira (em Planejamento) com este título, descrição, prazo e responsável, e conclui esta tarefa.
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="h-8 text-xs w-44" aria-label="Cliente da demanda">
          <option value="">Escolha o cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-8 text-xs w-32" aria-label="Formato da demanda">
          <option value="avulso">Avulso</option>
          <option value="post">Post</option>
          <option value="reel">Reels</option>
          <option value="story">Story</option>
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={enviando}
          disabled={!clienteId}
          onClick={async () => {
            setEnviando(true);
            await onPromover(tarefa, tipo, clienteId || null);
            setEnviando(false);
          }}
        >
          Criar demanda
        </Button>
      </div>
    </div>
  );
}
