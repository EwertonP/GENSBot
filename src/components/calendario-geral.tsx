'use client';

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
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { STATUS_LABELS, type ConteudoItem, type StatusConteudo } from '@/lib/conteudo';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';

interface CalendarioGeralProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function CalendarioGeral({ showToast }: CalendarioGeralProps) {
  const [items, setItems] = useState<ConteudoItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Mês ativo no calendário (ano e mês base 0)
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());
  const [viewMode, setViewMode] = useState<'mes' | 'semana' | 'dia'>('mes');

  // Filtros
  const [clienteFiltro, setClienteFiltro] = useState('all');
  const [responsavelFiltro, setResponsavelFiltro] = useState('all');
  const [itemModal, setItemModal] = useState<ConteudoItem | null>(null);

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
  }

  // Itens filtrados
  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (clienteFiltro !== 'all' && item.cliente_id !== clienteFiltro) return false;
      if (responsavelFiltro !== 'all' && item.responsavel_id !== responsavelFiltro) return false;
      return true;
    });
  }, [items, clienteFiltro, responsavelFiltro]);

  // Montagem da grade do calendário (dias do mês)
  const diasDoCalendario = useMemo(() => {
    const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay(); // 0 = domingo
    const totalDiasMes = new Date(ano, mesIndex + 1, 0).getDate();

    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      dias.push({ dia: null, itens: [] });
    }
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const itensDoDia = itemsFiltrados.filter((it) => {
        if (!it.data_programada && !it.prazo) return false;
        const dataAlvo = it.data_programada || it.prazo;
        return dataAlvo?.startsWith(dataStr);
      });
      dias.push({ dia: d, dataStr, itens: itensDoDia });
    }
    return dias;
  }, [ano, mesIndex, itemsFiltrados]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* 1. Header do Calendário (Estilo Manageko & Datewise) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
            Visão Geral da Agência
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-display text-foreground tracking-tight capitalize flex items-center gap-2 mt-0.5">
            <span>Calendário Geral de Publicações</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Acompanhe o cronograma de todos os clientes em um só lugar para prevenir choques de datas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Alternador de Modo de Exibição (Pill Tabs Verde GENS) */}
          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setViewMode('mes')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'mes'
                  ? 'bg-[#edf4d8] text-[#192313] border border-[#d8ff3c]/60 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'semana'
                  ? 'bg-[#edf4d8] text-[#192313] border border-[#d8ff3c]/60 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode('dia')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'dia'
                  ? 'bg-[#edf4d8] text-[#192313] border border-[#d8ff3c]/60 shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dia
            </button>
          </div>

          {/* Navegação de Mês & Botão Hoje */}
          <div className="flex items-center gap-1.5 bg-accent/60 p-1 rounded-xl border border-border/70 shadow-2xs">
            <button
              type="button"
              onClick={() => mudarMes(-1)}
              className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={irParaHoje}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-card text-foreground hover:bg-accent border border-border/70 shadow-2xs cursor-pointer"
            >
              Hoje
            </button>

            <span className="text-xs font-bold text-foreground px-2 capitalize font-display min-w-[120px] text-center">
              {nomeMes}
            </span>

            <button
              type="button"
              onClick={() => mudarMes(1)}
              className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="h-9 text-xs w-48 rounded-xl"
        >
          <option value="all">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>

        {membros.length > 0 && (
          <Select
            value={responsavelFiltro}
            onChange={(e) => setResponsavelFiltro(e.target.value)}
            className="h-9 text-xs w-44 rounded-xl"
          >
            <option value="all">Toda a equipe</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        )}

        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {itemsFiltrados.length} postagens programadas no mês
        </span>
      </div>

      {/* 3. Grade do Calendário (Estilo Datewise: Event Blocks Arredondados com Borda Verde) */}
      <Card padding="none" className="rounded-3xl border border-border/80 overflow-hidden shadow-xs bg-card">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b border-border/60 bg-[#edf4d8]/40 text-center py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#59614f] font-mono">
          <span>Dom</span>
          <span>Seg</span>
          <span>Ter</span>
          <span>Qua</span>
          <span>Qui</span>
          <span>Sex</span>
          <span>Sáb</span>
        </div>

        {/* Células dos dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/50 bg-[#f7f8f2]/30">
          {diasDoCalendario.map((d, idx) => {
            if (d.dia === null) {
              return <div key={`empty-${idx}`} className="bg-accent/10 min-h-[120px]" />;
            }

            const temChoque = d.itens.length >= 3;
            const eHoje = d.dia === hoje.getDate() && mesIndex === hoje.getMonth() && ano === hoje.getFullYear();

            return (
              <div
                key={d.dataStr}
                className={`p-2 min-h-[130px] flex flex-col justify-between transition-colors ${
                  temChoque ? 'bg-warning/5' : eHoje ? 'bg-[#d8ff3c]/10' : 'hover:bg-accent/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold font-mono ${
                      eHoje
                        ? 'w-6 h-6 rounded-full bg-[#192313] text-[#d8ff3c] flex items-center justify-center font-bold shadow-2xs'
                        : 'text-foreground'
                    }`}
                  >
                    {d.dia}
                  </span>

                  {d.itens.length > 0 && (
                    <span className="text-[10px] font-mono text-[#59614f] font-bold bg-[#edf4d8] px-1.5 py-0.2 rounded-md">
                      {d.itens.length} {d.itens.length === 1 ? 'post' : 'posts'}
                    </span>
                  )}
                </div>

                {/* Lista de Event Blocks no Dia (Datewise Style) */}
                <div className="flex flex-col gap-1.5 mt-2 flex-1">
                  {d.itens.slice(0, 3).map((item) => {
                    const statusInfo = STATUS_LABELS[item.status as StatusConteudo] || { label: item.status };
                    const horaFormatada = item.data_programada ? item.data_programada.slice(11, 16) : null;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setItemModal(item)}
                        className="text-left p-2 rounded-xl border-l-4 border-[#d8ff3c] bg-[#edf4d8]/70 hover:bg-[#edf4d8] border border-border/60 text-[#192313] shadow-2xs hover:shadow-xs transition-all flex flex-col gap-1 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ClienteAvatar
                              nome={item.cliente?.nome || 'Cliente'}
                              cor={item.cliente?.cor}
                              fotoUrl={item.cliente?.foto_url}
                              tamanho="xs"
                              className="shrink-0"
                            />
                            <span className="text-[10px] font-bold text-[#192313] truncate">
                              {item.cliente?.nome}
                            </span>
                          </div>
                          {horaFormatada && (
                            <span className="text-[9px] font-mono text-[#59614f] font-bold">
                              {horaFormatada}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-medium text-[#192313]/90 line-clamp-1 group-hover:font-bold">
                          {item.titulo || item.tipo}
                        </span>
                      </button>
                    );
                  })}

                  {d.itens.length > 3 && (
                    <span className="text-[9px] font-bold text-[#59614f] text-center pt-0.5">
                      +{d.itens.length - 3} outros
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
