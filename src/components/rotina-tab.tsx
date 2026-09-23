'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Briefcase,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { TarefaRotina } from '@/app/api/rotina/route';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';

interface RotinaTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const PRIORIDADE_LABELS = {
  baixa: { label: 'Baixa', variant: 'muted' as const },
  normal: { label: 'Normal', variant: 'info' as const },
  alta: { label: 'Alta', variant: 'warning' as const },
  urgente: { label: 'Urgente', variant: 'destructive' as const },
};

export default function RotinaTab({ showToast }: RotinaTabProps) {
  const [tarefas, setTarefas] = useState<TarefaRotina[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [tabAtiva, setTabAtiva] = useState<'pendente' | 'concluido'>('pendente');
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>('all');
  const [clienteFiltro, setClienteFiltro] = useState<string>('all');
  const [busca, setBusca] = useState('');

  // Quick Add State
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoResponsavelId, setNovoResponsavelId] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState<'baixa' | 'normal' | 'alta' | 'urgente'>('normal');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [criando, setCriando] = useState(false);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [resTarefas, resClientes, resEquipe] = await Promise.all([
        fetch('/api/rotina'),
        fetch('/api/clientes'),
        fetch('/api/equipe').catch(() => ({ ok: false, json: async () => ({}) })),
      ]);

      const dataTar = await resTarefas.json();
      const dataCli = await resClientes.json();
      const dataEq = resEquipe.ok ? await resEquipe.json() : { membros: [] };

      if (resTarefas.ok && dataTar.tarefas) setTarefas(dataTar.tarefas);
      if (resClientes.ok && dataCli.clientes) setClientes(dataCli.clientes);
      if (dataEq.membros) setMembros(dataEq.membros);
    } catch {
      showToast('Erro ao carregar tarefas de rotina.', 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  // Quick Add Handler
  async function handleCriarTarefa(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;

    setCriando(true);
    try {
      const res = await fetch('/api/rotina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novoTitulo.trim(),
          cliente_id: novoClienteId || null,
          responsavel_id: novoResponsavelId || null,
          prioridade: novaPrioridade,
          prazo: novoPrazo || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTarefas((prev) => [data.tarefa, ...prev]);
      setNovoTitulo('');
      setNovoPrazo('');
      showToast('Tarefa adicionada com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar tarefa.', 'error');
    } finally {
      setCriando(false);
    }
  }

  // Toggle Concluir
  async function handleToggleConcluir(tarefa: TarefaRotina) {
    const novoStatus = tarefa.status === 'pendente' ? 'concluido' : 'pendente';
    // Atualização otimista
    setTarefas((prev) =>
      prev.map((t) => (t.id === tarefa.id ? { ...t, status: novoStatus } : t))
    );

    try {
      const res = await fetch(`/api/rotina/${tarefa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) throw new Error();
      showToast(novoStatus === 'concluido' ? 'Tarefa concluída! 🎉' : 'Tarefa reaberta.', 'success');
    } catch {
      // Reverte
      setTarefas((prev) =>
        prev.map((t) => (t.id === tarefa.id ? { ...t, status: tarefa.status } : t))
      );
      showToast('Erro ao atualizar tarefa.', 'error');
    }
  }

  // Deletar
  async function handleExcluir(id: string) {
    if (!confirm('Deseja excluir esta tarefa?')) return;
    try {
      const res = await fetch(`/api/rotina/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTarefas((prev) => prev.filter((t) => t.id !== id));
      showToast('Tarefa removida.', 'success');
    } catch {
      showToast('Erro ao remover tarefa.', 'error');
    }
  }

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (t.status !== tabAtiva) return false;
      if (responsavelFiltro !== 'all' && t.responsavel_id !== responsavelFiltro) return false;
      if (clienteFiltro !== 'all' && t.cliente_id !== clienteFiltro) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTit = t.titulo.toLowerCase().includes(termo);
        const matchCli = t.cliente?.nome.toLowerCase().includes(termo);
        const matchResp = t.responsavel?.nome.toLowerCase().includes(termo);
        if (!matchTit && !matchCli && !matchResp) return false;
      }
      return true;
    });
  }, [tarefas, tabAtiva, responsavelFiltro, clienteFiltro, busca]);

  const pendentesCount = tarefas.filter((t) => t.status === 'pendente').length;
  const concluidasCount = tarefas.filter((t) => t.status === 'concluido').length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
          Operação Diária · TELAS §5.3
        </span>
        <h2 className="text-xl sm:text-2xl font-black font-display text-foreground tracking-tight flex items-center gap-2.5">
          <span>Rotina da Agência</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-foreground font-mono font-bold">
            {pendentesCount} pendentes
          </span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Gerencie afazeres internos da agência que não passam pela revisão de conteúdo do cliente.
        </p>
      </div>

      {/* Caixa de Entrada Rápida (Quick Add) */}
      <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-2xs">
        <form onSubmit={handleCriarTarefa} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Digite o afazer da rotina e aperte Enter (ex: Emitir nota do Dr. Paulo)..."
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              className="h-10 text-xs flex-1 rounded-xl"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={criando}
              className="rounded-xl shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Vínculo de Cliente */}
            <Select
              value={novoClienteId}
              onChange={(e) => setNovoClienteId(e.target.value)}
              className="h-8 text-xs w-44 rounded-lg"
            >
              <option value="">Geral (Sem cliente)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>

            {/* Responsável */}
            <Select
              value={novoResponsavelId}
              onChange={(e) => setNovoResponsavelId(e.target.value)}
              className="h-8 text-xs w-40 rounded-lg"
            >
              <option value="">Atribuir a...</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>

            {/* Prioridade */}
            <Select
              value={novaPrioridade}
              onChange={(e) => setNovaPrioridade(e.target.value as any)}
              className="h-8 text-xs w-32 rounded-lg"
            >
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>

            {/* Prazo */}
            <Input
              type="date"
              value={novoPrazo}
              onChange={(e) => setNovoPrazo(e.target.value)}
              className="h-8 text-xs w-36 rounded-lg"
            />
          </div>
        </form>
      </Card>

      {/* Barra de Filtros & Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Abas: Pendentes vs Concluídas */}
        <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70 text-xs">
          <button
            type="button"
            onClick={() => setTabAtiva('pendente')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              tabAtiva === 'pendente'
                ? 'bg-card text-foreground shadow-2xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pendentes ({pendentesCount})
          </button>
          <button
            type="button"
            onClick={() => setTabAtiva('concluido')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              tabAtiva === 'concluido'
                ? 'bg-card text-foreground shadow-2xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Concluídas ({concluidasCount})
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar afazeres..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-8 text-xs rounded-xl"
            />
          </div>

          <Select
            value={responsavelFiltro}
            onChange={(e) => setResponsavelFiltro(e.target.value)}
            className="h-8 text-xs w-36 rounded-xl"
          >
            <option value="all">Toda a equipe</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Lista de Tarefas */}
      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-16 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : tarefasFiltradas.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={tabAtiva === 'pendente' ? 'Tudo em dia!' : 'Nenhuma tarefa concluída'}
          description={
            tabAtiva === 'pendente'
              ? 'Nenhum afazer pendente na rotina da agência no momento.'
              : 'As tarefas que forem marcadas como concluídas aparecerão aqui.'
          }
        />
      ) : (
        <Card padding="none" className="rounded-2xl border border-border/80 overflow-hidden shadow-2xs bg-card">
          <ul className="divide-y divide-border/60">
            {tarefasFiltradas.map((t) => {
              const isConcluida = t.status === 'concluido';
              const prio = PRIORIDADE_LABELS[t.prioridade] || PRIORIDADE_LABELS.normal;

              return (
                <li
                  key={t.id}
                  className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-accent/30 transition-colors ${
                    isConcluida ? 'opacity-60 bg-accent/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleConcluir(t)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-transform active:scale-90"
                    >
                      {isConcluida ? (
                        <CheckCircle2 className="w-5 h-5 text-success fill-success/10" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground/60 hover:text-primary" />
                      )}
                    </button>

                    {/* Texto & Badges */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold text-foreground truncate ${
                          isConcluida ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {t.titulo}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {/* Prioridade */}
                        <Badge variant={prio.variant} className="text-xs font-bold">
                          {prio.label}
                        </Badge>

                        {/* Cliente vinculado */}
                        {t.cliente && (
                          <span className="flex items-center gap-1 font-medium text-foreground bg-accent/60 px-1.5 py-0.5 rounded-md border border-border/50">
                            <ClienteAvatar nome={t.cliente.nome} cor={t.cliente.cor} tamanho="xs" />
                            <span className="truncate max-w-[120px]">{t.cliente.nome}</span>
                          </span>
                        )}

                        {/* Prazo */}
                        {t.prazo && (
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span>
                              {new Date(t.prazo).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </span>
                          </span>
                        )}

                        {/* Responsável */}
                        {t.responsavel && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{t.responsavel.nome}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExcluir(t.id)}
                      className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Excluir afazer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
