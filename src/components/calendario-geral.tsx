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
  X,
  FileText,
  Paperclip,
  Share2,
  Edit2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { STATUS_LABELS, type ConteudoItem, type StatusConteudo, type PrefillAgendamento, gerarLinkWhatsAppAprovacao } from '@/lib/conteudo';
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
    setDiaSelecionado(hoje.getDate());
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
        return dataAlvo?.startsWith(dataStr);
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
          return dataAlvoStr?.startsWith(dataStr);
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
      return dataAlvoStr?.startsWith(dataStr);
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
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 border border-rose-300 dark:border-rose-800">
            <Video className="w-3 h-3" />
            Reels
          </span>
        );
      case 'story':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 border border-sky-300 dark:border-sky-800">
            <Smartphone className="w-3 h-3" />
            Story
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-300 dark:border-emerald-800">
            <ImageIcon className="w-3 h-3" />
            Carrossel / Post
          </span>
        );
    }
  };

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

      {/* 3. Grade do Calendário (Mês / Semana / Dia) */}
      <Card padding="none" className="rounded-3xl border border-border/80 overflow-hidden shadow-xs bg-card">
        {viewMode !== 'dia' && (
          <div className="grid grid-cols-7 border-b border-border/60 bg-[#edf4d8]/40 text-center py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#59614f] font-mono">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>
        )}

        {/* Células em modo Mês ou Semana */}
        {viewMode !== 'dia' ? (
          <div className="grid grid-cols-7 divide-x divide-y divide-border/50 bg-[#f7f8f2]/30">
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
                  className={`p-2 ${viewMode === 'semana' ? 'min-h-[220px]' : 'min-h-[130px]'} flex flex-col justify-between transition-colors cursor-pointer ${
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

                  {/* Lista de Event Blocks no Dia */}
                  <div className="flex flex-col gap-1.5 mt-2 flex-1">
                    {d.itens.slice(0, viewMode === 'semana' ? 6 : 3).map((item) => {
                      const horaFormatada = item.data_programada ? item.data_programada.slice(11, 16) : null;
                      const capaUrl = item.arquivos?.[0]?.url;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemModal(item);
                          }}
                          className="text-left p-2 rounded-xl border-l-4 border-[#d8ff3c] bg-[#edf4d8]/70 hover:bg-[#edf4d8] border border-border/60 text-[#192313] shadow-2xs hover:shadow-xs transition-all flex flex-col gap-1.5 cursor-pointer group"
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

                          {/* Previsualização da Capa se houver */}
                          {capaUrl && (
                            <div className="w-full h-16 rounded-lg overflow-hidden relative border border-black/10 bg-black/5">
                              <img src={capaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-medium text-[#192313]/90 line-clamp-1 group-hover:font-bold flex-1">
                              {item.titulo || item.tipo}
                            </span>
                            {getFormatBadge(item.tipo)}
                          </div>
                        </button>
                      );
                    })}

                    {d.itens.length > (viewMode === 'semana' ? 6 : 3) && (
                      <span className="text-[9px] font-bold text-[#59614f] text-center pt-0.5">
                        +{d.itens.length - (viewMode === 'semana' ? 6 : 3)} outros
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Modo Dia Único Detalhado */
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase font-mono">Cronograma do Dia</span>
                <h3 className="text-lg font-black text-foreground capitalize">
                  {diasExibicao[0]?.dia} de {nomeMes} {diasExibicao[0]?.nomeDia ? `(${diasExibicao[0]?.nomeDia})` : ''}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-accent text-foreground">
                {diasExibicao[0]?.itens.length || 0} publicações agendadas
              </span>
            </div>

            {diasExibicao[0]?.itens.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs font-medium">
                Nenhuma publicação agendada para este dia.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {diasExibicao[0]?.itens.map((item) => {
                  const statusInfo = STATUS_LABELS[item.status as StatusConteudo] || { label: item.status };
                  const horaFormatada = item.data_programada ? item.data_programada.slice(11, 16) : null;
                  const capaUrl = item.arquivos?.[0]?.url;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setItemModal(item)}
                      className="p-4 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-2xs flex flex-col gap-3 cursor-pointer group"
                    >
                      {/* Capa */}
                      {capaUrl ? (
                        <div className="w-full h-36 rounded-xl overflow-hidden relative border border-border bg-accent">
                          <img src={capaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute top-2 right-2">
                            {getFormatBadge(item.tipo)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <Badge variant="muted" className="text-[10px]">
                            {statusInfo.label}
                          </Badge>
                          {getFormatBadge(item.tipo)}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <ClienteAvatar
                          nome={item.cliente?.nome || 'Cliente'}
                          cor={item.cliente?.cor}
                          fotoUrl={item.cliente?.foto_url}
                          tamanho="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{item.cliente?.nome}</p>
                          {horaFormatada && (
                            <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Horário: {horaFormatada}
                            </p>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.titulo || 'Publicação sem título'}
                      </h4>

                      {item.legenda && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.legenda}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 4. Modal 2 Colunas de Detalhes da Demanda (Trello Style) */}
      <Sheet open={!!itemModal} onClose={() => setItemModal(null)} className="max-w-4xl w-full p-0">
        {itemModal && (
          <div className="flex flex-col max-h-[85vh]">
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
                  <div className="p-4 rounded-2xl bg-accent/40 border border-border/70 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
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
                          className="group relative rounded-xl border border-border overflow-hidden bg-accent/50 aspect-square flex flex-col items-center justify-center p-2 text-center hover:border-primary transition-all"
                        >
                          {arq.tipo === 'imagem' ? (
                            <img src={arq.url} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary">
                              <Video className="w-6 h-6" />
                              <span className="text-[10px] font-bold truncate max-w-full">Vídeo #{i + 1}</span>
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
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Formato do Conteúdo</span>
                  <div>{getFormatBadge(itemModal.tipo)}</div>
                </div>

                {/* Status no Kanban */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Status da Esteira</span>
                  <Badge variant="muted" className="w-fit text-xs font-bold border-primary/50 text-primary">
                    {STATUS_LABELS[itemModal.status as StatusConteudo]?.label || itemModal.status}
                  </Badge>
                </div>

                {/* Datas Importantes */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-accent/40 border border-border/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Data de Postagem:</span>
                    <strong className="text-foreground font-mono">
                      {itemModal.data_programada ? itemModal.data_programada.slice(0, 16).replace('T', ' ') : 'Não agendada'}
                    </strong>
                  </div>
                  {itemModal.prazo && (
                    <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                      <span className="text-muted-foreground font-medium">Prazo Interno:</span>
                      <strong className="text-foreground font-mono">{itemModal.prazo.slice(0, 10)}</strong>
                    </div>
                  )}
                </div>

                {/* Responsáveis */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Membros Responsáveis</span>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Copy / Redação:</span>
                      <strong className="text-foreground">{itemModal.responsavel?.nome || 'Não atribuído'}</strong>
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
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/80 text-foreground font-bold text-xs transition-all border border-border/80 cursor-pointer shadow-2xs"
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
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-bold text-xs transition-all cursor-pointer shadow-2xs"
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs transition-all shadow-2xs"
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
