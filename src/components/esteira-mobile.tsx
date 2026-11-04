'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, Columns3, Grid3X3, Layers, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

/** Peças da esteira só para o celular: nada aqui rola para os lados. */

export type ModoVisualizacao = 'kanban' | 'list' | 'feed';

interface FiltrosMobileProps {
  aberto: boolean;
  onFechar: () => void;
  clientes: { id: string; nome: string }[];
  clienteTravado: boolean;
  clienteSelecionado: string;
  onCliente: (id: string) => void;
  membros: { id: string; nome: string }[];
  responsavel: string;
  onResponsavel: (id: string) => void;
  modo: ModoVisualizacao;
  onModo: (m: ModoVisualizacao) => void;
  mostrarPublicados: boolean;
  onMostrarPublicados: (v: boolean) => void;
  totalPublicados: number;
  sincronizando: boolean;
  onSincronizar: () => void;
}

const MODOS: { id: ModoVisualizacao; rotulo: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'kanban', rotulo: 'Etapas', icon: Columns3 },
  { id: 'list', rotulo: 'Lista', icon: Layers },
  { id: 'feed', rotulo: 'Feed', icon: Grid3X3 },
];

/** Quantos filtros estão fora do padrão, para o contador do botão. */
export function contarFiltros(f: { clienteSelecionado: string; clienteTravado: boolean; responsavel: string; modo: ModoVisualizacao }): number {
  return (f.clienteTravado || f.clienteSelecionado === 'all' ? 0 : 1) + (f.responsavel === 'all' ? 0 : 1) + (f.modo === 'kanban' ? 0 : 1);
}

export function BotaoFiltros({ quantidade, onClick }: { quantidade: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border-strong bg-card px-3.5 text-sm font-semibold text-foreground cursor-pointer active:bg-accent"
    >
      <SlidersHorizontal className="size-4" aria-hidden />
      Filtros
      {quantidade > 0 && <span className="grid size-5 place-items-center rounded-full bg-lime text-xs font-bold text-lime-foreground">{quantidade}</span>}
    </button>
  );
}

export function FiltrosMobile(p: FiltrosMobileProps) {
  return (
    <Sheet open={p.aberto} onClose={p.onFechar} aria-label="Filtros" className="w-full max-w-md">
      <div className="flex flex-col gap-4 p-4 pb-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-foreground">Filtros</h3>
          <button
            type="button"
            onClick={() => {
              p.onCliente('all');
              p.onResponsavel('all');
              p.onModo('kanban');
            }}
            className="h-10 px-2 text-sm font-semibold text-muted-foreground cursor-pointer"
          >
            Limpar
          </button>
        </div>

        {!p.clienteTravado && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Cliente
            <Select value={p.clienteSelecionado} onChange={(e) => p.onCliente(e.target.value)} className="h-11 text-sm">
              <option value="all">Todos os clientes</option>
              {p.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </label>
        )}

        {p.membros.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Equipe
            <Select value={p.responsavel} onChange={(e) => p.onResponsavel(e.target.value)} className="h-11 text-sm">
              <option value="all">Toda a equipe</option>
              {p.membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </label>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Visualização</span>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
            {MODOS.map(({ id, rotulo, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => p.onModo(id)}
                aria-pressed={p.modo === id}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold cursor-pointer ${
                  p.modo === id ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {p.totalPublicados > 0 && (
          <div className="flex min-h-12 items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">
              Mostrar publicados <span className="text-muted-foreground">({p.totalPublicados})</span>
            </span>
            <Switch checked={p.mostrarPublicados} onCheckedChange={p.onMostrarPublicados} aria-label="Mostrar publicados" />
          </div>
        )}

        <button
          type="button"
          onClick={p.onSincronizar}
          disabled={p.sincronizando}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border-strong text-sm font-semibold text-foreground cursor-pointer disabled:opacity-60"
        >
          <Sparkles className={`size-4 text-brand-text ${p.sincronizando ? 'animate-spin' : ''}`} aria-hidden />
          {p.sincronizando ? 'Sincronizando com o Notion...' : 'Sincronizar com o Notion'}
        </button>

        <button type="button" onClick={p.onFechar} className="h-12 rounded-full bg-lime text-base font-bold text-lime-foreground cursor-pointer">
          Concluir
        </button>
      </div>
    </Sheet>
  );
}

interface Etapa {
  id: string;
  rotulo: string;
  total: number;
}

/** Um botão com a etapa atual; abre a lista das 13 etapas. Substitui a fileira de chips que rolava para o lado. */
export function SeletorEtapaMobile({ etapas, atual, onEscolher }: { etapas: Etapa[]; atual: string; onEscolher: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const etapa = etapas.find((e) => e.id === atual) ?? etapas[0];
  if (!etapa) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        className="flex h-12 w-full items-center justify-between rounded-2xl border border-border-strong bg-card px-4 text-left cursor-pointer active:bg-accent"
      >
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">Etapa</span>
          <span className="block truncate text-base font-semibold text-foreground">{etapa.rotulo}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-accent px-2 text-sm font-semibold tabular-nums text-foreground">{etapa.total}</span>
          <ChevronDown className="size-5 text-muted-foreground" aria-hidden />
        </span>
      </button>

      <Sheet open={aberto} onClose={() => setAberto(false)} aria-label="Escolher etapa" className="w-full max-w-md">
        <div className="flex flex-col p-4 pb-5">
          <h3 className="px-1 pb-2 font-display text-xl font-semibold text-foreground">Etapa</h3>
          <ul className="flex flex-col overflow-y-auto">
            {etapas.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onEscolher(e.id);
                    setAberto(false);
                  }}
                  aria-current={e.id === atual ? 'true' : undefined}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left cursor-pointer active:bg-accent"
                >
                  <span className={`flex items-center gap-2 text-base ${e.id === atual ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                    {e.id === atual && <Check className="size-4 text-brand-text" aria-hidden />}
                    {e.rotulo}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{e.total}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
