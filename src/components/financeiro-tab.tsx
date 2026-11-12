'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  MessageCircle,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedItem } from '@/components/ui/segmented';
import { StatCard } from '@/components/ui/stat-card';
import { IconButton } from '@/components/ui/icon-button';
import { confirmDialog } from '@/components/ui/dialog';
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  calcularSaldosContas,
  formatarReais,
  lancamentosDoMes,
  lerValor,
  mesAtual,
  resumirMes,
  rotuloCategoria,
  rotuloMes,
  serieMensal,
  somarMeses,
  type ClienteCobranca,
  type ContaBancaria,
  type CategoriaFinanceiro,
  type TransferenciaContas,
  type Lancamento,
  type TipoLancamento,
} from '@/lib/financeiro';

interface FinanceiroTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

type Filtro = 'todos' | TipoLancamento | 'a_receber' | 'a_pagar';
type AbaFinanceiro = 'visao_geral' | 'lancamentos' | 'mais';

const hojeISO = () => new Date().toISOString().slice(0, 10);

function dataHojeFormatada() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function diaMes(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default function FinanceiroTab({ showToast }: FinanceiroTabProps) {
  const toastRef = useRef(showToast);
  useEffect(() => {
    toastRef.current = showToast;
  });

  const [abaAtiva, setAbaAtiva] = useState<AbaFinanceiro>('visao_geral');
  const [mes, setMes] = useState(() => mesAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<ClienteCobranca[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceiro[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaContas[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [formTipo, setFormTipo] = useState<TipoLancamento | null>(null);
  const [lancamentoEditando, setLancamentoEditando] = useState<Lancamento | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Modais de suporte
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalTransfAberto, setModalTransfAberto] = useState(false);
  const [modalCatAberto, setModalCatAberto] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/financeiro?de=${somarMeses(mes, -1)}&ate=${somarMeses(mes, 2)}`);
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'Não foi possível carregar o Financeiro.');
      setErro(null);
      setLancamentos(corpo.lancamentos ?? []);
      setClientes(corpo.clientes ?? []);
      setContas(corpo.contas ?? []);
      setCategorias(corpo.categorias ?? []);
      setTransferencias(corpo.transferencias ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o Financeiro.');
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function irParaMes(delta: number) {
    setCarregando(true);
    setMes((m) => somarMeses(m, delta));
  }

  const hoje = hojeISO();
  const doMes = useMemo(() => lancamentosDoMes(lancamentos, clientes, mes), [lancamentos, clientes, mes]);
  const resumo = useMemo(() => resumirMes(doMes, hoje), [doMes, hoje]);
  const serie = useMemo(() => serieMensal(lancamentos, clientes, somarMeses(mes, -1), 3), [lancamentos, clientes, mes]);

  const contasComSaldo = useMemo(
    () => calcularSaldosContas(contas, lancamentos, transferencias),
    [contas, lancamentos, transferencias]
  );

  const saldoTotalGeral = useMemo(
    () => contasComSaldo.reduce((acc, c) => acc + (c.saldo_calculado ?? 0), 0),
    [contasComSaldo]
  );

  const visiveis = useMemo(() => {
    if (filtro === 'todos') return doMes;
    if (filtro === 'receita') return doMes.filter((l) => l.tipo === 'receita');
    if (filtro === 'despesa') return doMes.filter((l) => l.tipo === 'despesa');
    if (filtro === 'a_receber') return doMes.filter((l) => l.tipo === 'receita' && !l.pago);
    if (filtro === 'a_pagar') return doMes.filter((l) => l.tipo === 'despesa' && !l.pago);
    return doMes;
  }, [doMes, filtro]);

  const nomeCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);
  const mapaContas = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  // Gastos por categoria no mês para metas
  const gastosPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of doMes) {
      if (l.tipo === 'despesa') {
        mapa.set(l.categoria, (mapa.get(l.categoria) || 0) + l.valor);
      }
    }
    return mapa;
  }, [doMes]);

  async function alternarPago(l: Lancamento) {
    setOcupado(l.id);
    try {
      const res =
        l.origem === 'mensalidade'
          ? await fetch('/api/financeiro/mensalidade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cliente_id: l.cliente_id,
                mes: (l.competencia ?? l.vencimento).slice(0, 7),
                pago: !l.pago,
              }),
            })
          : await fetch(`/api/financeiro/${l.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pago: !l.pago }),
            });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'Não foi possível atualizar.');
      await carregar();
    } catch (e) {
      toastRef.current(e instanceof Error ? e.message : 'Não foi possível atualizar.', 'error');
    } finally {
      setOcupado(null);
    }
  }

  async function excluir(l: Lancamento) {
    const ok = await confirmDialog({
      title: 'Excluir este lançamento?',
      description: `${l.descricao} (${formatarReais(l.valor)}) será removido.`,
      confirmLabel: 'Excluir',
      tone: 'destructive',
    });
    if (!ok) return;
    setOcupado(l.id);
    try {
      const res = await fetch(`/api/financeiro/${l.id}`, { method: 'DELETE' });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'Não foi possível excluir.');
      toastRef.current('Lançamento excluído.', 'success');
      await carregar();
    } catch (e) {
      toastRef.current(e instanceof Error ? e.message : 'Não foi possível excluir.', 'error');
    } finally {
      setOcupado(null);
    }
  }

  function cobrarClienteWhatsApp(l: Lancamento) {
    const nome = l.cliente_id ? nomeCliente.get(l.cliente_id) : '';
    const texto = `Olá${nome ? ` ${nome}` : ''}, tudo bem? Notamos que o pagamento de "${l.descricao}" no valor de ${formatarReais(l.valor)} com vencimento em ${diaMes(l.vencimento)} consta em aberto no sistema. Poderia nos enviar o comprovante ou nos avisar se precisar de uma 2ª via da chave PIX? Muito obrigado!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }

  const maiorValor = Math.max(1, ...serie.flatMap((p) => [p.receitas, p.despesas]));
  const resultadoNegativo = resumo.resultado < 0;

  // Variação percentual vs. mês anterior (quando disponível na série)
  const mesAnteriorDados = serie[0];
  const pctReceitaAnterior =
    mesAnteriorDados && mesAnteriorDados.receitas > 0
      ? Math.round(((resumo.receitas - mesAnteriorDados.receitas) / mesAnteriorDados.receitas) * 100)
      : null;
  const pctDespesaAnterior =
    mesAnteriorDados && mesAnteriorDados.despesas > 0
      ? Math.round(((resumo.despesas - mesAnteriorDados.despesas) / mesAnteriorDados.despesas) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6 pb-12 max-w-6xl mx-auto animate-fade-in">
      {/* 1. Barra Superior: Abas de Navegação + Seletor de Mês + Ações */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Áreas do Financeiro"
            className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-2xs"
          >
            {(
              [
                ['visao_geral', 'Visão geral', LayoutDashboard],
                ['lancamentos', 'Lançamentos', ListOrdered],
                ['mais', 'Contas & Metas', Landmark],
              ] as const
            ).map(([id, label, Icon]) => (
              <SegmentedItem
                key={id}
                group="fin-aba"
                active={abaAtiva === id}
                onClick={() => setAbaAtiva(id)}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Icon className="size-3.5" />
                {label}
              </SegmentedItem>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <IconButton label="Mês anterior" onClick={() => irParaMes(-1)} className="rounded-full">
              <ChevronLeft />
            </IconButton>
            <span className="min-w-32 text-center text-xs sm:text-sm font-semibold text-foreground first-letter:uppercase">
              {rotuloMes(mes)}
            </span>
            <IconButton label="Próximo mês" onClick={() => irParaMes(1)} className="rounded-full">
              <ChevronRight />
            </IconButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {contas.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalTransfAberto(true)}
              className="rounded-full h-9 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeftRight className="size-3.5 mr-1.5" /> Transferir
            </Button>
          )}
          <Button
            className="bg-success text-success-foreground hover:bg-success/90 rounded-full h-9 text-xs font-semibold cursor-pointer"
            onClick={() => {
              setLancamentoEditando(null);
              setFormTipo('receita');
            }}
          >
            <ArrowUpCircle className="size-4 mr-1.5" /> Recebimento
          </Button>
          <Button
            variant="destructive"
            className="rounded-full h-9 text-xs font-semibold cursor-pointer"
            onClick={() => {
              setLancamentoEditando(null);
              setFormTipo('despesa');
            }}
          >
            <ArrowDownCircle className="size-4 mr-1.5" /> Despesa
          </Button>
        </div>
      </div>

      {erro ? (
        <EmptyState
          icon={Wallet}
          title="Não foi possível abrir o Financeiro"
          description={erro}
          action={{
            label: 'Tentar de novo',
            onClick: () => {
              setCarregando(true);
              void carregar();
            },
          }}
        />
      ) : carregando ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      ) : (
        <>
          {/* ══════════════════ ABA: VISÃO GERAL ══════════════════ */}
          {abaAtiva === 'visao_geral' && (
            <div className="flex flex-col gap-5">
              {/* Hero Card de Saudação + 3 KPIs Principais */}
              <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-xs flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground first-letter:uppercase">{dataHojeFormatada()}</p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">
                      Caixa da Agência
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-xs font-semibold text-foreground">
                      <Building2 className="size-3.5 text-primary" />
                      Competência: <span className="capitalize">{rotuloMes(mes)}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* KPI 1: Saldo geral */}
                  <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs p-4 flex flex-col justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="grid size-7 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                        <Landmark className="size-3.5" />
                      </span>
                      Saldo geral
                    </div>
                    <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                      {formatarReais(saldoTotalGeral)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {contasComSaldo.length > 0
                        ? `Somando ${contasComSaldo.length} conta(s) cadastrada(s)`
                        : 'Cadastre suas contas em Contas & Metas'}
                    </p>
                  </div>

                  {/* KPI 2: Receitas do mês */}
                  <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs p-4 flex flex-col justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="grid size-7 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
                        <TrendingUp className="size-3.5" />
                      </span>
                      Receitas do mês
                    </div>
                    <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatarReais(resumo.receitas)}
                    </p>
                    <div className="flex items-center gap-2">
                      {pctReceitaAnterior !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            pctReceitaAnterior >= 0
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {pctReceitaAnterior >= 0 ? '↗' : '↘'} {pctReceitaAnterior >= 0 ? `+${pctReceitaAnterior}%` : `${pctReceitaAnterior}%`} vs. mês anterior
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Recebido: {formatarReais(resumo.recebido)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* KPI 3: Despesas do mês */}
                  <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs p-4 flex flex-col justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="grid size-7 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
                        <TrendingDown className="size-3.5" />
                      </span>
                      Despesas do mês
                    </div>
                    <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatarReais(resumo.despesas)}
                    </p>
                    <div className="flex items-center gap-2">
                      {pctDespesaAnterior !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            pctDespesaAnterior <= 0
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {pctDespesaAnterior >= 0 ? '↗' : '↘'} {pctDespesaAnterior >= 0 ? `+${pctDespesaAnterior}%` : `${pctDespesaAnterior}%`} vs. mês anterior
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Pago: {formatarReais(resumo.pago)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Inferior em 2 Colunas: Resultado Previsto + Comparativo com Projeção */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Coluna Esquerda: Resultado previsto do mês */}
                <Card padding="lg" className="flex flex-col justify-between gap-5 rounded-3xl">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary">
                          <Wallet className="size-4" />
                        </span>
                        <h3 className="font-display text-base font-bold text-foreground">
                          Resultado previsto do mês
                        </h3>
                      </div>
                      {resumo.atrasados > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[11px] font-bold">
                          {resumo.atrasados} em atraso
                        </span>
                      )}
                    </div>

                    <p
                      className={`font-display text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                        resultadoNegativo ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {formatarReais(resumo.resultado)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Sub-bloco Recebimentos */}
                    <div className="rounded-2xl border border-border/60 bg-accent/35 p-4 flex flex-col gap-2">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Recebimentos
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Recebido</span>
                        <span className="font-mono font-bold tabular-nums text-foreground">
                          {formatarReais(resumo.recebido)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Falta</span>
                        <span className="font-mono font-bold tabular-nums text-foreground">
                          {formatarReais(resumo.faltaReceber)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="font-medium text-muted-foreground">Previsto</span>
                        <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatarReais(resumo.receitas)}
                        </span>
                      </div>
                    </div>

                    {/* Sub-bloco Despesas */}
                    <div className="rounded-2xl border border-border/60 bg-accent/35 p-4 flex flex-col gap-2">
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        Despesas
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Pago</span>
                        <span className="font-mono font-bold tabular-nums text-foreground">
                          {formatarReais(resumo.pago)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Falta</span>
                        <span className="font-mono font-bold tabular-nums text-foreground">
                          {formatarReais(resumo.faltaPagar)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="font-medium text-muted-foreground">Previsto</span>
                        <span className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                          {formatarReais(resumo.despesas)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Coluna Direita: Comparativo com projeção */}
                <Card padding="lg" className="flex flex-col justify-between gap-4 rounded-3xl">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                      <Target className="size-4" />
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">
                        Comparativo com projeção
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2" role="img" aria-label="Receitas e despesas por mês">
                    {serie.map((p) => (
                      <div key={p.mes} className="flex flex-col items-center gap-2">
                        <div className="flex h-44 w-full items-end justify-center gap-2 border-b border-border/50 pb-1">
                          {([['despesas', 'bg-rose-500'], ['receitas', 'bg-emerald-500']] as const).map(([chave, cor]) => (
                            <div
                              key={chave}
                              title={`${chave === 'receitas' ? 'Receitas' : 'Despesas'}: ${formatarReais(p[chave])}`}
                              className={`w-6 sm:w-8 rounded-t-lg transition-all ${cor} ${
                                p.projecao
                                  ? 'opacity-65 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/.25)_4px_8px)]'
                                  : ''
                              }`}
                              style={{ height: `${Math.max(4, (p[chave] / maiorValor) * 100)}%` }}
                            />
                          ))}
                        </div>
                        <span
                          className={`text-xs capitalize ${
                            p.mes === mes ? 'font-bold text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {rotuloMes(p.mes, true)}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {formatarReais(p.saldo)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-rose-500" /> Despesas
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-emerald-500" /> Receitas
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-muted-foreground/50 [background-image:repeating-linear-gradient(135deg,transparent_0_2px,rgb(255_255_255/.5)_2px_4px)]" /> Projeção
                      </span>
                    </div>
                    <p className="text-[11px] text-center text-muted-foreground">
                      Barras listradas indicam projeção: o que já está lançado somado às mensalidades e despesas recorrentes.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ══════════════════ ABA: CONTAS & METAS ══════════════════ */}
          {abaAtiva === 'mais' && (
            <div className="flex flex-col gap-5">
              {/* Bloco de Contas Bancárias & Saldo Geral */}
              <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-accent text-foreground">
                      <Landmark className="size-4" />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground">Contas Bancárias</h3>
                      <p className="text-xs text-muted-foreground">
                        Saldo geral em contas:{' '}
                        <span className="font-bold font-mono text-foreground">{formatarReais(saldoTotalGeral)}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalContaAberto(true)}
                    className="rounded-full h-8 px-3 text-xs font-semibold"
                  >
                    <Plus className="size-3.5 mr-1" /> Nova Conta
                  </Button>
                </div>

                {contasComSaldo.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Nenhuma conta cadastrada ainda. Adicione suas contas (Itaú, Nubank, Caixa) para controlar onde o dinheiro entra e sai.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                    {contasComSaldo.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-accent/20 hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: c.cor || '#10b981' }} />
                          <div className="truncate">
                            <p className="text-xs font-bold text-foreground truncate">{c.nome}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">{c.tipo}</p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-foreground tabular-nums shrink-0">
                          {formatarReais(c.saldo_calculado ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metas por Categoria */}
              <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-brand-text" />
                    <h3 className="font-display text-sm font-bold text-foreground">Metas e Orçamento Mensal</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalCatAberto(true)}
                    className="rounded-full h-8 px-3 text-xs font-semibold"
                  >
                    <Plus className="size-3.5 mr-1" /> Nova Categoria / Meta
                  </Button>
                </div>

                {categorias.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">
                    Defina metas de gastos por categoria para acompanhar o orçamento da agência no mês.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                    {categorias.map((cat) => {
                      const gasto = gastosPorCategoria.get(cat.nome) || 0;
                      const pct = cat.meta_mensal > 0 ? Math.round((gasto / cat.meta_mensal) * 100) : 0;
                      const estourou = cat.meta_mensal > 0 && gasto > cat.meta_mensal;

                      return (
                        <div key={cat.id} className="p-3.5 rounded-2xl border border-border bg-accent/20 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="flex items-center gap-1.5 text-foreground truncate">
                              <span className="size-2 rounded-full" style={{ backgroundColor: cat.cor || '#6b7280' }} />
                              {cat.nome}
                            </span>
                            <span className={`font-mono tabular-nums ${estourou ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                              {formatarReais(gasto)} / {formatarReais(cat.meta_mensal)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${estourou ? 'bg-destructive' : 'bg-primary'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                            <span>{pct}% da meta</span>
                            {estourou && <span className="text-destructive font-bold">Orçamento estourado!</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════ ABA: LANÇAMENTOS ══════════════════ */}
          {abaAtiva === 'lancamentos' && (
            <section className="flex flex-col gap-4" aria-label="Lançamentos do mês">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-foreground">Lançamentos de {rotuloMes(mes)}</h3>
                <div
                  role="group"
                  aria-label="Filtrar lançamentos"
                  className="flex items-center gap-1 rounded-full border border-border bg-accent/40 p-1 flex-wrap self-start sm:self-auto"
                >
                  {(
                    [
                      ['todos', 'Todos'],
                      ['receita', 'Receitas'],
                      ['despesa', 'Despesas'],
                      ['a_receber', 'A Receber'],
                      ['a_pagar', 'A Pagar'],
                    ] as const
                  ).map(([id, rotulo]) => (
                    <SegmentedItem
                      key={id}
                      group="fin-filtro"
                      active={filtro === id}
                      onClick={() => setFiltro(id)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      {rotulo}
                    </SegmentedItem>
                  ))}
                </div>
              </div>

              {visiveis.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nenhum lançamento neste filtro"
                  description="Cadastre a mensalidade nos clientes ou lance uma receita ou despesa."
                  action={{ label: 'Novo recebimento', onClick: () => setFormTipo('receita') }}
                />
              ) : (
                <Card padding="none" className="divide-y divide-border overflow-hidden rounded-3xl">
                  {visiveis.map((l) => {
                    const atrasado = !l.pago && l.vencimento < hoje;
                    const receita = l.tipo === 'receita';
                    const cta = l.conta_id ? mapaContas.get(l.conta_id) : null;

                    return (
                      <div
                        key={l.id}
                        className="flex items-center gap-3 p-3.5 sm:px-5 hover:bg-muted/30 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => void alternarPago(l)}
                          disabled={ocupado === l.id}
                          aria-pressed={l.pago}
                          aria-label={`${
                            l.pago
                              ? receita
                                ? 'Desfazer recebimento'
                                : 'Desfazer pagamento'
                              : receita
                              ? 'Marcar como recebido'
                              : 'Marcar como pago'
                          }: ${l.descricao}`}
                          className={`grid size-10 shrink-0 place-items-center rounded-full border cursor-pointer transition-colors disabled:opacity-50 ${
                            l.pago
                              ? 'border-transparent bg-success text-success-foreground'
                              : 'border-border-strong text-transparent hover:text-muted-foreground'
                          }`}
                        >
                          <Check className="size-4" strokeWidth={2.5} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="truncate text-sm font-semibold text-foreground">{l.descricao}</p>
                            {l.recorrente && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-accent text-accent-foreground border border-border">
                                <RefreshCw className="size-2.5" /> Recorrente
                              </span>
                            )}
                            {cta && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-accent/60 text-muted-foreground border border-border">
                                <span className="size-1.5 rounded-full" style={{ backgroundColor: cta.cor || '#10b981' }} />
                                {cta.nome}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {diaMes(l.vencimento)} · {rotuloCategoria(l.tipo, l.categoria)}
                            {l.cliente_id && l.origem !== 'mensalidade' && nomeCliente.get(l.cliente_id)
                              ? ` · ${nomeCliente.get(l.cliente_id)}`
                              : ''}
                            {atrasado && <span className="font-semibold text-destructive"> · em atraso</span>}
                            {l.pago && <span className="text-success"> · {receita ? 'recebido' : 'pago'}</span>}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            receita ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          {receita ? '+' : '−'}
                          {formatarReais(l.valor)}
                        </span>

                        {/* Botão de Cobrança WhatsApp se atrasado e com cliente */}
                        {atrasado && receita && (
                          <IconButton
                            label="Cobrar via WhatsApp"
                            onClick={() => cobrarClienteWhatsApp(l)}
                            className="text-success hover:bg-success-soft"
                          >
                            <MessageCircle className="size-4" />
                          </IconButton>
                        )}

                        {!l.virtual && (
                          <IconButton
                            label="Editar lançamento"
                            onClick={() => {
                              setLancamentoEditando(l);
                              setFormTipo(l.tipo);
                            }}
                            disabled={ocupado === l.id}
                          >
                            <Edit2 className="size-4 text-muted-foreground" />
                          </IconButton>
                        )}

                        {!l.virtual && (
                          <IconButton
                            label="Excluir lançamento"
                            tone="destructive"
                            onClick={() => void excluir(l)}
                            disabled={ocupado === l.id}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        )}
                      </div>
                    );
                  })}
                </Card>
              )}
            </section>
          )}
        </>
      )}

      {/* Formulário de Criação / Edição de Lançamento */}
      {formTipo && (
        <FormLancamento
          tipoInicial={formTipo}
          lancamentoParaEditar={lancamentoEditando}
          clientes={clientes}
          contas={contas}
          categoriasDisponiveis={categorias}
          mesPadrao={mes}
          onFechar={() => {
            setFormTipo(null);
            setLancamentoEditando(null);
          }}
          onSalvo={async () => {
            setFormTipo(null);
            setLancamentoEditando(null);
            toastRef.current(lancamentoEditando ? 'Lançamento atualizado.' : 'Lançamento salvo.', 'success');
            await carregar();
          }}
          onErro={(m) => toastRef.current(m, 'error')}
        />
      )}

      {/* Modal Nova Conta Bancária */}
      {modalContaAberto && (
        <ModalNovaConta
          onFechar={() => setModalContaAberto(false)}
          onSalvo={async () => {
            setModalContaAberto(false);
            toastRef.current('Conta bancária cadastrada!', 'success');
            await carregar();
          }}
          onErro={(m) => toastRef.current(m, 'error')}
        />
      )}

      {/* Modal Transferência entre Contas */}
      {modalTransfAberto && (
        <ModalTransferencia
          contas={contas}
          onFechar={() => setModalTransfAberto(false)}
          onSalvo={async () => {
            setModalTransfAberto(false);
            toastRef.current('Transferência realizada com sucesso!', 'success');
            await carregar();
          }}
          onErro={(m) => toastRef.current(m, 'error')}
        />
      )}

      {/* Modal Nova Categoria / Meta */}
      {modalCatAberto && (
        <ModalNovaCategoria
          onFechar={() => setModalCatAberto(false)}
          onSalvo={async () => {
            setModalCatAberto(false);
            toastRef.current('Categoria cadastrada com sucesso!', 'success');
            await carregar();
          }}
          onErro={(m) => toastRef.current(m, 'error')}
        />
      )}
    </div>
  );
}

// ==========================================
// FORMULÁRIO DE LANÇAMENTO (CRIAR / EDITAR)
// ==========================================

function FormLancamento({
  tipoInicial,
  lancamentoParaEditar,
  clientes,
  contas,
  categoriasDisponiveis,
  mesPadrao,
  onFechar,
  onSalvo,
  onErro,
}: {
  tipoInicial: TipoLancamento;
  lancamentoParaEditar?: Lancamento | null;
  clientes: ClienteCobranca[];
  contas: ContaBancaria[];
  categoriasDisponiveis: CategoriaFinanceiro[];
  mesPadrao: string;
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
  onErro: (mensagem: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>(() => lancamentoParaEditar?.tipo ?? tipoInicial);
  const [valor, setValor] = useState(() => (lancamentoParaEditar ? String(lancamentoParaEditar.valor) : ''));
  const [descricao, setDescricao] = useState(() => lancamentoParaEditar?.descricao ?? '');
  const [categoria, setCategoria] = useState<string>(() => lancamentoParaEditar?.categoria ?? 'outros');
  const [vencimento, setVencimento] = useState(() =>
    lancamentoParaEditar ? lancamentoParaEditar.vencimento : mesPadrao === mesAtual() ? hojeISO() : `${mesPadrao}-05`
  );
  const [pago, setPago] = useState(() => lancamentoParaEditar?.pago ?? false);
  const [clienteId, setClienteId] = useState(() => lancamentoParaEditar?.cliente_id ?? '');
  const [contaId, setContaId] = useState(() => lancamentoParaEditar?.conta_id ?? '');
  const [recorrente, setRecorrente] = useState(() => lancamentoParaEditar?.recorrente ?? false);
  const [observacoes, setObservacoes] = useState(() => lancamentoParaEditar?.observacoes ?? '');
  const [salvando, setSalvando] = useState(false);

  // Combina categorias fixas com customizadas
  const categoriasPadrao = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const custom = categoriasDisponiveis.filter((c) => c.tipo === tipo);

  const sujo = !!(valor || descricao);

  function trocarTipo(novo: TipoLancamento) {
    setTipo(novo);
    setCategoria('outros');
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    if (v === null) return onErro('Informe um valor maior que zero.');
    if (!descricao.trim()) return onErro('Descreva o lançamento.');
    setSalvando(true);
    try {
      const corpo = {
        tipo,
        descricao: descricao.trim(),
        valor: v,
        vencimento,
        categoria,
        pago,
        cliente_id: clienteId || null,
        conta_id: contaId || null,
        recorrente: tipo === 'despesa' ? recorrente : false,
        observacoes: observacoes.trim() || null,
      };

      const res = lancamentoParaEditar
        ? await fetch(`/api/financeiro/${lancamentoParaEditar.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          })
        : await fetch('/api/financeiro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.');
      await onSalvo();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onFechar}
      dirty={sujo}
      aria-label={lancamentoParaEditar ? 'Editar lançamento' : 'Novo lançamento'}
      className="w-full max-w-lg p-0 overflow-hidden rounded-[32px] border border-border/80 shadow-2xl"
    >
      <form onSubmit={salvar} className="flex max-h-[92dvh] flex-col bg-card max-sm:rounded-b-none">
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <h2 className="font-display text-xl font-light tracking-tight text-foreground">
            {lancamentoParaEditar ? 'Editar' : 'Novo'}{' '}
            <span className="text-lime">{tipo === 'receita' ? 'recebimento' : 'despesa'}</span>
          </h2>

          <div role="group" aria-label="Tipo" className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={tipo === 'despesa' ? 'destructive' : 'secondary'}
              onClick={() => trocarTipo('despesa')}
              aria-pressed={tipo === 'despesa'}
            >
              <ArrowDownCircle className="size-4" /> Despesa
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => trocarTipo('receita')}
              aria-pressed={tipo === 'receita'}
              className={tipo === 'receita' ? 'border-transparent bg-success text-success-foreground hover:bg-success/90' : ''}
            >
              <ArrowUpCircle className="size-4" /> Receita
            </Button>
          </div>

          <Input
            label="Valor (R$)"
            id="fin-valor"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            required
          />
          <Input
            label="Descrição"
            id="fin-descricao"
            placeholder={tipo === 'receita' ? 'Ex.: Projeto de identidade visual' : 'Ex.: Assinatura do Canva'}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={160}
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categoriasPadrao.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              {custom.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Input
              label="Vencimento"
              id="fin-venc"
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Conta bancária" value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Nenhuma / Não definida</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.tipo})
                </option>
              ))}
            </Select>

            <Select label="Cliente vinculado (opcional)" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Nenhum</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>

          {tipo === 'despesa' && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3.5">
              <div>
                <p className="text-sm font-medium text-foreground">Despesa recorrente</p>
                <p className="text-xs text-muted-foreground">Repete todo mês automaticamente na projeção</p>
              </div>
              <Switch checked={recorrente} onCheckedChange={setRecorrente} aria-label="Despesa recorrente" />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3.5">
            <span className="text-sm font-medium text-foreground">
              {tipo === 'receita' ? 'Já foi recebido' : 'Já foi pago'}
            </span>
            <Switch checked={pago} onCheckedChange={setPago} aria-label={tipo === 'receita' ? 'Já foi recebido' : 'Já foi pago'} />
          </div>

          <Input
            label="Observações (opcional)"
            id="fin-obs"
            placeholder="Ex: Nota fiscal enviada, parcelado em 2x..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button type="submit" size="lg" block loading={salvando}>
            {lancamentoParaEditar ? 'Salvar Alterações' : 'Cadastrar Lançamento'}
          </Button>
          <Button type="button" variant="outline" size="lg" block onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// ==========================================
// MODAL: NOVA CONTA BANCÁRIA
// ==========================================

function ModalNovaConta({
  onFechar,
  onSalvo,
  onErro,
}: {
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
  onErro: (m: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'corrente' | 'investimento' | 'caixa' | 'poupanca'>('corrente');
  const [saldo, setSaldo] = useState('');
  const [cor, setCor] = useState('#10b981');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return onErro('Dê um nome à conta bancária.');
    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          tipo,
          saldo_inicial: Number(saldo.replace(',', '.')) || 0,
          cor,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar conta.');
      await onSalvo();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Erro ao cadastrar conta.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 shadow-2xl flex flex-col gap-4 text-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-base font-bold flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Nova Conta Bancária
          </span>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input label="Nome da conta" placeholder="Ex: Itaú Empresa, Nubank PJ" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />

          <Select label="Tipo da conta" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="corrente">Conta Corrente</option>
            <option value="investimento">Investimento / Reserva</option>
            <option value="caixa">Caixa Físico</option>
            <option value="poupanca">Poupança</option>
          </Select>

          <Input label="Saldo inicial (R$)" placeholder="0,00" value={saldo} onChange={(e) => setSaldo(e.target.value)} />

          <div className="flex items-center gap-2 pt-1">
            <label className="text-xs font-semibold text-muted-foreground">Cor de identificação:</label>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="size-8 rounded-lg cursor-pointer border-0 bg-transparent" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" variant="primary" size="sm" loading={salvando}>Salvar Conta</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MODAL: TRANSFERÊNCIA ENTRE CONTAS
// ==========================================

function ModalTransferencia({
  contas,
  onFechar,
  onSalvo,
  onErro,
}: {
  contas: ContaBancaria[];
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
  onErro: (m: string) => void;
}) {
  const [origem, setOrigem] = useState(() => contas[0]?.id || '');
  const [destino, setDestino] = useState(() => contas[1]?.id || '');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    if (!v) return onErro('Informe um valor de transferência válido.');
    if (!origem || !destino) return onErro('Selecione as contas de origem e destino.');
    if (origem === destino) return onErro('A conta de destino deve ser diferente da origem.');

    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conta_origem_id: origem,
          conta_destino_id: destino,
          valor: v,
          data: hojeISO(),
          descricao: descricao.trim() || 'Transferência entre contas',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro na transferência.');
      await onSalvo();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Erro na transferência.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 shadow-2xl flex flex-col gap-4 text-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-base font-bold flex items-center gap-2">
            <ArrowLeftRight className="size-4 text-primary" />
            Transferência entre Contas
          </span>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Select label="Conta Origem (Sai)" value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({formatarReais(c.saldo_calculado ?? c.saldo_inicial)})
              </option>
            ))}
          </Select>

          <Select label="Conta Destino (Entra)" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({formatarReais(c.saldo_calculado ?? c.saldo_inicial)})
              </option>
            ))}
          </Select>

          <Input label="Valor (R$)" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} required autoFocus />
          <Input label="Descrição (opcional)" placeholder="Ex: Reserva mensal, aporte de caixa" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" variant="primary" size="sm" loading={salvando}>Confirmar Transferência</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MODAL: NOVA CATEGORIA COM META MENSAL
// ==========================================

function ModalNovaCategoria({
  onFechar,
  onSalvo,
  onErro,
}: {
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
  onErro: (m: string) => void;
}) {
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [nome, setNome] = useState('');
  const [meta, setMeta] = useState('');
  const [cor, setCor] = useState('#bada55');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return onErro('Dê um nome à categoria.');
    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          nome: nome.trim(),
          meta_mensal: Number(meta.replace(',', '.')) || 0,
          cor,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar categoria.');
      await onSalvo();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Erro ao cadastrar categoria.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 shadow-2xl flex flex-col gap-4 text-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-base font-bold flex items-center gap-2">
            <Target className="size-4 text-primary" />
            Nova Categoria com Meta
          </span>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="despesa">Despesa (Teto de Gastos)</option>
            <option value="receita">Receita (Meta de Faturamento)</option>
          </Select>

          <Input label="Nome da categoria" placeholder="Ex: Tráfego Pago, Infraestrutura" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
          <Input label="Meta mensal (R$)" placeholder="Ex: 1500,00" value={meta} onChange={(e) => setMeta(e.target.value)} />

          <div className="flex items-center gap-2 pt-1">
            <label className="text-xs font-semibold text-muted-foreground">Cor da barra:</label>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="size-8 rounded-lg cursor-pointer border-0 bg-transparent" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" variant="primary" size="sm" loading={salvando}>Salvar Categoria</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
