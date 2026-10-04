'use client';

import React from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown, Star, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarGroup } from './avatar';
import { Checkbox } from './checkbox';
import type { MembroOption } from './member-chip-select';

/**
 * Seletor único dos responsáveis de uma demanda. A ordem importa: o primeiro
 * da lista é o responsável principal (`responsavel_id`) e os demais viram
 * `co_responsaveis_ids`. A estrela ao lado de quem está marcado troca o
 * principal. Desmarcar o principal promove o próximo da lista.
 */
export interface ResponsaveisSelectProps {
  label?: string;
  /** Ids em ordem: [principal, ...demais]. */
  value: string[];
  onChange: (ids: string[]) => void;
  membros: MembroOption[];
  placeholder?: string;
  className?: string;
}

export function ResponsaveisSelect({
  label,
  value,
  onChange,
  membros,
  placeholder = 'Atribuir pessoas...',
  className,
}: ResponsaveisSelectProps) {
  const selecionados = value
    .map((id) => membros.find((m) => m.id === id))
    .filter((m): m is MembroOption => !!m);
  const principal = selecionados[0];

  const alternar = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const tornarPrincipal = (id: string) => onChange([id, ...value.filter((v) => v !== id)]);

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
      <Popover.Root>
        <Popover.Trigger
          className={cn(
            'group/rs h-8 w-full px-2.5 rounded-xl border text-xs flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs text-left',
            'border-border transition-[background-color,border-color,box-shadow] duration-150',
            'hover:bg-accent/40 hover:border-foreground/30',
            'data-[popup-open]:ring-2 data-[popup-open]:ring-primary/20 data-[popup-open]:border-primary/50',
            selecionados.length ? 'bg-accent/40 text-foreground' : 'bg-background/80 text-muted-foreground'
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {principal ? (
              <>
                <AvatarGroup pessoas={selecionados} size="xs" max={3} />
                <span className="truncate font-semibold">{principal.nome}</span>
                {selecionados.length > 1 && (
                  <span className="shrink-0 text-muted-foreground tabular-nums">+{selecionados.length - 1}</span>
                )}
              </>
            ) : (
              <>
                <Users className="size-3.5 shrink-0" />
                <span className="truncate font-medium">{placeholder}</span>
              </>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/rs:rotate-180" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="z-[80]">
            <Popover.Popup
              className={cn(
                'w-[max(var(--anchor-width),16rem)] rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none',
                'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
                'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
                'data-[ending-style]:opacity-0 data-[ending-style]:scale-95'
              )}
            >
              <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
                Marque quem trabalha na demanda. A estrela indica o responsável principal.
              </p>
              <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
                {membros.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">Ninguém na equipe ainda.</p>
                )}
                {membros.map((m) => {
                  const marcado = value.includes(m.id);
                  const ehPrincipal = principal?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center gap-1 rounded-lg pr-1 transition-colors',
                        marcado ? 'bg-muted' : 'hover:bg-muted/60'
                      )}
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 cursor-pointer select-none">
                        <Checkbox checked={marcado} onCheckedChange={() => alternar(m.id)} aria-label={m.nome} />
                        <Avatar nome={m.nome} src={m.foto_url} size="xs" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-semibold leading-tight">{m.nome}</span>
                          {ehPrincipal ? (
                            <span className="truncate text-xs text-brand-text leading-tight">Principal</span>
                          ) : (
                            m.cargo && <span className="truncate text-xs text-muted-foreground leading-tight">{m.cargo}</span>
                          )}
                        </span>
                      </label>
                      {marcado && (
                        <button
                          type="button"
                          onClick={() => tornarPrincipal(m.id)}
                          disabled={ehPrincipal}
                          aria-pressed={ehPrincipal}
                          aria-label={ehPrincipal ? `${m.nome} é o responsável principal` : `Tornar ${m.nome} o responsável principal`}
                          className={cn(
                            'shrink-0 rounded-md p-1.5 transition-colors',
                            ehPrincipal
                              ? 'text-brand-text cursor-default'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer'
                          )}
                        >
                          <Star className={cn('size-3.5', ehPrincipal && 'fill-current')} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {selecionados.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border-t border-border pt-2 pb-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-3" /> Remover todos
                </button>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
