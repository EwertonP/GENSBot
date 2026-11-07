'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp,
  Users2,
  Layers,
  Sparkles,
  Calendar,
  Filter,
  BarChart3,
  Video,
  Image as ImageIcon,
  Check,
  Building2,
  User,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { SegmentedItem } from '@/components/ui/segmented';
import { Tip } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/contact-format';
import type {
  ResumoProdutividadeMembro,
  ResumoProdutividadeCliente,
  ItemEntregueDetalhe,
} from '@/app/api/equipe/produtividade/route';

interface PainelProdutividadeProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

export function PainelProdutividade({ showToast }: PainelProdutividadeProps) {
  const [carregando, setCarregando] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [filtroMembroId, setFiltroMembroId] = useState<string>('');
  const [filtroClienteId, setFiltroClienteId] = useState<string>('');
  const [visaoInterna, setVisaoInterna] = useState<'membros' | 'clientes' | 'demandas'>('membros');

  const [resumo, setResumo] = useState<{
    total_posts_diretos?: number;
    total_sem_responsavel?: number;
    total_demandas: number;
    total_entregues: number;
    total_em_andamento: number;
    taxa_entrega: number;
    top_produtor: {
      id: string;
      nome: string;
      foto_url: string | null;
      cargo: string | null;
      total_entregues: number;
    } | null;
    top_cliente: {
      id: string;
      nome: string;
      foto_url: string | null;
      cor: string | null;
      total_entregues: number;
    } | null;
  } | null>(null);

  const [membros, setMembros] = useState<ResumoProdutividadeMembro[]>([]);
  const [clientes, setClientes] = useState<ResumoProdutividadeCliente[]>([]);
  const [itensEntregues, setItensEntregues] = useState<ItemEntregueDetalhe[]>([]);
  const [semResponsavel, setSemResponsavel] = useState<ItemEntregueDetalhe[]>([]);
  const [atribuindoId, setAtribuindoId] = useState<string | null>(null);

  // Gera lista dos últimos 12 meses para o seletor
  const mesesOpcoes = useMemo(() => {
    const hoje = new Date();
    const lista: { valor: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const valor = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      lista.push({
        valor,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
    return lista;
  }, []);

  async function carregarDados() {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (mesSelecionado) params.set('mes', mesSelecionado);
      if (filtroMembroId) params.set('membro_id', filtroMembroId);
      if (filtroClienteId) params.set('cliente_id', filtroClienteId);

      const res = await fetch(`/api/equipe/produtividade?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Erro ao carregar dados de produtividade.', 'error');
        return;
      }

      setResumo(data.resumo || null);
      setMembros(data.membros || []);
      setClientes(data.clientes || []);
      setItensEntregues(data.itens_entregues || []);
      setSemResponsavel(data.itens_sem_responsavel || []);
    } catch {
      showToast('Erro de conexão ao carregar produtividade.', 'error');
    } finally {
      setCarregando(false);
    }
  }

  /** Atribui uma entrega antiga a quem a fez; passa a contar na produtividade dessa pessoa. */
  async function atribuirResponsavel(itemId: string, membroId: string, arquivada = false) {
    if (!membroId) return;
    setAtribuindoId(itemId);
    try {
      // Entrega arquivada: a demanda já foi excluída, só o registro leve existe.
      const res = await fetch(arquivada ? `/api/equipe/entregas-arquivadas/${itemId}` : `/api/conteudo/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsavel_id: membroId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível atribuir.');
      showToast('Entrega atribuída. Ela já conta para essa pessoa.', 'success');
      await carregarDados();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível atribuir.', 'error');
    } finally {
      setAtribuindoId(null);
    }
  }

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado, filtroMembroId, filtroClienteId]);

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de Filtros e Período */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Mês de Referência:</span>
          </div>
          <Select
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="w-48 text-xs font-medium"
            aria-label="Mês de referência"
          >
            {mesesOpcoes.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.label}
              </option>
            ))}
            <option value="todos">Todos os períodos</option>
          </Select>
        </div>

        {/* Alternador de Visualização Interna */}
        <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/40">
          <SegmentedItem
            active={visaoInterna === 'membros'}
            group="prod-visao"
            onClick={() => setVisaoInterna('membros')}
          >
            <Users2 className="size-3.5" />
            Por Membro
          </SegmentedItem>
          <SegmentedItem
            active={visaoInterna === 'clientes'}
            group="prod-visao"
            onClick={() => setVisaoInterna('clientes')}
          >
            <Building2 className="size-3.5" />
            Por Cliente
          </SegmentedItem>
          <SegmentedItem
            active={visaoInterna === 'demandas'}
            group="prod-visao"
            onClick={() => setVisaoInterna('demandas')}
          >
            <Layers className="size-3.5" />
            Entregas ({itensEntregues.length})
          </SegmentedItem>
        </div>
      </div>

      {/* Cards de Métricas Principais (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Entregue */}
        <Card className="p-4 rounded-2xl border border-border shadow-2xs bg-card flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">Demandas Entregues</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-foreground tabular-nums">
                {resumo?.total_entregues ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">
                de {resumo?.total_demandas ?? 0} criadas
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-success tabular-nums">
                {resumo?.taxa_entrega ?? 0}%
              </span>
              <span className="text-[11px] text-muted-foreground">taxa de conclusão</span>
            </div>
          </div>
          <div className="size-11 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-6" />
          </div>
        </Card>

        {/* Membro Destaque */}
        <Card className="p-4 rounded-2xl border border-border shadow-2xs bg-card flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs font-medium text-muted-foreground">Maior Entregador</span>
            {resumo?.top_produtor ? (
              <>
                <span className="text-base font-bold text-foreground truncate mt-1">
                  {resumo.top_produtor.nome}
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-bold text-primary tabular-nums">
                    {resumo.top_produtor.total_entregues}
                  </span>{' '}
                  peças publicadas
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground mt-2">—</span>
            )}
          </div>
          <div className="size-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Flame className="size-6" />
          </div>
        </Card>

        {/* Cliente com Mais Entregas */}
        <Card className="p-4 rounded-2xl border border-border shadow-2xs bg-card flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs font-medium text-muted-foreground">Cliente Mais Atendido</span>
            {resumo?.top_cliente ? (
              <>
                <span className="text-base font-bold text-foreground truncate mt-1">
                  {resumo.top_cliente.nome}
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-bold text-success tabular-nums">
                    {resumo.top_cliente.total_entregues}
                  </span>{' '}
                  peças entregues
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground mt-2">—</span>
            )}
          </div>
          <div className="size-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <TrendingUp className="size-6" />
          </div>
        </Card>

        {/* Em Andamento */}
        <Card className="p-4 rounded-2xl border border-border shadow-2xs bg-card flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">Ainda em Produção</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-foreground tabular-nums">
                {resumo?.total_em_andamento ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">demandas</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              copy, arte, revisão ou gravação
            </span>
          </div>
          <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Clock className="size-6" />
          </div>
        </Card>
      </div>

      {/* Entregas sem responsável: não contam para ninguém até alguém assumir */}
      {!carregando && semResponsavel.length > 0 && (
        <Card className="p-4 sm:p-5 rounded-2xl border border-warning-ring bg-warning-soft shadow-2xs flex flex-col gap-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {semResponsavel.length} {semResponsavel.length === 1 ? 'entrega está sem responsável' : 'entregas estão sem responsável'}
            </h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Elas foram entregues, mas não contam para ninguém. Escolha quem fez cada uma. Daqui para a frente, quem mover ou finalizar uma demanda sem responsável passa a ser o responsável dela.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {semResponsavel.map((it) => (
              <li key={it.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{it.titulo || 'Sem título'}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.cliente?.nome || 'Sem cliente'} · {it.tipo}
                    {it.publicado_em ? ` · publicado em ${formatDateTime(it.publicado_em)}` : ''}
                  </p>
                </div>
                <Select
                  value=""
                  onChange={(e) => atribuirResponsavel(it.id, e.target.value, Boolean(it.arquivada))}
                  disabled={atribuindoId === it.id}
                  aria-label={`Quem fez: ${it.titulo || 'entrega'}`}
                  className="w-full text-xs font-medium sm:w-52"
                >
                  <option value="">Quem fez?</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Conteúdo Principal Conforme Visão Selecionada */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-60 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : visaoInterna === 'membros' ? (
        /* VISÃO 1: POR MEMBRO (SÓCIO / COLABORADOR) */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users2 className="size-4 text-primary" />
              Entregas por Membro da Equipe
            </h4>
            <span className="text-xs text-muted-foreground">
              Total de {membros.length} colaboradores e sócios
            </span>
          </div>

          {/* Gráfico Comparativo: Atribuições vs. Concluídas por Membro */}
          {membros.length > 0 && (
            <Card className="p-5 rounded-2xl border border-border bg-card shadow-2xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="size-4 text-primary" />
                    Gráfico de Atribuições vs. Demandas Concluídas
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Comparativo de carga de trabalho e demandas finalizadas / agendadas por colaborador
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-primary" />
                    Concluídas / Agendadas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                    Em Produção
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                {membros.map((m) => {
                  const taxa =
                    m.total_demandas > 0
                      ? Math.round((m.total_entregues / m.total_demandas) * 100)
                      : 0;
                  const percConcluidas =
                    m.total_demandas > 0 ? (m.total_entregues / m.total_demandas) * 100 : 0;

                  return (
                    <div key={`grafico-${m.id}`} className="flex flex-col gap-1.5 group">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar nome={m.nome} src={m.foto_url} size="xs" />
                          <span className="font-bold text-foreground truncate">{m.nome}</span>
                          <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                            ({m.cargo || (m.papel === 'master' ? 'Sócio' : 'Membro')})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="font-bold text-foreground">
                            {m.total_entregues} / {m.total_demandas}{' '}
                            <span className="text-[11px] text-muted-foreground font-normal">
                              feitas
                            </span>
                            {m.posts_diretos > 0 && (
                              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                (inclui {m.posts_diretos} {m.posts_diretos === 1 ? 'post direto' : 'posts diretos'})
                              </span>
                            )}
                          </span>
                          <Badge
                            variant={taxa >= 80 ? 'success' : taxa >= 50 ? 'warning' : 'muted'}
                            className="text-[10px] py-0 px-1.5 font-bold"
                          >
                            {taxa}%
                          </Badge>
                        </div>
                      </div>

                      {/* Barra de Progresso Comparativa */}
                      <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden flex relative">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percConcluidas}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {membros.map((m) => {
              const isMaster = m.papel === 'master';
              const taxa =
                m.total_demandas > 0
                  ? Math.round((m.total_entregues / m.total_demandas) * 100)
                  : 0;

              return (
                <Card
                  key={m.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-2xs flex flex-col justify-between gap-4 hover:border-brand-text/50 transition-ui"
                >
                  {/* Topo do Card: Foto, Nome e Cargo */}
                  <div className="flex items-start gap-3">
                    <Avatar nome={m.nome} src={m.foto_url} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground text-sm truncate">{m.nome}</span>
                        {isMaster && (
                          <Badge variant="brand" className="text-[10px] py-0 px-1.5">
                            Sócio / Master
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.cargo || (isMaster ? 'Diretor' : 'Colaborador')}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{m.email}</p>
                    </div>
                  </div>

                  {/* Estatísticas Numéricas de Entrega */}
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/40 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-lg font-black text-foreground tabular-nums block">
                        {m.total_entregues}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        Entregues
                      </span>
                    </div>
                    <div>
                      <span className="text-lg font-black text-muted-foreground tabular-nums block">
                        {m.total_em_andamento}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        Em Aberto
                      </span>
                    </div>
                    <div>
                      <span className="text-lg font-black text-success tabular-nums block">
                        {taxa}%
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        Conclusão
                      </span>
                    </div>
                  </div>

                  {/* Divisão: Responsável Principal vs Co-responsável */}
                  <div className="flex items-center justify-between text-xs px-1 text-muted-foreground border-t border-border/40 pt-2">
                    <span>
                      Como titular: <strong className="text-foreground">{m.como_principal}</strong>
                    </span>
                    <span>
                      Como co-autor:{' '}
                      <strong className="text-foreground">{m.como_co_responsavel}</strong>
                    </span>
                  </div>

                  {/* Formatos Entregues */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.por_tipo.post > 0 && (
                      <Badge variant="muted" className="text-[11px] gap-1">
                        <ImageIcon className="size-3 text-muted-foreground" />
                        {m.por_tipo.post} Post{m.por_tipo.post > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {m.por_tipo.reel > 0 && (
                      <Badge variant="muted" className="text-[11px] gap-1">
                        <Video className="size-3 text-muted-foreground" />
                        {m.por_tipo.reel} Reel{m.por_tipo.reel > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {m.por_tipo.carrossel > 0 && (
                      <Badge variant="muted" className="text-[11px] gap-1">
                        <Layers className="size-3 text-muted-foreground" />
                        {m.por_tipo.carrossel} Carrossel
                      </Badge>
                    )}
                    {m.por_tipo.story > 0 && (
                      <Badge variant="muted" className="text-[11px] gap-1">
                        <Sparkles className="size-3 text-muted-foreground" />
                        {m.por_tipo.story} Story
                      </Badge>
                    )}
                    {m.total_entregues === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        Nenhuma demanda entregue neste mês
                      </span>
                    )}
                  </div>

                  {/* Clientes Atendidos por este Membro */}
                  <div className="border-t border-border/60 pt-3">
                    <span className="text-[11px] font-bold text-muted-foreground block mb-2 uppercase">
                      Clientes com entregas ({m.clientes.length})
                    </span>
                    {m.clientes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {m.clientes.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-lg bg-muted/20"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ClienteAvatar
                                nome={c.nome}
                                cor={c.cor || '#22c55e'}
                                fotoUrl={c.foto_url}
                                tamanho="xs"
                              />
                              <span className="truncate font-medium text-foreground">{c.nome}</span>
                            </div>
                            <span className="font-bold text-foreground tabular-nums shrink-0">
                              {c.total_entregues} entregue{c.total_entregues !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : visaoInterna === 'clientes' ? (
        /* VISÃO 2: POR CLIENTE */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Entregas por Cliente
            </h4>
            <span className="text-xs text-muted-foreground">
              {clientes.length} clientes com demandas no período
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map((c) => (
              <Card
                key={c.id}
                className="p-5 rounded-2xl border border-border bg-card shadow-2xs flex flex-col justify-between gap-4"
              >
                {/* Topo do Cliente */}
                <div className="flex items-start gap-3">
                  <ClienteAvatar
                    nome={c.nome}
                    cor={c.cor || '#22c55e'}
                    fotoUrl={c.foto_url}
                    tamanho="md"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-foreground text-sm truncate block">{c.nome}</span>
                    <p className="text-xs text-muted-foreground truncate">{c.nicho || 'Geral'}</p>
                  </div>
                </div>

                {/* Estatísticas de Entrega do Pacote */}
                <div className="bg-muted/40 rounded-xl p-3 border border-border/40">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-muted-foreground">Progresso do Pacote</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {c.total_entregues} de {c.total_demandas} ({c.taxa_entrega}%)
                    </span>
                  </div>
                  {/* Barra de Progresso */}
                  <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-success h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, c.taxa_entrega)}%` }}
                    />
                  </div>
                </div>

                {/* Breakdown por Formato */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.por_tipo.post > 0 && (
                    <Badge variant="muted" className="text-[11px] gap-1">
                      <ImageIcon className="size-3 text-muted-foreground" />
                      {c.por_tipo.post} Post{c.por_tipo.post > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {c.por_tipo.reel > 0 && (
                    <Badge variant="muted" className="text-[11px] gap-1">
                      <Video className="size-3 text-muted-foreground" />
                      {c.por_tipo.reel} Reel{c.por_tipo.reel > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {c.por_tipo.carrossel > 0 && (
                    <Badge variant="muted" className="text-[11px] gap-1">
                      <Layers className="size-3 text-muted-foreground" />
                      {c.por_tipo.carrossel} Carrossel
                    </Badge>
                  )}
                  {c.por_tipo.story > 0 && (
                    <Badge variant="muted" className="text-[11px] gap-1">
                      <Sparkles className="size-3 text-muted-foreground" />
                      {c.por_tipo.story} Story
                    </Badge>
                  )}
                </div>

                {/* Quem produziu para este cliente */}
                <div className="border-t border-border/60 pt-3">
                  <span className="text-[11px] font-bold text-muted-foreground block mb-2 uppercase">
                    Equipe Envolvida
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {c.membros.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-muted/40 text-xs"
                      >
                        <Avatar nome={m.nome} src={m.foto_url} size="sm" />
                        <span className="font-medium text-foreground">{m.nome}</span>
                        <Badge variant="muted" className="text-[10px] py-0 px-1 font-bold">
                          {m.total_entregues}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* VISÃO 3: LISTA DETALHADA DE DEMANDAS ENTREGUES */
        <Card className="p-5 rounded-2xl border border-border shadow-2xs bg-card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                Histórico de Peças Publicadas / Entregues
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Relação detalhada de todas as demandas concluídas no período
              </p>
            </div>
            <Badge variant="muted">{itensEntregues.length} publicadas</Badge>
          </div>

          {itensEntregues.length === 0 ? (
            <EmptyState
              size="compact"
              icon={Layers}
              title="Nenhuma demanda entregue no período"
              description="Quando as demandas forem movidas para o status 'Publicado', elas aparecerão listadas aqui."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Título / Demanda</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Formato</th>
                    <th className="py-2.5 px-3">Responsável</th>
                    <th className="py-2.5 px-3">Co-autores</th>
                    <th className="py-2.5 px-3">Data / Programada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {itensEntregues.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-foreground max-w-xs truncate">
                        {item.titulo || 'Demanda sem título'}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.cliente ? (
                          <div className="flex items-center gap-1.5">
                            <ClienteAvatar
                              nome={item.cliente.nome}
                              cor={item.cliente.cor || '#22c55e'}
                              fotoUrl={item.cliente.foto_url}
                              tamanho="xs"
                            />
                            <span className="font-medium text-foreground truncate max-w-[140px]">
                              {item.cliente.nome}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="muted" className="capitalize text-[11px]">
                          {item.tipo}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {item.responsavel ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar
                              nome={item.responsavel.nome}
                              src={item.responsavel.foto_url}
                              size="sm"
                            />
                            <span>{item.responsavel.nome}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.co_responsaveis.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {item.co_responsaveis.map((co) => (
                              <Tip key={co.id} label={co.nome}>
                                <div>
                                  <Avatar nome={co.nome} src={co.foto_url} size="sm" />
                                </div>
                              </Tip>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground tabular-nums">
                        {formatDateTime(item.publicado_em || item.data_programada) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
