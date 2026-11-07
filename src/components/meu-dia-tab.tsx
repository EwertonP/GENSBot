'use client';

import { hojeBrasilia } from '@/lib/rotina-recorrencia';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Moon,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  Plus,
  AlertCircle,
  Sparkles,
  Layers,
  MessageCircle,
  ExternalLink,
  FileText,
  CheckSquare,
  Loader2,
  CalendarDays,
  History,
  Target,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { AuditoriaDrawer } from '@/components/auditoria-drawer';

interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  prioridade: string;
  prazo?: string | null;
  cliente?: { id: string; nome: string; cor?: string; foto_url?: string } | null;
  responsavel?: { id: string; nome: string; email: string; cargo?: string } | null;
  demanda?: { id: string; titulo: string; status: string } | null;
}

interface Demanda {
  id: string;
  cliente_id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade?: string | null;
  prazo?: string | null;
  data_programada?: string | null;
  horario?: string | null;
  responsavel_id?: string | null;
  co_responsaveis_ids?: string[] | null;
  editor_id?: string | null;
  midia_urls?: string[] | null;
  cliente?: { id: string; nome: string; cor?: string; foto_url?: string } | null;
  pedido_info?: string | null;
  pedido_info_respondido?: boolean | null;
}

interface MeuDiaTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  usuario?: {
    id?: string;
    nome?: string;
    cargo?: string | null;
    foto_url?: string | null;
    papel: string;
  } | null;
  onNavegarDemanda: (demandaId: string) => void;
  onNavegarTab: (tabId: string) => void;
}

function isTarefaConcluida(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'concluido' || s === 'concluida' || s === 'concluído' || s === 'concluída' || s === 'finalizado' || s === 'finalizada';
}

export function MeuDiaTab({
  showToast,
  usuario,
  onNavegarDemanda,
  onNavegarTab,
}: MeuDiaTabProps) {
  const [carregando, setCarregando] = useState(true);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState('');
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const [auditoriaAberta, setAuditoriaAberta] = useState(false);

  async function carregarDados() {
    try {
      setCarregando(true);
      const [resRotina, resConteudo] = await Promise.all([
        fetch('/api/rotina'),
        fetch('/api/conteudo'),
      ]);

      const dataRotina = await resRotina.json();
      const dataConteudo = await resConteudo.json();

      if (resRotina.ok && dataRotina.tarefas) {
        setTarefas(dataRotina.tarefas);
      }
      if (resConteudo.ok && dataConteudo.items) {
        setDemandas(dataConteudo.items);
      }
    } catch {
      showToast('Erro ao carregar dados do seu dia.', 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  // Saudação de acordo com a hora
  const saudacao = useMemo(() => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const dataExtenso = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Dia de hoje em Brasília (toISOString usa UTC e virava o dia às 21h).
  const hojeIso = useMemo(() => hojeBrasilia(), []);

  // Minhas tarefas de hoje
  const tarefasHoje = useMemo(() => {
    return tarefas.filter((t) => {
      if (isTarefaConcluida(t.status) || t.status === 'cancelada') return false;
      if (!t.prazo) return true; // sem prazo definido entra na lista de pendências
      return t.prazo.slice(0, 10) <= hojeIso;
    });
  }, [tarefas, hojeIso]);

  const tarefasConcluidasHoje = useMemo(() => {
    return tarefas.filter((t) => isTarefaConcluida(t.status));
  }, [tarefas]);

  // Minhas demandas em andamento
  const minhasDemandasAtivas = useMemo(() => {
    const userId = usuario?.id;
    return demandas.filter((d) => {
      const eMeu =
        !userId ||
        d.responsavel_id === userId ||
        d.editor_id === userId ||
        (Array.isArray(d.co_responsaveis_ids) && d.co_responsaveis_ids.includes(userId));

      const ativo = ['planejamento', 'criacao_arte', 'revisao_interna', 'copy'].includes(d.status);
      return eMeu && ativo;
    });
  }, [demandas, usuario?.id]);

  // Demandas aguardando aprovação do cliente
  const demandasAguardandoCliente = useMemo(() => {
    return demandas.filter((d) => d.status === 'revisao_cliente');
  }, [demandas]);

  // Próximos 7 dias de entregas e publicações
  const proximosSeteDias = useMemo(() => {
    const dias: { data: string; label: string; diaSemana: string; itens: Demanda[] }[] = [];
    const agora = new Date();

    for (let i = 0; i < 7; i++) {
      const dataRef = new Date(agora);
      dataRef.setDate(agora.getDate() + i);
      const iso = dataRef.toISOString().slice(0, 10);

      const diaSemana = i === 0
        ? 'Hoje'
        : i === 1
        ? 'Amanhã'
        : dataRef.toLocaleDateString('pt-BR', { weekday: 'short' });

      const label = dataRef.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const itens = demandas.filter((d) => {
        const dataItem = (d.data_programada || d.prazo || '').slice(0, 10);
        return dataItem === iso;
      });

      dias.push({ data: iso, label, diaSemana, itens });
    }
    return dias;
  }, [demandas]);

  // Concluir ou reabrir tarefa em 1 clique
  async function handleToggleTarefa(tarefa: Tarefa) {
    const concluida = isTarefaConcluida(tarefa.status);
    const novoStatus: 'concluido' | 'a_fazer' = concluida ? 'a_fazer' : 'concluido';
    setAlternandoId(tarefa.id);

    try {
      const res = await fetch(`/api/rotina/${tarefa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao atualizar tarefa');
      }

      setTarefas((prev) =>
        prev.map((t) => (t.id === tarefa.id ? { ...t, status: novoStatus } : t))
      );
      showToast(
        novoStatus === 'concluido' ? 'Tarefa concluída! 🎉' : 'Tarefa reaberta.',
        'success'
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Falha ao atualizar status da tarefa.',
        'error'
      );
    } finally {
      setAlternandoId(null);
    }
  }

  // Criar tarefa rápida para hoje
  async function handleCriarTarefaRapida(e: React.FormEvent) {
    e.preventDefault();
    if (!novaTarefaTitulo.trim()) return;

    try {
      setSalvandoTarefa(true);
      const res = await fetch('/api/rotina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novaTarefaTitulo.trim(),
          prazo: hojeIso,
          responsavel_id: usuario?.id || null,
          prioridade: 'normal',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar tarefa');

      if (data.tarefa) {
        setTarefas((prev) => [data.tarefa, ...prev]);
      } else {
        carregarDados();
      }

      setNovaTarefaTitulo('');
      showToast('Tarefa adicionada para hoje!', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Falha ao criar tarefa.', 'error');
    } finally {
      setSalvandoTarefa(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* 1. Header do Colaborador: Boas-vindas e Data */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-2xs relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-foreground">
              <Sun className="size-3.5 text-primary" /> Cockpit Operacional
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAuditoriaAberta(true)}
              className="h-7 text-xs gap-1.5 rounded-full"
            >
              <History className="size-3" /> Auditoria
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground capitalize">
            {saudacao}, {usuario?.nome || 'Colega'}!
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="size-3.5" />
            <span className="capitalize">{dataExtenso}</span>
          </p>
        </div>

        {/* Resumo de Metas do Dia */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 z-10">
          <div className="p-3 rounded-2xl bg-background/80 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Tarefas de Hoje</span>
            <span className="text-xl font-extrabold text-foreground font-mono mt-1">
              {tarefasHoje.length}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-background/80 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Em Produção</span>
            <span className="text-xl font-extrabold text-primary font-mono mt-1">
              {minhasDemandasAtivas.length}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-background/80 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">No Cliente</span>
            <span className="text-xl font-extrabold text-warning font-mono mt-1">
              {demandasAguardandoCliente.length}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-background/80 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Próx. 7 Dias</span>
            <span className="text-xl font-extrabold text-foreground font-mono mt-1">
              {proximosSeteDias.reduce((acc, d) => acc + d.itens.length, 0)}
            </span>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs">Organizando suas prioridades do dia...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda (7 cols): Checklist de Tarefas de Hoje */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <Card className="p-5 sm:p-6 rounded-3xl border border-border flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <CheckSquare className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Tarefas para Hoje</h2>
                    <p className="text-xs text-muted-foreground">
                      Conclua suas pendências com 1 clique
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavegarTab('rotina')}
                  className="h-8 text-xs gap-1"
                >
                  Abrir Rotina <ArrowRight className="size-3" />
                </Button>
              </div>

              {/* Form de Criação Rápida */}
              <form onSubmit={handleCriarTarefaRapida} className="flex gap-2 pt-1">
                <Input
                  placeholder="O que você precisa entregar hoje? (+ Enter)"
                  value={novaTarefaTitulo}
                  onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                  disabled={salvandoTarefa}
                  className="h-10 text-xs rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={salvandoTarefa || !novaTarefaTitulo.trim()}
                  className="h-10 text-xs px-3.5 rounded-xl shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              </form>

              {/* Lista de Tarefas */}
              <div className="space-y-2 pt-2">
                {tarefasHoje.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-muted/30 border border-dashed text-xs text-muted-foreground">
                    🎉 Nenhuma tarefa pendente para hoje! Aproveite para adiantar demandas.
                  </div>
                ) : (
                  tarefasHoje.map((tarefa) => {
                    const alternando = alternandoId === tarefa.id;
                    const atrasada = tarefa.prazo && tarefa.prazo.slice(0, 10) < hojeIso;

                    return (
                      <div
                        key={tarefa.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          atrasada
                            ? 'bg-destructive/5 border-destructive/20'
                            : 'bg-card border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTarefa(tarefa)}
                            disabled={alternando}
                            className="size-5 rounded-md border border-border-strong flex items-center justify-center shrink-0 text-primary hover:bg-accent transition-colors"
                          >
                            {alternando ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Circle className="size-3 text-muted-foreground" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {tarefa.titulo}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {tarefa.cliente && (
                                <span className="font-medium text-foreground">
                                  {tarefa.cliente.nome}
                                </span>
                              )}
                              {atrasada && (
                                <span className="text-destructive font-bold">Atrasada</span>
                              )}
                              {tarefa.prioridade === 'alta' && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                  Alta
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {tarefa.demanda && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavegarDemanda(tarefa.demanda!.id)}
                            className="h-7 text-[10px] px-2 shrink-0 gap-1 text-muted-foreground hover:text-foreground"
                          >
                            Ver demanda <ArrowRight className="size-2.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Concluídas Hoje (Accordion enxuto) */}
              {tarefasConcluidasHoje.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                    Concluídas recentemente ({tarefasConcluidasHoje.length})
                  </p>
                  <div className="space-y-1.5 opacity-75">
                    {tarefasConcluidasHoje.slice(0, 5).map((tarefa) => {
                      const alternando = alternandoId === tarefa.id;
                      return (
                        <div
                          key={tarefa.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-muted/40 transition-colors"
                        >
                          <span className="line-through text-muted-foreground truncate">
                            {tarefa.titulo}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleTarefa(tarefa)}
                            disabled={alternando}
                            title="Clique para reabrir tarefa"
                            className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors shrink-0"
                          >
                            {alternando ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Minhas Demandas em Andamento */}
            <Card className="p-5 sm:p-6 rounded-3xl border border-border flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      Minhas Demandas em Produção
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Posts, carrosséis e reels sob sua responsabilidade
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavegarTab('esteira')}
                  className="h-8 text-xs gap-1"
                >
                  Ver Esteira <ArrowRight className="size-3" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {minhasDemandasAtivas.length === 0 ? (
                  <div className="col-span-full p-8 text-center rounded-2xl bg-muted/30 border border-dashed text-xs text-muted-foreground">
                    Nenhuma demanda ativa atribuída a você no momento.
                  </div>
                ) : (
                  minhasDemandasAtivas.map((demanda) => (
                    <div
                      key={demanda.id}
                      onClick={() => onNavegarDemanda(demanda.id)}
                      className="p-3.5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-foreground">
                            {demanda.tipo}
                          </span>
                          {demanda.prazo && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                              <Clock className="size-3" />
                              {new Date(demanda.prazo).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {demanda.titulo}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ClienteAvatar
                            nome={demanda.cliente?.nome || 'Cliente'}
                            fotoUrl={demanda.cliente?.foto_url}
                            cor={demanda.cliente?.cor}
                            tamanho="xs"
                          />
                          <span className="text-[11px] font-medium text-muted-foreground truncate">
                            {demanda.cliente?.nome}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-primary">Abrir</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Coluna Direita (5 cols): Próximos 7 Dias & Aguardando Aprovação */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Linha do Tempo dos Próximos 7 Dias */}
            <Card className="p-5 sm:p-6 rounded-3xl border border-border flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Próximos 7 Dias</h2>
                    <p className="text-xs text-muted-foreground">Agenda de publicações e entregas</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavegarTab('calendario_geral')}
                  className="h-8 text-xs gap-1"
                >
                  Calendário <ArrowRight className="size-3" />
                </Button>
              </div>

              <div className="space-y-2.5 pt-1">
                {proximosSeteDias.map((dia) => (
                  <div
                    key={dia.data}
                    className={`p-3 rounded-2xl border transition-all ${
                      dia.diaSemana === 'Hoje'
                        ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                        : 'bg-background/60 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="font-mono text-primary font-bold">{dia.label}</span>
                        <span>•</span>
                        <span>{dia.diaSemana}</span>
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {dia.itens.length} {dia.itens.length === 1 ? 'post' : 'posts'}
                      </span>
                    </div>

                    {dia.itens.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 italic">
                        Nenhuma entrega programada
                      </p>
                    ) : (
                      <div className="space-y-1.5 mt-2">
                        {dia.itens.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => onNavegarDemanda(item.id)}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card border border-border hover:border-primary/40 cursor-pointer text-xs"
                          >
                            <span className="font-medium text-foreground truncate">
                              {item.titulo}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase shrink-0">
                              {item.tipo}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Aguardando Retorno do Cliente */}
            <Card className="p-5 sm:p-6 rounded-3xl border border-border flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-warning/10 text-warning flex items-center justify-center font-bold">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      Aguardando Aprovação ({demandasAguardandoCliente.length})
                    </h2>
                    <p className="text-xs text-muted-foreground">No portal do cliente</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {demandasAguardandoCliente.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-muted/30 border border-dashed text-xs text-muted-foreground">
                    Nenhuma demanda aguardando aprovação no momento.
                  </div>
                ) : (
                  demandasAguardandoCliente.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNavegarDemanda(item.id)}
                      className="p-3 rounded-2xl border border-warning/20 bg-warning/5 hover:border-warning/40 transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{item.titulo}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.cliente?.nome} • {item.tipo}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-warning uppercase shrink-0">
                        Revisão
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <AuditoriaDrawer
        aberto={auditoriaAberta}
        onFechar={() => setAuditoriaAberta(false)}
      />
    </div>
  );
}
