'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Select } from './select';
import { Sheet } from './sheet';
import { cn } from '@/lib/utils';

export interface FiltroSelect {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  opcoes: { valor: string; rotulo: string }[];
  /** Valor que significa "sem filtro" (padrão "all"); fora dele o filtro conta no botão. */
  padrao?: string;
}

interface FilterBarProps {
  busca: string;
  onBusca: (v: string) => void;
  placeholder?: string;
  filtros?: FiltroSelect[];
  className?: string;
}

/**
 * Busca e filtros que se comportam igual em todas as telas.
 * Desktop: tudo numa linha (busca de 224px e seletores de 192px).
 * Celular: busca na largura toda mais um botão "Filtros n" que abre uma folha
 * com os seletores empilhados, cada um na largura toda e com 44px.
 */
export function FilterBar({ busca, onBusca, placeholder = 'Buscar…', filtros = [], className }: FilterBarProps) {
  const [aberto, setAberto] = useState(false);
  const ativos = filtros.filter((f) => f.valor !== (f.padrao ?? 'all')).length;

  return (
    <div className={cn('flex items-center gap-2 md:flex-wrap md:gap-3', className)}>
      <div className="relative min-w-0 flex-1 md:w-56 md:flex-none">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 md:h-9"
        />
      </div>

      {filtros.length > 0 && (
        <>
          <div className="hidden items-center gap-3 md:flex">
            {filtros.map((f) => (
              <Select key={f.id} value={f.valor} onChange={(e) => f.onChange(e.target.value)} aria-label={f.rotulo} className="h-9 w-48 rounded-xl text-xs">
                {f.opcoes.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </Select>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border-strong bg-card px-3.5 text-sm font-semibold text-foreground cursor-pointer active:bg-accent md:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {ativos > 0 && <span className="grid size-5 place-items-center rounded-full bg-lime text-xs font-bold text-lime-foreground">{ativos}</span>}
          </button>

          <Sheet open={aberto} onClose={() => setAberto(false)} aria-label="Filtros" className="w-full max-w-md">
            <div className="flex flex-col gap-4 p-4 pb-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-foreground">Filtros</h3>
                <button
                  type="button"
                  onClick={() => filtros.forEach((f) => f.onChange(f.padrao ?? 'all'))}
                  className="h-10 px-2 text-sm font-semibold text-muted-foreground cursor-pointer"
                >
                  Limpar
                </button>
              </div>
              {filtros.map((f) => (
                <label key={f.id} className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  {f.rotulo}
                  <Select value={f.valor} onChange={(e) => f.onChange(e.target.value)} className="h-11 w-full text-sm">
                    {f.opcoes.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
              <button type="button" onClick={() => setAberto(false)} className="h-12 rounded-full bg-lime text-base font-bold text-lime-foreground cursor-pointer">
                Concluir
              </button>
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}
