'use client';

import React from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarGroup } from './avatar';
import { Checkbox } from './checkbox';
import type { MembroOption } from './member-chip-select';

/**
 * Seleção de vários membros (co-responsáveis). O gatilho mostra os avatares
 * empilhados; a lista fica aberta enquanto a pessoa marca/desmarca.
 * `excluirId` esconde quem já é o responsável principal.
 */
export interface MemberMultiSelectProps {
  label?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  membros: MembroOption[];
  excluirId?: string;
  placeholder?: string;
  className?: string;
}

export function MemberMultiSelect({
  label,
  value,
  onChange,
  membros,
  excluirId,
  placeholder = 'Adicionar pessoas...',
  className,
}: MemberMultiSelectProps) {
  const opcoes = membros.filter((m) => m.id !== excluirId);
  const selecionados = value
    .filter((id) => id !== excluirId)
    .map((id) => membros.find((m) => m.id === id))
    .filter((m): m is MembroOption => !!m);

  const alternar = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value.filter((v) => v !== excluirId), id]);

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
      <Popover.Root>
        <Popover.Trigger
          className={cn(
            'group/mm h-8 w-full px-2.5 rounded-xl border text-xs flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs text-left',
            'border-border transition-[background-color,border-color,box-shadow] duration-150',
            'hover:bg-accent/40 hover:border-foreground/30',
            'data-[popup-open]:ring-2 data-[popup-open]:ring-primary/20 data-[popup-open]:border-primary/50',
            selecionados.length ? 'bg-accent/40 text-foreground' : 'bg-background/80 text-muted-foreground'
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {selecionados.length ? (
              <>
                <AvatarGroup pessoas={selecionados} size="xs" max={3} />
                <span className="truncate font-semibold">
                  {selecionados.length === 1 ? selecionados[0].nome : `${selecionados.length} pessoas`}
                </span>
              </>
            ) : (
              <>
                <Users className="size-3.5 shrink-0" />
                <span className="truncate font-medium">{placeholder}</span>
              </>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/mm:rotate-180" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="z-[80]">
            <Popover.Popup
              className={cn(
                'w-[max(var(--anchor-width),15rem)] rounded-2xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-lg backdrop-blur-xl outline-none',
                'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
                'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
                'data-[ending-style]:opacity-0 data-[ending-style]:scale-95'
              )}
            >
              <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
                {opcoes.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">Ninguém mais na equipe.</p>
                )}
                {opcoes.map((m) => {
                  const marcado = value.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 cursor-pointer select-none transition-colors',
                        marcado ? 'bg-muted' : 'hover:bg-muted/60'
                      )}
                    >
                      <Checkbox checked={marcado} onCheckedChange={() => alternar(m.id)} aria-label={m.nome} />
                      <Avatar nome={m.nome} src={m.foto_url} size="xs" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-xs font-semibold leading-tight">{m.nome}</span>
                        {m.cargo && <span className="truncate text-[11px] text-muted-foreground leading-tight">{m.cargo}</span>}
                      </span>
                    </label>
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
