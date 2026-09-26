'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Search, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComandoItem {
  id: string;
  label: string;
  /** Texto de apoio à direita (ex.: "Tela", "@conta"). */
  hint?: string;
  grupo: string;
  icon?: React.ElementType;
  /** Palavras extras que também encontram o item. */
  keywords?: string;
  run: () => void;
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Busca rápida (Ctrl+K / ⌘K): ir para qualquer tela, trocar de conta e
 * disparar ações comuns sem tirar a mão do teclado. Referência de
 * comportamento: Command Palette do Spectrum UI / Linear.
 */
export function CommandPalette({
  open,
  onOpenChange,
  itens,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itens: ComandoItem[];
}) {
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return itens;
    const termos = q.split(/\s+/);
    return itens.filter((it) => {
      const alvo = normalizar(`${it.label} ${it.hint ?? ''} ${it.grupo} ${it.keywords ?? ''}`);
      return termos.every((t) => alvo.includes(t));
    });
  }, [busca, itens]);

  const grupos = useMemo(() => {
    const map = new Map<string, { item: ComandoItem; index: number }[]>();
    filtrados.forEach((item, index) => {
      if (!map.has(item.grupo)) map.set(item.grupo, []);
      map.get(item.grupo)!.push({ item, index });
    });
    return Array.from(map.entries());
  }, [filtrados]);

  const fechar = () => onOpenChange(false);

  const executar = (item: ComandoItem | undefined) => {
    if (!item) return;
    fechar();
    // deixa o dialog começar a fechar antes (foco volta pro app)
    setTimeout(item.run, 0);
  };

  const mover = (delta: number) => {
    if (filtrados.length === 0) return;
    const next = (ativo + delta + filtrados.length) % filtrados.length;
    setAtivo(next);
    listaRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setBusca('');
          setAtivo(0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[75] bg-foreground/20 dark:bg-black/60 backdrop-blur-[2px] transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[75] flex items-start justify-center px-4 pt-[12vh]">
          <Dialog.Popup
            aria-label="Busca rápida"
            className="w-full max-w-xl rounded-2xl border border-border-strong bg-popover text-popover-foreground shadow-2xl overflow-hidden outline-none transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-starting-style:opacity-0 data-starting-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:duration-100"
          >
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search aria-hidden className="size-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setAtivo(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    mover(1);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    mover(-1);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    executar(filtrados[ativo]);
                  }
                }}
                placeholder="Buscar tela, conta ou ação…"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={filtrados[ativo] ? `cmd-${filtrados[ativo].id}` : undefined}
                className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <kbd className="hidden sm:inline rounded border border-border-strong bg-muted px-1.5 text-[11px] text-muted-foreground">Esc</kbd>
            </div>

            <div ref={listaRef} id="command-palette-list" role="listbox" aria-label="Resultados" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              {filtrados.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado para “{busca}”.</p>
              ) : (
                grupos.map(([grupo, entradas]) => (
                  <div key={grupo} role="group" aria-label={grupo} className="mb-1 last:mb-0">
                    <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{grupo}</div>
                    {entradas.map(({ item, index }) => {
                      const Icon = item.icon;
                      const selecionado = index === ativo;
                      return (
                        <div
                          key={item.id}
                          id={`cmd-${item.id}`}
                          data-index={index}
                          role="option"
                          aria-selected={selecionado}
                          onMouseMove={() => setAtivo(index)}
                          onClick={() => executar(item)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm cursor-pointer select-none',
                            selecionado ? 'bg-accent text-foreground' : 'text-foreground/90'
                          )}
                        >
                          {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : <span className="size-4 shrink-0" />}
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.hint && <span className="text-xs text-muted-foreground truncate max-w-[40%]">{item.hint}</span>}
                          {selecionado && <CornerDownLeft aria-hidden className="size-3.5 text-muted-foreground shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span><kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> navegar</span>
              <span><kbd className="font-sans">Enter</kbd> abrir</span>
              <span className="ml-auto hidden sm:inline">Ctrl K abre de qualquer tela</span>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
