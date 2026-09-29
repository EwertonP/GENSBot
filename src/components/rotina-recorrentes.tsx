'use client';

import React, { useEffect, useState } from 'react';
import { Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';
import {
  DIAS_SEMANA_CURTO,
  DIAS_UTEIS,
  descreverRegra,
  hojeBrasilia,
  proximaOcorrencia,
  somarDias,
  type TarefaRecorrente,
} from '@/lib/rotina-recorrencia';

function formatarDia(dia: string | null) {
  if (!dia) return '—';
  const [, m, d] = dia.split('-');
  return `${d}/${m}`;
}

/** Janela das rotinas recorrentes: lista as regras e cria novas. */
export function RotinaRecorrentesSheet({
  aberto,
  onClose,
  clientes,
  membros,
  ehMaster,
  showToast,
  onMudou,
}: {
  aberto: boolean;
  onClose: () => void;
  clientes: Cliente[];
  membros: MembroEquipe[];
  ehMaster: boolean;
  showToast: (m: string, t: 'success' | 'error') => void;
  /** Chamado quando uma regra nova gerou tarefa hoje (o quadro recarrega). */
  onMudou: () => void;
}) {
  const [regras, setRegras] = useState<TarefaRecorrente[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [frequencia, setFrequencia] = useState<'semanal' | 'mensal'>('semanal');
  const [dias, setDias] = useState<number[]>([1]);
  const [diaMes, setDiaMes] = useState('20');
  const [prazoDias, setPrazoDias] = useState('0');
  const [clienteId, setClienteId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    fetch('/api/rotina/recorrentes')
      .then((r) => r.json())
      .then((d) => {
        if (ativo) setRegras(d.regras || []);
      })
      .catch(() => showToast('Erro ao carregar rotinas recorrentes.', 'error'))
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
    // showToast muda a cada render da página; só recarrega ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const hoje = hojeBrasilia();

  function alternarDia(d: number) {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d]));
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/rotina/recorrentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          frequencia,
          dias_semana: frequencia === 'semanal' ? dias : [],
          dia_mes: frequencia === 'mensal' ? Number(diaMes) : null,
          prazo_dias: Number(prazoDias) || 0,
          cliente_id: clienteId || null,
          responsavel_id: responsavelId || null,
          prioridade,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRegras((prev) => [data.regra, ...prev]);
      setTitulo('');
      showToast(data.tarefa_de_hoje ? 'Rotina criada. A tarefa de hoje já está no quadro.' : 'Rotina recorrente criada.', 'success');
      if (data.tarefa_de_hoje) onMudou();
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Erro ao criar rotina.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(regra: TarefaRecorrente) {
    setRegras((prev) => prev.map((r) => (r.id === regra.id ? { ...r, ativo: !r.ativo } : r)));
    const res = await fetch(`/api/rotina/recorrentes/${regra.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !regra.ativo }),
    }).catch(() => null);
    if (!res?.ok) {
      setRegras((prev) => prev.map((r) => (r.id === regra.id ? regra : r)));
      showToast('Não foi possível atualizar.', 'error');
    }
  }

  async function apagar(regra: TarefaRecorrente) {
    if (!window.confirm(`Apagar a rotina "${regra.titulo}"? As tarefas já criadas continuam no quadro.`)) return;
    const res = await fetch(`/api/rotina/recorrentes/${regra.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      showToast('Não foi possível apagar.', 'error');
      return;
    }
    setRegras((prev) => prev.filter((r) => r.id !== regra.id));
  }

  return (
    <Sheet open={aberto} onClose={onClose} aria-label="Rotinas recorrentes">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold font-display text-foreground flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" /> Rotinas recorrentes
          </h3>
          <p className="text-xs text-muted-foreground">
            O que se repete toda semana ou todo mês. A tarefa aparece sozinha no quadro no dia certo (gerada de madrugada).
          </p>
        </div>

        {/* Nova regra */}
        <form onSubmit={criar} className="flex flex-col gap-3 rounded-2xl border border-border bg-accent/20 p-3">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Relatório semanal da Dra. Laís, planejar o mês seguinte…"
            className="h-9 text-xs"
            aria-label="Título da rotina"
            required
          />

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Select
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value as 'semanal' | 'mensal')}
              className="h-8 text-xs w-32"
              aria-label="Frequência"
            >
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </Select>

            {frequencia === 'semanal' ? (
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Dias da semana">
                {DIAS_SEMANA_CURTO.map((nome, d) => (
                  <button
                    key={nome}
                    type="button"
                    aria-pressed={dias.includes(d)}
                    onClick={() => alternarDia(d)}
                    className={`w-9 h-8 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      dias.includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {nome}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDias(DIAS_UTEIS)}
                  className="px-2 h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  dias úteis
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1.5">
                Dia
                <Input type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(e.target.value)} className="h-8 w-16 text-xs" />
                do mês
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              Prazo
              <Select value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} className="h-8 text-xs w-36">
                <option value="0">no mesmo dia</option>
                <option value="1">1 dia depois</option>
                <option value="2">2 dias depois</option>
                <option value="3">3 dias depois</option>
                <option value="5">5 dias depois</option>
                <option value="7">1 semana depois</option>
              </Select>
            </label>
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="h-8 text-xs w-44" aria-label="Cliente">
              <option value="">Agência (sem cliente)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            {ehMaster && (
              <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="h-8 text-xs w-40" aria-label="Responsável">
                <option value="">Para mim</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            )}
            <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="h-8 text-xs w-28" aria-label="Prioridade">
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" loading={salvando} disabled={frequencia === 'semanal' && dias.length === 0}>
              <Plus className="w-4 h-4 mr-1" /> Criar rotina
            </Button>
          </div>
        </form>

        {/* Lista */}
        {carregando ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : regras.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma rotina recorrente ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {regras.map((r) => {
              const desde = r.ultima_geracao === hoje ? somarDias(hoje, 1) : hoje;
              return (
                <li
                  key={r.id}
                  className={`flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 ${r.ativo ? '' : 'opacity-60'}`}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground">{r.titulo}</span>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant={r.ativo ? 'info' : 'muted'} className="text-[11px]">
                        {r.ativo ? descreverRegra(r) : 'Pausada'}
                      </Badge>
                      {r.cliente?.nome && <span>{r.cliente.nome}</span>}
                      {r.responsavel?.nome && <span>· {r.responsavel.nome}</span>}
                      {r.ativo && <span>· próxima: {formatarDia(proximaOcorrencia(r, desde))}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => alternarAtivo(r)}
                      className="grid place-items-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                      aria-label={r.ativo ? 'Pausar rotina' : 'Retomar rotina'}
                      title={r.ativo ? 'Pausar' : 'Retomar'}
                    >
                      {r.ativo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => apagar(r)}
                      className="grid place-items-center size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      aria-label="Apagar rotina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
