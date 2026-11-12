'use client';
import { FilterBar } from '@/components/ui/filter-bar';
import { DatePicker } from '@/components/ui/date-picker';
import { HeroGradientPanel, HeroKpiCard } from '@/components/ui/hero-gradient-panel';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Search,
  Video,
  Image as ImageIcon,
  Smartphone,
  Sparkles,
  Clock,
  Send,
  User,
  CheckCircle2,
  ExternalLink,
  X,
  FileText,
  Paperclip,
  Share2,
  Edit2,
  Plus,
  List,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Avatar } from '@/components/ui/avatar';
import { STATUS_LABELS, type ConteudoItem, type StatusConteudo, type PrefillAgendamento, gerarLinkWhatsAppAprovacao, ehResponsavel, paraInputData, deInputData, dataLocal, horaLocal } from '@/lib/conteudo';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';

interface CalendarioGeralProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  onAbrirDemanda?: (itemId: string) => void;
  onIrParaAgendamento?: (prefill: PrefillAgendamento) => void;
}

interface DiaCalendario {
  dia: number | null;
  dataStr: string;
  itens: ConteudoItem[];
  nomeDia?: string;
}

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

type StatusFiltroCalendario = 'todos' | 'prontos' | 'aprovacao' | 'producao' | 'publicado';

function matchStatusFiltro(status: string, filtro: StatusFiltroCalendario): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'prontos') {
    return status === 'agendamento' || status === 'pronto_publicar' || status === 'revisao_agendamento';
  }
  if (filtro === 'aprovacao') return status === 'revisao_cliente';
  if (filtro === 'publicado') return status === 'publicado';
  return (
    status !== 'agendamento' &&
    status !== 'pronto_publicar' &&
    status !== 'revisao_agendamento' &&
    status !== 'revisao_cliente' &&
    status !== 'publicado'
  );
}

const HORAS_GRADE = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 às 22:00

function getHoraNumero(dataIso?: string | null): number | null {
  if (!dataIso) return null;
  const dt = dataLocal(dataIso);
  if (!dt) return null;
  return dt.getHours();
}

function getStatusPillMeta(status: string) {
  if (status === 'publicado') {
    return {
      label: 'Publicado',
      dot: 'bg-emerald-500',
      barColor: 'bg-emerald-500',
      cardTint: 'bg-emerald-500/8 border-emerald-500/25 hover:bg-emerald-500/14',
      pill: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    };
  }
  if (status === 'agendamento' || status === 'pronto_publicar' || status === 'revisao_agendamento') {
    return {
      label: status === 'agendamento' ? 'Agendado' : 'Pronto',
      dot: 'bg-sky-500',
      barColor: 'bg-sky-500',
      cardTint: 'bg-sky-500/8 border-sky-500/25 hover:bg-sky-500/14',
      pill: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    };
  }
  if (status === 'revisao_cliente') {
    return {
      label: 'Aprovação',
      dot: 'bg-amber-500',
      barColor: 'bg-amber-500',
      cardTint: 'bg-amber-500/8 border-amber-500/25 hover:bg-amber-500/14',
      pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }
  return {
    label: STATUS_LABELS[status as StatusConteudo]?.label || 'Produção',
    dot: 'bg-violet-500',
    barColor: 'bg-violet-500',
    cardTint: 'bg-violet-500/8 border-violet-500/25 hover:bg-violet-500/14',
    pill: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  };
}

export default function CalendarioGeral({
  showToast,
  onAbrirDemanda,
  onIrParaAgendamento,
}: CalendarioGeralProps) {
  const [items, setItems] = useState<ConteudoItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Mês ativo no calendário (ano e mês base 0)
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());
  const [diaSelecionado, setDiaSelecionado] = useState(hoje.getDate());
  const [viewMode, setViewMode] = useState<'mes' | 'semana' | 'dia' | 'linha_tempo'>('mes');

  function agendarParaData(dataYmd: string, hora = '10:00') {
    if (!onIrParaAgendamento) return;
    onIrParaAgendamento({
      conteudoId: '',
      clienteNome: '',
      instagramUserId: null,
      kind: 'post',
      mediaUrls: [],
      caption: '',
      scheduledAt: `${dataYmd}T${hora}`,
      titulo: '',
    });
  }

  // Filtros
  const [clienteFiltro, setClienteFiltro] = useState('all');
  const [responsavelFiltro, setResponsavelFiltro] = useState('all');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroCalendario>('todos');
  const [itemModal, setItemModal] = useState<ConteudoItem | null>(null);
  const [busca, setBusca] = useState('');
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [diaAlvo, setDiaAlvo] = useState<string | null>(null);

  const mesReferenciaString = useMemo(() => {
    return `${ano}-${String(mesIndex + 1).padStart(2, '0')}-01`;
  }, [ano, mesIndex]);

  const nomeMes = useMemo(() => {
    return new Date(ano, mesIndex, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [ano, mesIndex]);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [resConteudo, resClientes, resEquipe] = await Promise.all([
        fetch(`/api/conteudo?mes=${mesReferenciaString}`),
        fetch('/api/clientes'),
        fetch('/api/equipe').catch(() => ({ ok: false, json: async () => ({}) })),
      ]);

      const dataCont = await resConteudo.json();
      const dataCli = await resClientes.json();
      const dataEq = resEquipe.ok ? await resEquipe.json() : { membros: [] };

      if (resConteudo.ok && dataCont.items) setItems(dataCont.items);
      if (resClientes.ok && dataCli.clientes) setClientes(dataCli.clientes);
      if (dataEq.membros) setMembros(dataEq.membros);
    } catch {
      showToast('Erro ao carregar calendário da agência.', 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [mesReferenciaString]);

  function mudarMes(delta: number) {
    let novoMes = mesIndex + delta;
    let novoAno = ano;
    if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    } else if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    }
    setMesIndex(novoMes);
    setAno(novoAno);
  }

  function irParaHoje() {
    setAno(hoje.getFullYear());
    setMesIndex(hoje.getMonth());
    setDiaSelecionado(hoje.getDate());
  }

  // Itens filtrados por cliente, equipe e busca (base para os contadores do Hero)
  const itemsBaseFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (clienteFiltro !== 'all' && item.cliente_id !== clienteFiltro) return false;
      if (responsavelFiltro !== 'all' && !ehResponsavel(item, responsavelFiltro)) return false;
      if (busca.trim()) {
        const termo = normalizar(busca);
        const alvo = normalizar(`${item.titulo || ''} ${item.legenda || ''} ${item.cliente?.nome || ''}`);
        if (!termo.split(/\s+/).every((t) => alvo.includes(t))) return false;
      }
      return true;
    });
  }, [items, clienteFiltro, responsavelFiltro, busca]);

  const itemsFiltrados = useMemo(() => {
    return itemsBaseFiltrados.filter((item) => matchStatusFiltro(item.status, statusFiltro));
  }, [itemsBaseFiltrados, statusFiltro]);

  /**
   * Muda a data de um post (arrastar no calendário ou "Mudar data"
   * no detalhe). Mantém o horário (ou define 10:00 se não tinha data), atualiza
   * na hora e oferece Desfazer.
   */
  async function reagendar(item: ConteudoItem, novaData: string, novaHora?: string) {
    const campo: 'data_programada' | 'prazo' = item.data_programada || !item.prazo ? 'data_programada' : 'prazo';
    const anterior = item[campo] ?? null;
    if (!novaHora && anterior && paraInputData(anterior) === novaData) return;
    const novoValor = novaHora
      ? `${novaData}T${novaHora}:00`
      : anterior
      ? deInputData(novaData, anterior)!
      : `${novaData}T10:00:00`;

    const aplicar = (valor: string | null) =>
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, [campo]: valor } : it)));
    const salvar = async (valor: string | null) => {
      const res = await fetch(`/api/conteudo/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Tente novamente.');
    };

    aplicar(novoValor);
    setItemModal((m) => (m && m.id === item.id ? { ...m, [campo]: novoValor } : m));
    try {
      await salvar(novoValor);
      const rotulo = new Date(`${novaData}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      toast.undo(`Reagendado para ${rotulo}`, async () => {
        aplicar(anterior);
        setItemModal((m) => (m && m.id === item.id ? { ...m, [campo]: anterior } : m));
        try {
          await salvar(anterior);
        } catch {
          toast.error('Não foi possível desfazer', { description: 'Recarregue o calendário para ver a data atual.' });
        }
      }, { description: item.titulo || undefined });
    } catch (err) {
      aplicar(anterior);
      toast.error('Não foi possível reagendar', { description: err instanceof Error ? err.message : undefined });
    }
  }

  // Montagem da grade do calendário (dias do mês)
  const diasDoCalendario = useMemo<DiaCalendario[]>(() => {
    const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay(); // 0 = domingo
    const totalDiasMes = new Date(ano, mesIndex + 1, 0).getDate();

    const dias: DiaCalendario[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      dias.push({ dia: null, dataStr: '', itens: [] });
    }
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const itensDoDia = itemsFiltrados.filter((it) => {
        if (!it.data_programada && !it.prazo) return false;
        const dataAlvo = it.data_programada || it.prazo;
        return paraInputData(dataAlvo) === dataStr;
      });
      dias.push({ dia: d, dataStr, itens: itensDoDia });
    }
    return dias;
  }, [ano, mesIndex, itemsFiltrados]);

  // Dias filtrados por modo de exibição (mês vs semana vs dia)
  const diasExibicao = useMemo<DiaCalendario[]>(() => {
    if (viewMode === 'mes') {
      return diasDoCalendario;
    }

    if (viewMode === 'semana') {
      const diaAlvo = Math.min(diaSelecionado, new Date(ano, mesIndex + 1, 0).getDate());
      const dataAlvo = new Date(ano, mesIndex, diaAlvo);
      const diaDaSemana = dataAlvo.getDay(); // 0 (dom) a 6 (sáb)
      
      const inicioSemana = new Date(dataAlvo);
      inicioSemana.setDate(dataAlvo.getDate() - diaDaSemana);

      const diasSemana: DiaCalendario[] = [];
      for (let i = 0; i < 7; i++) {
        const curr = new Date(inicioSemana);
        curr.setDate(inicioSemana.getDate() + i);
        const dataStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
        
        const itensDoDia = itemsFiltrados.filter((it) => {
          if (!it.data_programada && !it.prazo) return false;
          const dataAlvoStr = it.data_programada || it.prazo;
          return paraInputData(dataAlvoStr) === dataStr;
        });

        diasSemana.push({
          dia: curr.getDate(),
          dataStr,
          itens: itensDoDia,
          nomeDia: curr.toLocaleDateString('pt-BR', { weekday: 'short' }),
        });
      }
      return diasSemana;
    }

    // Modo dia único
    const diaAlvo = Math.min(diaSelecionado, new Date(ano, mesIndex + 1, 0).getDate());
    const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(diaAlvo).padStart(2, '0')}`;
    const itensDoDia = itemsFiltrados.filter((it) => {
      if (!it.data_programada && !it.prazo) return false;
      const dataAlvoStr = it.data_programada || it.prazo;
      return paraInputData(dataAlvoStr) === dataStr;
    });

    return [{
      dia: diaAlvo,
      dataStr,
      itens: itensDoDia,
      nomeDia: new Date(ano, mesIndex, diaAlvo).toLocaleDateString('pt-BR', { weekday: 'long' }),
    }];
  }, [viewMode, diasDoCalendario, diaSelecionado, ano, mesIndex, itemsFiltrados]);

  // Função auxiliar para badge de formato
  const getFormatBadge = (tipo: string) => {
    switch (tipo) {
      case 'reel':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-destructive-soft text-destructive border border-destructive-ring">
            <Video className="w-3 h-3" />
            Reels
          </span>
        );
      case 'story':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-info-soft text-info border border-info-ring">
            <Smartphone className="w-3 h-3" />
            Story
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-success-soft text-success border border-success-ring">
            <ImageIcon className="w-3 h-3" />
            Carrossel / Post
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* 0. Painel Hero Gradient do Calendário */}
      <HeroGradientPanel
        eyebrow="Cronograma Editorial"
        title="Calendário de Publicações"
        badge={`${itemsBaseFiltrados.length} ${itemsBaseFiltrados.length === 1 ? 'postagem' : 'postagens'} no mês`}
        badgeIcon={CalendarIcon}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <HeroKpiCard
            label="Agendadas / Prontas"
            icon={CalendarIcon}
            iconTone="sky"
            value={itemsBaseFiltrados.filter((it) => matchStatusFiltro(it.status, 'prontos')).length}
            hint={statusFiltro === 'prontos' ? 'Filtro ativo · clique para limpar' : 'Clique para filtrar prontas'}
            onClick={() => setStatusFiltro((s) => (s === 'prontos' ? 'todos' : 'prontos'))}
            active={statusFiltro === 'prontos'}
          />
          <HeroKpiCard
            label="Aguardando Aprovação"
            icon={Clock}
            iconTone="amber"
            value={itemsBaseFiltrados.filter((it) => it.status === 'revisao_cliente').length}
            hint={statusFiltro === 'aprovacao' ? 'Filtro ativo · clique para limpar' : 'Clique para filtrar aprovação'}
            onClick={() => setStatusFiltro((s) => (s === 'aprovacao' ? 'todos' : 'aprovacao'))}
            active={statusFiltro === 'aprovacao'}
          />
          <HeroKpiCard
            label="Publicadas"
            icon={CheckCircle2}
            iconTone="emerald"
            valueTone="success"
            value={itemsBaseFiltrados.filter((it) => it.status === 'publicado').length}
            hint={statusFiltro === 'publicado' ? 'Filtro ativo · clique para limpar' : 'Clique para filtrar publicadas'}
            onClick={() => setStatusFiltro((s) => (s === 'publicado' ? 'todos' : 'publicado'))}
            active={statusFiltro === 'publicado'}
          />
        </div>
      </HeroGradientPanel>

      {/* 1. Header do Calendário */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="hidden">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">
            Visão Geral da Agência
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight capitalize flex items-center gap-2 mt-0.5">
            <span>Calendário Geral de Publicações</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Acompanhe o cronograma de todos os clientes em um só lugar para prevenir choques de datas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto max-md:w-full max-md:flex-col max-md:items-stretch">
          {/* Alternador de Modo de Exibição */}
          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border max-md:grid max-md:grid-cols-2">
            {(
              [
                { id: 'mes', label: 'Mês' },
                { id: 'semana', label: 'Semana' },
                { id: 'dia', label: 'Dia' },
                { id: 'linha_tempo', label: 'Linha do Tempo' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                className={`px-3 py-1 max-md:h-10 max-md:text-sm rounded-lg text-xs font-bold transition-ui cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                  viewMode === opt.id
                    ? 'bg-secondary text-secondary-foreground border border-primary/40 shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.id === 'linha_tempo' && <List className="w-3.5 h-3.5" />}
                {opt.label}
              </button>
            ))}
          </div>

          {onIrParaAgendamento && (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                agendarParaData(
                  `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`
                )
              }
              className="rounded-xl shadow-xs h-9"
            >
              <Plus className="w-4 h-4" />
              Agendar post
            </Button>
          )}

          {/* Navegação de Mês & Botão Hoje */}
          <div className="flex items-center gap-1.5 bg-accent/60 p-1 rounded-xl border border-border shadow-2xs max-md:w-full max-md:justify-between">
            <button
              type="button"
              onClick={() => mudarMes(-1)}
              className="p-1.5 max-md:size-11 max-md:grid max-md:place-items-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-ui cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={irParaHoje}
              className="px-2.5 py-1 max-md:h-10 max-md:text-sm text-xs font-bold rounded-lg bg-card text-foreground hover:bg-accent border border-border shadow-2xs cursor-pointer"
            >
              Hoje
            </button>

            <span className="text-xs font-bold text-foreground px-2 capitalize font-display min-w-[120px] max-md:min-w-0 max-md:flex-1 text-center">
              {nomeMes}
            </span>

            <button
              type="button"
              onClick={() => mudarMes(1)}
              className="p-1.5 max-md:size-11 max-md:grid max-md:place-items-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-ui cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros + Pílulas de Status */}
      <div className="flex flex-col gap-3">
        <FilterBar
          busca={busca}
          onBusca={setBusca}
          placeholder="Buscar post ou cliente…"
          filtros={[
            { id: 'cliente', rotulo: 'Cliente', valor: clienteFiltro, onChange: setClienteFiltro, opcoes: [{ valor: 'all', rotulo: 'Todos os clientes' }, ...clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))] },
            ...(membros.length > 0
              ? [{ id: 'equipe', rotulo: 'Equipe', valor: responsavelFiltro, onChange: setResponsavelFiltro, opcoes: [{ valor: 'all', rotulo: 'Toda a equipe' }, ...membros.map((m) => ({ valor: m.id, rotulo: m.nome }))] }]
              : []),
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'prontos', label: 'Prontos / Agendados' },
                { id: 'aprovacao', label: 'Aguardando Cliente' },
                { id: 'producao', label: 'Em Produção' },
                { id: 'publicado', label: 'Publicados' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFiltro(pill.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-ui cursor-pointer ${
                  statusFiltro === pill.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/25'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {itemsFiltrados.length} {itemsFiltrados.length === 1 ? 'postagem exibida' : 'postagens exibidas'}
            <span className="max-md:hidden"> · arraste um post para outro dia para reagendar</span>
          </span>
        </div>
      </div>

      {/* 3. Grade do Calendário (Mês / Semana / Dia / Linha do Tempo) */}
      {viewMode === 'linha_tempo' ? (
        <div className="flex flex-col gap-4">
          {diasDoCalendario.filter((d) => d.dia && d.itens.length > 0).length === 0 ? (
            <Card padding="lg" className="rounded-3xl border border-border bg-card text-center py-12 flex flex-col items-center gap-3">
              <CalendarIcon className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-display text-sm font-bold text-foreground">Nenhuma postagem neste mês</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Agende ou programe uma demanda para acompanhar a linha do tempo cronológica por aqui.
                </p>
              </div>
              {onIrParaAgendamento && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    agendarParaData(
                      `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`
                    )
                  }
                  className="rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  Agendar primeira postagem
                </Button>
              )}
            </Card>
          ) : (
            diasDoCalendario
              .filter((d) => d.dia && d.itens.length > 0)
              .map((d) => {
                const dataObj = new Date(ano, mesIndex, d.dia!);
                const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                const eHoje =
                  d.dia === hoje.getDate() &&
                  mesIndex === hoje.getMonth() &&
                  ano === hoje.getFullYear();

                return (
                  <Card key={d.dataStr} padding="none" className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/80 bg-muted/30">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`size-8 rounded-xl font-display font-bold text-sm flex items-center justify-center tabular-nums ${
                            eHoje ? 'bg-primary text-primary-foreground shadow-2xs' : 'bg-card border border-border text-foreground'
                          }`}
                        >
                          {d.dia}
                        </span>
                        <div>
                          <p className="font-display text-sm font-bold text-foreground capitalize">
                            {diaSemana}
                            {eHoje && (
                              <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                                Hoje
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {d.itens.length} {d.itens.length === 1 ? 'postagem programada' : 'postagens programadas'}
                          </p>
                        </div>
                      </div>

                      {onIrParaAgendamento && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => agendarParaData(d.dataStr)}
                          className="rounded-xl text-xs h-8"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agendar neste dia
                        </Button>
                      )}
                    </div>

                    <div className="divide-y divide-border/70">
                      {d.itens.map((item) => {
                        const statusInfo = STATUS_LABELS[item.status as StatusConteudo] || { label: item.status };
                        const horaFormatada = horaLocal(item.data_programada);
                        const capaUrl = item.arquivos?.[0]?.url;

                        return (
                          <div
                            key={item.id}
                            onClick={() => setItemModal(item)}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-accent/25 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {capaUrl ? (
                                <img
                                  src={capaUrl}
                                  alt=""
                                  className="w-12 aspect-[4/5] rounded-xl object-contain border border-border shrink-0 bg-muted/50 p-0.5"
                                />
                              ) : (
                                <div className="w-12 aspect-[4/5] rounded-xl border border-dashed border-border bg-muted/40 flex items-center justify-center shrink-0 text-muted-foreground">
                                  <ImageIcon className="w-4 h-4" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {item.cliente && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                      <ClienteAvatar nome={item.cliente.nome} cor={item.cliente.cor} tamanho="xs" />
                                      <span>{item.cliente.nome}</span>
                                    </span>
                                  )}
                                  {getFormatBadge(item.tipo)}
                                  <Badge variant="muted" className="text-[11px]">
                                    {statusInfo.label}
                                  </Badge>
                                </div>

                                <p className="font-display text-sm font-bold text-foreground truncate mt-1">
                                  {item.titulo || 'Postagem sem título'}
                                </p>

                                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground tabular-nums">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {horaFormatada || 'Sem horário'}
                                  </span>
                                  {item.responsavel && (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {item.responsavel.nome}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              {onAbrirDemanda && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAbrirDemanda(item.id);
                                  }}
                                  className="rounded-xl text-xs h-8"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Demanda
                                </Button>
                              )}
                              {onIrParaAgendamento && (
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onIrParaAgendamento({
                                      conteudoId: item.id,
                                      clienteNome: item.cliente?.nome || 'Cliente',
                                      instagramUserId: (item.cliente as any)?.instagram_accounts?.instagram_username || null,
                                      kind: item.tipo === 'reel' ? 'reels' : item.tipo === 'story' ? 'story' : 'post',
                                      mediaUrls: item.arquivos?.map((a) => a.url) || [],
                                      caption: item.legenda || '',
                                      scheduledAt: item.data_programada || `${d.dataStr}T10:00`,
                                      titulo: item.titulo || 'Publicação',
                                    });
                                  }}
                                  className="rounded-xl text-xs h-8"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Agendar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })
          )}
        </div>
      ) : viewMode === 'semana' ? (
        /* Modo Semana: Grade Horária Real (07:00 às 22:00) inspirada nas referências */
        <Card padding="none" className="rounded-3xl border border-border overflow-hidden shadow-xs bg-card">
          <AgendaCelular dias={diasExibicao} onAbrir={setItemModal} />
          <div className="hidden sm:flex flex-col overflow-x-auto">
            {/* Cabeçalho da Semana: Eixo + 7 Dias */}
            <div className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] border-b border-border bg-muted/30">
              <div className="py-3 px-2 text-[11px] font-semibold text-muted-foreground text-center border-r border-border flex items-center justify-center">
                Horário
              </div>
              {diasExibicao.map((d) => {
                const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
                const eHoje = d.dataStr === hojeStr;
                return (
                  <div
                    key={d.dataStr}
                    className={`py-2.5 px-2 text-center border-r border-border last:border-r-0 flex flex-col items-center gap-1 ${
                      eHoje ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {d.nomeDia}
                    </span>
                    <span
                      className={`font-display text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full ${
                        eHoje ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-foreground'
                      }`}
                    >
                      {d.dia}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Faixa superior: Sem horário definido */}
            {diasExibicao.some((d) => d.itens.some((it) => getHoraNumero(it.data_programada) === null)) && (
              <div className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] border-b border-border bg-muted/15">
                <div className="p-2 text-[10px] font-semibold text-muted-foreground text-center border-r border-border flex items-center justify-center">
                  Dia todo
                </div>
                {diasExibicao.map((d) => {
                  const semHora = d.itens.filter((it) => getHoraNumero(it.data_programada) === null);
                  return (
                    <div key={`all-${d.dataStr}`} className="p-1.5 border-r border-border last:border-r-0 flex flex-col gap-1.5">
                      {semHora.map((item) => (
                        <CardPostCalendario
                          key={item.id}
                          item={item}
                          arrastando={arrastandoId === item.id}
                          onDragStart={(e) => {
                            setArrastandoId(item.id);
                            e.dataTransfer.setData('text/plain', item.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setArrastandoId(null);
                            setDiaAlvo(null);
                          }}
                          onClick={() => setItemModal(item)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Linhas de Horário (07:00 às 22:00) */}
            <div className="divide-y divide-border/70">
              {HORAS_GRADE.map((hora) => {
                const horaLabel = `${String(hora).padStart(2, '0')}:00`;
                const horaAtual = hoje.getHours();
                const minutoAtual = hoje.getMinutes();
                const mostrarLinhaAgora = hora === horaAtual;

                return (
                  <div
                    key={hora}
                    className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] min-h-[78px] relative"
                  >
                    {/* Coluna da Hora */}
                    <div className="px-2 py-2 text-[11px] font-semibold text-muted-foreground tabular-nums text-right border-r border-border bg-muted/15">
                      {horaLabel}
                    </div>

                    {/* 7 Dias neste Horário */}
                    {diasExibicao.map((d) => {
                      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
                      const eHoje = d.dataStr === hojeStr;
                      const slotKey = `${d.dataStr}@${horaLabel}`;
                      const itensHora = d.itens.filter((it) => {
                        const h = getHoraNumero(it.data_programada);
                        if (h === null) return false;
                        if (hora === 7 && h < 7) return true;
                        if (hora === 22 && h > 22) return true;
                        return h === hora;
                      });

                      return (
                        <div
                          key={slotKey}
                          onDragOver={(e) => {
                            if (!arrastandoId) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (diaAlvo !== slotKey) setDiaAlvo(slotKey);
                          }}
                          onDragLeave={() => diaAlvo === slotKey && setDiaAlvo(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/plain') || arrastandoId;
                            const it = items.find((x) => x.id === id);
                            setArrastandoId(null);
                            setDiaAlvo(null);
                            if (it) reagendar(it, d.dataStr, horaLabel);
                          }}
                          className={`group relative p-1.5 border-r border-border last:border-r-0 flex flex-col gap-1.5 transition-colors ${
                            diaAlvo === slotKey
                              ? 'bg-primary/15 ring-2 ring-inset ring-primary/50'
                              : eHoje
                              ? 'bg-primary/[0.03]'
                              : 'hover:bg-accent/20'
                          }`}
                        >
                          {/* Linha do Horário Atual */}
                          {eHoje && mostrarLinhaAgora && (
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                              style={{ top: `${Math.min(90, Math.round((minutoAtual / 60) * 100))}%` }}
                            >
                              <span className="size-2 rounded-full bg-primary -ml-1 shadow-xs" />
                              <span className="h-[2px] flex-1 bg-primary/80" />
                            </div>
                          )}

                          {itensHora.map((item) => (
                            <CardPostCalendario
                              key={item.id}
                              item={item}
                              fallbackHora={horaLabel}
                              arrastando={arrastandoId === item.id}
                              onDragStart={(e) => {
                                setArrastandoId(item.id);
                                e.dataTransfer.setData('text/plain', item.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={() => {
                                setArrastandoId(null);
                                setDiaAlvo(null);
                              }}
                              onClick={() => setItemModal(item)}
                            />
                          ))}

                          {/* Botão rápido de agendar no slot vazio */}
                          {onIrParaAgendamento && itensHora.length === 0 && (
                            <button
                              type="button"
                              onClick={() => agendarParaData(d.dataStr, horaLabel)}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 m-auto px-2 py-1 rounded-lg bg-primary/12 text-primary hover:bg-primary hover:text-primary-foreground text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              {horaLabel}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : (
      <Card padding="none" className="rounded-3xl border border-border overflow-hidden shadow-xs bg-card">
        {viewMode !== 'dia' && (
          <div className="hidden sm:grid grid-cols-7 border-b border-border bg-muted/40 text-center py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>
        )}

        {/* Células em modo Mês */}
        {viewMode !== 'dia' ? (
          <>
          <AgendaCelular dias={diasExibicao} onAbrir={setItemModal} />
          <div className="hidden sm:grid grid-cols-7 divide-x divide-y divide-border bg-card">
            {diasExibicao.map((d, idx) => {
              if (d.dia === null) {
                return <div key={`empty-${idx}`} className="bg-accent/10 min-h-[120px]" />;
              }

              const temChoque = d.itens.length >= 3;
              const eHoje = d.dia === hoje.getDate() && mesIndex === hoje.getMonth() && ano === hoje.getFullYear();

              return (
                <div
                  key={d.dataStr || `day-${idx}`}
                  onClick={() => setDiaSelecionado(d.dia!)}
                  onDragOver={(e) => {
                    if (!arrastandoId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (diaAlvo !== d.dataStr) setDiaAlvo(d.dataStr);
                  }}
                  onDragLeave={() => diaAlvo === d.dataStr && setDiaAlvo(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain') || arrastandoId;
                    const it = items.find((x) => x.id === id);
                    setArrastandoId(null);
                    setDiaAlvo(null);
                    if (it) reagendar(it, d.dataStr);
                  }}
                  className={`group p-2 min-h-[130px] flex flex-col justify-between transition-colors cursor-pointer ${
                    diaAlvo === d.dataStr
                      ? 'bg-brand-soft ring-2 ring-inset ring-brand-ring'
                      : temChoque ? 'bg-warning/5' : eHoje ? 'bg-primary/10' : 'hover:bg-accent/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-bold font-sans tabular-nums ${
                        eHoje
                          ? 'w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-2xs'
                          : 'text-foreground'
                      }`}
                    >
                      {d.dia}
                    </span>

                    <div className="flex items-center gap-1">
                      {onIrParaAgendamento && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            agendarParaData(d.dataStr);
                          }}
                          title="Agendar postagem neste dia"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 size-5 rounded-md bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      {d.itens.length > 0 && (
                        <span className="text-[11px] font-sans tabular-nums text-muted-foreground font-bold bg-accent px-1.5 py-0.5 rounded-md border border-border">
                          {d.itens.length} {d.itens.length === 1 ? 'post' : 'posts'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lista de Event Blocks no Dia (Mesmo Card Unificado da Semana) */}
                  <div className="flex flex-col gap-1.5 mt-2 flex-1">
                    {d.itens.slice(0, 3).map((item) => (
                      <CardPostCalendario
                        key={item.id}
                        item={item}
                        arrastando={arrastandoId === item.id}
                        onDragStart={(e) => {
                          setArrastandoId(item.id);
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setArrastandoId(null);
                          setDiaAlvo(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemModal(item);
                        }}
                      />
                    ))}

                    {d.itens.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDiaSelecionado(d.dia!);
                          setViewMode('dia');
                        }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground text-center pt-0.5 cursor-pointer"
                      >
                        +{d.itens.length - 3} outros · ver o dia
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        ) : (
          /* Modo Dia Único Detalhado */
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cronograma do Dia</span>
                <h3 className="font-display text-lg font-bold text-foreground capitalize">
                  {diasExibicao[0]?.dia} de {nomeMes} {diasExibicao[0]?.nomeDia ? `(${diasExibicao[0]?.nomeDia})` : ''}
                </h3>
              </div>
              <span className="text-xs font-sans tabular-nums font-bold px-3 py-1 rounded-xl bg-accent text-foreground">
                {diasExibicao[0]?.itens.length || 0} publicações agendadas
              </span>
            </div>

            {diasExibicao[0]?.itens.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs font-medium">
                Nenhuma publicação agendada para este dia.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {diasExibicao[0]?.itens.map((item) => (
                  <CardPostCalendario
                    key={item.id}
                    item={item}
                    draggable={false}
                    onClick={() => setItemModal(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
      )}

      {/* 4. Modal 2 Colunas de Detalhes da Demanda (Trello Style) */}
      <Sheet open={!!itemModal} onClose={() => setItemModal(null)} className="max-w-4xl w-full p-0">
        {itemModal && (
          <div className="flex flex-col max-h-[85dvh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-accent/30">
              <div className="flex items-center gap-3">
                <ClienteAvatar
                  nome={itemModal.cliente?.nome || 'Cliente'}
                  cor={itemModal.cliente?.cor}
                  fotoUrl={itemModal.cliente?.foto_url}
                  tamanho="md"
                />
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    {itemModal.titulo || 'Demanda de Conteúdo'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cliente: <strong className="text-foreground">{itemModal.cliente?.nome}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setItemModal(null)}
                className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Colunas */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border p-6 gap-6">
              {/* Coluna Esquerda (2 spans): Descrição com Tópicos + Arquivos e Anexos */}
              <div className="md:col-span-2 flex flex-col gap-6">
                {/* Visual Cover Header se disponível */}
                {itemModal.arquivos && itemModal.arquivos.length > 0 && (
                  <div className="w-full h-48 rounded-2xl overflow-hidden border border-border relative bg-accent/40">
                    <img src={itemModal.arquivos[0].url} alt="Capa da Postagem" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Descrição & Legenda do Post */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    Descrição / Legenda da Postagem
                  </span>
                  <div className="p-4 rounded-2xl bg-accent/40 border border-border text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                    {itemModal.legenda || itemModal.briefing || 'Nenhuma legenda ou briefing cadastrado para esta demanda.'}
                  </div>
                </div>

                {/* Materiais e Arquivos Anexados */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-primary" />
                    Materiais & Arquivos ({itemModal.arquivos?.length || 0})
                  </span>

                  {itemModal.arquivos && itemModal.arquivos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {itemModal.arquivos.map((arq, i) => (
                        <a
                          key={arq.id || i}
                          href={arq.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative rounded-xl border border-border overflow-hidden bg-accent/50 aspect-square flex flex-col items-center justify-center p-2 text-center hover:border-primary transition-ui"
                        >
                          {arq.tipo === 'imagem' ? (
                            <img src={arq.url} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary">
                              <Video className="w-6 h-6" />
                              <span className="text-xs font-bold truncate max-w-full">Vídeo #{i + 1}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                            <ExternalLink className="w-3.5 h-3.5" /> Ver
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum arquivo anexado.</p>
                  )}
                </div>
              </div>

              {/* Coluna Direita (Fixa): Tags, Datas, Responsáveis e Ações */}
              <div className="flex flex-col gap-5">
                {/* Formato da Postagem */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase font-mono">Formato do Conteúdo</span>
                  <div>{getFormatBadge(itemModal.tipo)}</div>
                </div>

                {/* Status no Kanban */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase font-mono">Status da Esteira</span>
                  <Badge variant="muted" className="w-fit text-xs font-bold border-primary/50 text-primary">
                    {STATUS_LABELS[itemModal.status as StatusConteudo]?.label || itemModal.status}
                  </Badge>
                </div>

                {/* Datas Importantes */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-accent/40 border border-border text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Data de Postagem:</span>
                    <strong className="text-foreground font-mono">
                      {itemModal.data_programada ? `${dataLocal(itemModal.data_programada).toLocaleDateString('pt-BR')}${horaLocal(itemModal.data_programada) ? ` às ${horaLocal(itemModal.data_programada)}` : ''}` : 'Não agendada'}
                    </strong>
                  </div>
                  {(itemModal.data_programada || itemModal.prazo) && (
                    <label className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                      <span className="text-muted-foreground font-medium">Mudar data:</span>
                      <DatePicker
                        value={paraInputData(itemModal.data_programada || itemModal.prazo)}
                        onChange={(e) => e.target.value && reagendar(itemModal, e.target.value)}
                        className="h-8 w-auto rounded-lg px-2 text-xs"
                        aria-label="Mudar data"
                      />
                    </label>
                  )}
                  {itemModal.prazo && (
                    <div className="flex items-center justify-between border-t border-border pt-1.5">
                      <span className="text-muted-foreground font-medium">Prazo Interno:</span>
                      <strong className="text-foreground font-mono">{dataLocal(itemModal.prazo).toLocaleDateString('pt-BR')}</strong>
                    </div>
                  )}
                </div>

                {/* Responsáveis */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase font-mono">Membros Responsáveis</span>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Copy / Redação:</span>
                      <strong className="text-foreground">
                        {[
                          itemModal.responsavel?.nome,
                          ...(itemModal.co_responsaveis_ids ?? []).map((id) => membros.find((m) => m.id === id)?.nome),
                        ]
                          .filter(Boolean)
                          .join(', ') || 'Não atribuído'}
                      </strong>
                    </div>
                    {itemModal.editor && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Designer / Edição:</span>
                        <strong className="text-foreground">{itemModal.editor.nome}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações de Edição, Agendamento e Aprovação */}
                <div className="border-t border-border pt-4 flex flex-col gap-2">
                  {onAbrirDemanda && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = itemModal.id;
                        setItemModal(null);
                        onAbrirDemanda(id);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/80 text-foreground font-bold text-xs transition-ui border border-border cursor-pointer shadow-2xs"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-primary" />
                      <span>Editar Demanda Completa</span>
                    </button>
                  )}

                  {onIrParaAgendamento && (
                    <button
                      type="button"
                      onClick={() => {
                        const prefill: PrefillAgendamento = {
                          conteudoId: itemModal.id,
                          clienteNome: itemModal.cliente?.nome || 'Cliente',
                          instagramUserId: (itemModal.cliente as any)?.instagram_accounts?.instagram_username || null,
                          kind: itemModal.tipo === 'reel' ? 'reels' : itemModal.tipo === 'story' ? 'story' : 'post',
                          mediaUrls: itemModal.arquivos?.map((a) => a.url) || [],
                          caption: itemModal.legenda || '',
                          scheduledAt: itemModal.data_programada || null,
                          titulo: itemModal.titulo || 'Publicação',
                        };
                        setItemModal(null);
                        onIrParaAgendamento(prefill);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-bold text-xs transition-ui cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Abrir no Simulador de Post</span>
                    </button>
                  )}

                  <a
                    href={gerarLinkWhatsAppAprovacao({
                      nomeCliente: itemModal.cliente?.nome || 'Cliente',
                      tituloPost: itemModal.titulo || 'Conteúdo do Mês',
                      token: itemModal.token_aprovacao,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#052e16] font-bold text-xs transition-ui shadow-2xs"
                  >
                    <Share2 className="w-4 h-4" />
                    Enviar para Aprovação (Whats)
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** No celular a grade de 7 colunas não cabe: os dias com post viram uma agenda em lista. */
function CardPostCalendario({
  item,
  fallbackHora,
  arrastando = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  item: ConteudoItem;
  fallbackHora?: string;
  arrastando?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const horaFormatada = horaLocal(item.data_programada) || fallbackHora;
  const capaUrl = item.arquivos?.[0]?.url;
  const statusMeta = getStatusPillMeta(item.status);

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      aria-label={`${item.cliente?.nome || ''}: ${item.titulo || item.tipo}. Abrir detalhes`}
      className={`${arrastando ? 'opacity-50 ' : ''}w-full relative overflow-hidden text-left p-2 rounded-xl border transition-ui flex items-start gap-2 cursor-pointer group/card shadow-2xs ${statusMeta.cardTint}`}
    >
      <span aria-hidden="true" className={`absolute inset-y-1.5 left-1 w-1 rounded-full ${statusMeta.barColor}`} />

      <div className="pl-2 flex items-start gap-2 min-w-0 flex-1">
        {capaUrl ? (
          <div className="w-9 aspect-[4/5] rounded-md overflow-hidden border border-border/70 bg-card/80 shrink-0 flex items-center justify-center">
            <img src={capaUrl} alt="" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-9 aspect-[4/5] rounded-md border border-dashed border-border/80 bg-card/50 shrink-0 flex items-center justify-center text-muted-foreground">
            {item.tipo === 'reel' ? (
              <Video className="w-3.5 h-3.5" />
            ) : item.tipo === 'story' ? (
              <Smartphone className="w-3.5 h-3.5" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground tabular-nums font-semibold">
            <span className="truncate">{item.cliente?.nome}</span>
            {horaFormatada && <span className="shrink-0">{horaFormatada}</span>}
          </div>
          <p className="font-display text-xs font-bold text-foreground line-clamp-2 leading-tight group-hover/card:text-primary transition-colors">
            {item.titulo || item.tipo}
          </p>
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusMeta.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
            {item.responsavel && (
              <Avatar nome={item.responsavel.nome} size="xs" className="shrink-0" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function AgendaCelular({ dias, onAbrir }: { dias: DiaCalendario[]; onAbrir: (item: ConteudoItem) => void }) {
  const comPosts = dias.filter((d) => d.dia !== null && d.itens.length > 0);
  if (comPosts.length === 0) {
    return <p className="sm:hidden px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma publicação neste período.</p>;
  }
  const hojeStr = paraInputData(new Date().toISOString());
  return (
    <ol className="sm:hidden divide-y divide-border">
      {comPosts.map((d) => {
        const data = new Date(`${d.dataStr}T12:00:00`);
        const eHoje = d.dataStr === hojeStr;
        return (
          <li key={d.dataStr} className="px-4 py-3 flex flex-col gap-2">
            <h4 className="flex items-baseline gap-2 text-sm font-semibold text-foreground capitalize">
              {data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
              {eHoje && <Badge variant="brand">Hoje</Badge>}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {d.itens.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onAbrir(item)}
                    className="w-full min-h-11 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-left active:bg-accent cursor-pointer"
                  >
                    <ClienteAvatar nome={item.cliente?.nome || 'Cliente'} cor={item.cliente?.cor} fotoUrl={item.cliente?.foto_url} tamanho="sm" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground truncate">{item.titulo || item.tipo}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {item.cliente?.nome} · {item.tipo}
                      </span>
                    </span>
                    {horaLocal(item.data_programada) && <span className="text-xs text-muted-foreground tabular-nums">{horaLocal(item.data_programada)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
