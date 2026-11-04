'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Check, ChevronLeft, ChevronRight, Trash2, Wallet } from 'lucide-react';
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
  type Lancamento,
  type TipoLancamento,
} from '@/lib/financeiro';

interface FinanceiroTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

type Filtro = 'todos' | TipoLancamento;

const hojeISO = () => new Date().toISOString().slice(0, 10);

function diaMes(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default function FinanceiroTab({ showToast }: FinanceiroTabProps) {
  const toastRef = useRef(showToast);
  useEffect(() => {
    toastRef.current = showToast;
  });

  const [mes, setMes] = useState(() => mesAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<ClienteCobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [formTipo, setFormTipo] = useState<TipoLancamento | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/financeiro?de=${somarMeses(mes, -1)}&ate=${somarMeses(mes, 2)}`);
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'Não foi possível carregar o Financeiro.');
      setErro(null);
      setLancamentos(corpo.lancamentos ?? []);
      setClientes(corpo.clientes ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o Financeiro.');
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    // Busca ao abrir e ao trocar de mês; os setState acontecem depois do await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const visiveis = useMemo(() => (filtro === 'todos' ? doMes : doMes.filter((l) => l.tipo === filtro)), [doMes, filtro]);
  const nomeCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  async function alternarPago(l: Lancamento) {
    setOcupado(l.id);
    try {
      const res = l.origem === 'mensalidade'
        ? await fetch('/api/financeiro/mensalidade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: l.cliente_id, mes: (l.competencia ?? l.vencimento).slice(0, 7), pago: !l.pago }),
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

  const maiorValor = Math.max(1, ...serie.flatMap((p) => [p.receitas, p.despesas]));
  const resultadoNegativo = resumo.resultado < 0;

  return (
    <div className="flex flex-col gap-5 pb-12 max-w-6xl mx-auto animate-fade-in">
      {/* Mês + ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 self-start rounded-full border border-border bg-card p-1">
          <IconButton label="Mês anterior" onClick={() => irParaMes(-1)} className="rounded-full">
            <ChevronLeft />
          </IconButton>
          <span className="min-w-36 text-center text-sm font-semibold text-foreground first-letter:uppercase">{rotuloMes(mes)}</span>
          <IconButton label="Próximo mês" onClick={() => irParaMes(1)} className="rounded-full">
            <ChevronRight />
          </IconButton>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setFormTipo('receita')}>
            <ArrowUpCircle className="size-4" /> Recebimento
          </Button>
          <Button variant="destructive" onClick={() => setFormTipo('despesa')}>
            <ArrowDownCircle className="size-4" /> Despesa
          </Button>
        </div>
      </div>

      {erro ? (
        <EmptyState
          icon={Wallet}
          title="Não foi possível abrir o Financeiro"
          description={erro}
          action={{ label: 'Tentar de novo', onClick: () => { setCarregando(true); void carregar(); } }}
        />
      ) : carregando ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Resultado do mês */}
          <Card padding="lg" className="flex flex-col gap-4 bg-panel text-panel-foreground border-transparent">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-lime text-lime-foreground">
                <Wallet className="size-5" strokeWidth={1.75} />
              </span>
              <span className="text-sm text-panel-foreground/70">Resultado previsto de {rotuloMes(mes)}</span>
            </div>
            <p className={`font-display text-4xl sm:text-5xl font-light tracking-tight tabular-nums ${resultadoNegativo ? 'text-destructive' : ''}`}>
              {formatarReais(resumo.resultado)}
            </p>
            <p className="text-sm text-panel-foreground/70">
              Receitas {formatarReais(resumo.receitas)} e despesas {formatarReais(resumo.despesas)}
              {resumo.atrasados > 0 && <span className="text-destructive"> · {resumo.atrasados} em atraso</span>}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Receitas do mês" value={formatarReais(resumo.receitas)} sentence={`Recebido ${formatarReais(resumo.recebido)}`} sentenceTone="success" />
            <StatCard label="Despesas do mês" value={formatarReais(resumo.despesas)} sentence={`Pago ${formatarReais(resumo.pago)}`} />
            <StatCard label="Falta receber" value={formatarReais(resumo.faltaReceber)} sentence="Mensalidades e recebimentos em aberto" />
            <StatCard label="Falta pagar" value={formatarReais(resumo.faltaPagar)} sentence="Despesas ainda não quitadas" sentenceTone={resumo.faltaPagar > 0 ? 'destructive' : 'muted'} />
          </div>

          {/* Comparativo com projeção */}
          <Card padding="lg" className="flex flex-col gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">Comparativo com projeção</h3>
              <p className="text-xs text-muted-foreground">
                Mês anterior, atual e próximo. Barras listradas são projeção: o que já está lançado mais as mensalidades dos clientes.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3" role="img" aria-label="Receitas e despesas por mês">
              {serie.map((p) => (
                <div key={p.mes} className="flex flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end justify-center gap-2">
                    {([['receitas', 'bg-success'], ['despesas', 'bg-destructive']] as const).map(([chave, cor]) => (
                      <div
                        key={chave}
                        title={`${chave === 'receitas' ? 'Receitas' : 'Despesas'}: ${formatarReais(p[chave])}`}
                        className={`w-6 sm:w-8 rounded-t-lg ${cor} ${p.projecao ? 'opacity-60 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgb(0_0_0/.25)_4px_8px)]' : ''}`}
                        style={{ height: `${Math.max(3, (p[chave] / maiorValor) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <span className={`text-xs capitalize ${p.mes === mes ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{rotuloMes(p.mes, true)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatarReais(p.saldo)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" /> Receitas</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive" /> Despesas</span>
            </div>
          </Card>

          {/* Lançamentos */}
          <section className="flex flex-col gap-3" aria-label="Lançamentos do mês">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-foreground">Lançamentos</h3>
              <div role="group" aria-label="Filtrar lançamentos" className="flex items-center gap-1 rounded-full border border-border bg-accent/40 p-1">
                {([['todos', 'Todos'], ['receita', 'Receitas'], ['despesa', 'Despesas']] as const).map(([id, rotulo]) => (
                  <SegmentedItem key={id} group="fin-filtro" active={filtro === id} onClick={() => setFiltro(id)} className="rounded-full px-3 py-1.5 text-xs font-semibold">
                    {rotulo}
                  </SegmentedItem>
                ))}
              </div>
            </div>

            {visiveis.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento neste mês"
                description="Cadastre a mensalidade nos clientes ou lance uma receita ou despesa."
                action={{ label: 'Novo recebimento', onClick: () => setFormTipo('receita') }}
              />
            ) : (
              <Card padding="none" className="divide-y divide-border overflow-hidden">
                {visiveis.map((l) => {
                  const atrasado = !l.pago && l.vencimento < hoje;
                  const receita = l.tipo === 'receita';
                  return (
                    <div key={l.id} className="flex items-center gap-3 p-3.5 sm:px-5">
                      <button
                        type="button"
                        onClick={() => void alternarPago(l)}
                        disabled={ocupado === l.id}
                        aria-pressed={l.pago}
                        aria-label={`${l.pago ? (receita ? 'Desfazer recebimento' : 'Desfazer pagamento') : receita ? 'Marcar como recebido' : 'Marcar como pago'}: ${l.descricao}`}
                        className={`grid size-10 shrink-0 place-items-center rounded-full border cursor-pointer transition-colors disabled:opacity-50 ${
                          l.pago ? 'border-transparent bg-success text-success-foreground' : 'border-border-strong text-transparent hover:text-muted-foreground'
                        }`}
                      >
                        <Check className="size-4" strokeWidth={2.5} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{l.descricao}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {diaMes(l.vencimento)} · {rotuloCategoria(l.tipo, l.categoria)}
                          {l.cliente_id && l.origem !== 'mensalidade' && nomeCliente.get(l.cliente_id) ? ` · ${nomeCliente.get(l.cliente_id)}` : ''}
                          {atrasado && <span className="font-semibold text-destructive"> · em atraso</span>}
                          {l.pago && <span className="text-success"> · {receita ? 'recebido' : 'pago'}</span>}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${receita ? 'text-success' : 'text-destructive'}`}>
                        {receita ? '+' : '−'}{formatarReais(l.valor)}
                      </span>
                      {!l.virtual && (
                        <IconButton label="Excluir lançamento" tone="destructive" onClick={() => void excluir(l)} disabled={ocupado === l.id}>
                          <Trash2 />
                        </IconButton>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
        </>
      )}

      {formTipo && (
        <FormLancamento
          tipoInicial={formTipo}
          clientes={clientes}
          mesPadrao={mes}
          onFechar={() => setFormTipo(null)}
          onSalvo={async () => {
            setFormTipo(null);
            toastRef.current('Lançamento salvo.', 'success');
            await carregar();
          }}
          onErro={(m) => toastRef.current(m, 'error')}
        />
      )}
    </div>
  );
}

function FormLancamento({
  tipoInicial,
  clientes,
  mesPadrao,
  onFechar,
  onSalvo,
  onErro,
}: {
  tipoInicial: TipoLancamento;
  clientes: ClienteCobranca[];
  mesPadrao: string;
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
  onErro: (mensagem: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>(tipoInicial);
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<string>('outros');
  const [vencimento, setVencimento] = useState(() => (mesPadrao === mesAtual() ? hojeISO() : `${mesPadrao}-05`));
  const [pago, setPago] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const categorias = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
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
      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          descricao: descricao.trim(),
          valor: v,
          vencimento,
          categoria,
          pago,
          cliente_id: clienteId || null,
        }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'Não foi possível salvar.');
      await onSalvo();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open onClose={onFechar} dirty={sujo} aria-label="Novo lançamento" className="w-full max-w-lg p-0 overflow-hidden rounded-[32px] border border-border/80 shadow-2xl">
      <form onSubmit={salvar} className="flex max-h-[92dvh] flex-col bg-card max-sm:rounded-b-none">
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <h2 className="font-display text-xl font-light tracking-tight text-foreground">
            Novo <span className="text-lime">lançamento</span>
          </h2>

          <div role="group" aria-label="Tipo" className="grid grid-cols-2 gap-2">
            <Button type="button" variant={tipo === 'despesa' ? 'destructive' : 'secondary'} onClick={() => trocarTipo('despesa')} aria-pressed={tipo === 'despesa'}>
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

          <Input label="Valor (R$)" id="fin-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus required />
          <Input label="Descrição" id="fin-descricao" placeholder={tipo === 'receita' ? 'Ex.: Projeto de identidade visual' : 'Ex.: Assinatura do Canva'} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={160} required />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
            <Input label="Vencimento" id="fin-venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
          </div>

          <Select label="Cliente (opcional)" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Nenhum</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3.5">
            <span className="text-sm font-medium text-foreground">{tipo === 'receita' ? 'Já foi recebido' : 'Já foi pago'}</span>
            <Switch checked={pago} onCheckedChange={setPago} aria-label={tipo === 'receita' ? 'Já foi recebido' : 'Já foi pago'} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button type="submit" size="lg" block loading={salvando}>Salvar</Button>
          <Button type="button" variant="outline" size="lg" block onClick={onFechar}>Cancelar</Button>
        </div>
      </form>
    </Sheet>
  );
}
