'use client';

import React, { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, Plus, Tag, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { alternarEtiqueta, COR_PADRAO, CORES_ETIQUETA, corDaEtiqueta, type CorEtiqueta, type Etiqueta } from '@/lib/etiquetas';

interface EtiquetasSeletorProps {
  etiquetas: Etiqueta[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
  onCriar: (nome: string, cor: CorEtiqueta) => Promise<Etiqueta | null>;
  onApagar: (id: string) => Promise<void>;
}

/** Chip "Etiqueta" da demanda: lista com marcação, criar e apagar (popover). */
export function EtiquetasSeletor({ etiquetas, selecionadas, onChange, onCriar, onApagar }: EtiquetasSeletorProps) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState<CorEtiqueta>(COR_PADRAO);
  const [salvando, setSalvando] = useState(false);

  const aplicadas = etiquetas.filter((e) => selecionadas.includes(e.id));

  async function criar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    const nova = await onCriar(nome, cor);
    setSalvando(false);
    if (nova) {
      onChange([...selecionadas, nova.id]);
      setNome('');
      setCor(COR_PADRAO);
      setCriando(false);
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/60 px-2.5 py-0.5 text-xs font-semibold text-foreground cursor-pointer hover:bg-accent data-popup-open:bg-accent"
        aria-label="Etiquetas da demanda"
      >
        <Tag aria-hidden className="size-3 text-muted-foreground" />
        {aplicadas.length === 0 ? (
          'Etiqueta'
        ) : (
          <span className="flex items-center gap-1">
            {aplicadas.slice(0, 2).map((e) => (
              <span key={e.id} className={cn('size-2 rounded-full', corDaEtiqueta(e.cor).dot)} aria-hidden />
            ))}
            {aplicadas.length === 1 ? aplicadas[0].nome : `${aplicadas.length} etiquetas`}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-[90]">
          <Popover.Popup className="w-64 rounded-2xl border border-border-strong bg-popover p-2 text-popover-foreground shadow-xl outline-none">
            <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted-foreground">Etiquetas</p>
            {etiquetas.length === 0 && !criando && (
              <p className="px-2 pb-2 text-xs text-muted-foreground">Crie etiquetas para organizar as demandas do seu jeito.</p>
            )}
            <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {etiquetas.map((e) => {
                const marcada = selecionadas.includes(e.id);
                return (
                  <li key={e.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(alternarEtiqueta(selecionadas, e.id))}
                      aria-pressed={marcada}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm cursor-pointer hover:bg-accent"
                    >
                      <span className={cn('size-2.5 shrink-0 rounded-full', corDaEtiqueta(e.cor).dot)} aria-hidden />
                      <span className="flex-1 truncate">{e.nome}</span>
                      {marcada && <Check aria-hidden className="size-4 shrink-0 text-brand-text" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onApagar(e.id)}
                      aria-label={`Apagar a etiqueta ${e.nome}`}
                      className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 cursor-pointer hover:bg-destructive-soft hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {criando ? (
              <div className="mt-1 flex flex-col gap-2 rounded-xl border border-border p-2">
                <input
                  autoFocus
                  value={nome}
                  maxLength={40}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void criar();
                    }
                  }}
                  placeholder="Nome da etiqueta"
                  aria-label="Nome da nova etiqueta"
                  className="h-9 w-full rounded-full border border-input bg-card px-3 text-sm outline-none focus:border-ring"
                />
                <div role="radiogroup" aria-label="Cor" className="flex items-center gap-1.5">
                  {(Object.keys(CORES_ETIQUETA) as CorEtiqueta[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={cor === c}
                      aria-label={CORES_ETIQUETA[c].rotulo}
                      onClick={() => setCor(c)}
                      className={cn('size-6 rounded-full cursor-pointer ring-offset-2 ring-offset-popover', CORES_ETIQUETA[c].dot, cor === c && 'ring-2 ring-foreground')}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCriando(false)} className="h-8 flex-1 rounded-full border border-border text-xs font-semibold cursor-pointer hover:bg-accent">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void criar()}
                    disabled={!nome.trim() || salvando}
                    className="h-8 flex-1 rounded-full bg-primary text-xs font-semibold text-primary-foreground cursor-pointer disabled:opacity-50"
                  >
                    Criar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong/70 py-2 text-sm font-medium text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground"
              >
                <Plus aria-hidden className="size-4" /> Criar etiqueta
              </button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
