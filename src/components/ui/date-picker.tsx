'use client';

import React, { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldInputClass } from '@/lib/form-styles';

/**
 * Seletor de data no estilo HeroUI: popover com grade do mês, transição
 * lateral ao trocar de mês, destaque de hoje e atalhos "Hoje"/"Limpar".
 *
 * Trabalha com string 'YYYY-MM-DD', igual ao <input type="date">, e dispara
 * `onChange` com um evento compatível (`e.target.value`) — por isso o
 * <Input type="date"> delega para cá sem mudar nenhuma tela.
 */
export interface DatePickerProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s?: string) => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const fmtLong = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

const monthLabel = (d: Date) => {
  const t = fmtMonth.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function DatePicker({
  value,
  onChange,
  id,
  name,
  disabled,
  required,
  min,
  max,
  placeholder = 'Selecionar data',
  className,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const selected = parseISO(value);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => selected ?? new Date());
  const [dir, setDir] = useState(0);
  const todayISO = toISO(new Date());

  const emit = (v: string) => {
    onChange?.({
      target: { value: v, name: name ?? '', id: id ?? '' },
      currentTarget: { value: v, name: name ?? '', id: id ?? '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const pick = (d: Date) => {
    emit(toISO(d));
    setOpen(false);
  };

  const shift = (delta: number) => {
    setDir(delta);
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));
  };

  const outOfRange = (iso: string) => (!!min && iso < min) || (!!max && iso > max);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setAnchor(selected ?? new Date());
        setOpen(next);
      }}
    >
      <Popover.Trigger
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          fieldInputClass,
          'group/date flex items-center gap-2 text-left cursor-pointer hover:border-border-strong',
          'data-[popup-open]:border-ring data-[popup-open]:ring-2 data-[popup-open]:ring-ring/25',
          className
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground group-data-[popup-open]/date:text-primary transition-colors" />
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? fmtLong.format(selected).replace(/\./g, '') : placeholder}
        </span>
      </Popover.Trigger>
      {name && <input type="hidden" name={name} value={value ?? ''} required={required} />}
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-[80]">
          <Popover.Popup
            className={cn(
              'w-72 rounded-2xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-lg backdrop-blur-xl outline-none',
              'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
              'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
              'data-[ending-style]:opacity-0 data-[ending-style]:scale-95'
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shift(-1)}
                aria-label="Mês anterior"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-semibold">{monthLabel(anchor)}</span>
              <button
                type="button"
                onClick={() => shift(1)}
                aria-label="Próximo mês"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground mb-1">
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="py-1">{d}</span>
              ))}
            </div>

            <div className="relative overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={`${anchor.getFullYear()}-${anchor.getMonth()}`}
                  custom={dir}
                  initial={{ x: dir * 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: dir * -40, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  className="grid grid-cols-7 gap-0.5"
                >
                  {monthGrid(anchor).map((d) => {
                    const iso = toISO(d);
                    const inMonth = d.getMonth() === anchor.getMonth();
                    const isSel = iso === value?.slice(0, 10);
                    const isToday = iso === todayISO;
                    const blocked = outOfRange(iso);
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={blocked}
                        onClick={() => pick(d)}
                        aria-pressed={isSel}
                        aria-label={fmtLong.format(d)}
                        className={cn(
                          'relative grid h-9 place-items-center rounded-lg text-sm tabular-nums transition-[background-color,color,transform] duration-100 cursor-pointer active:scale-90',
                          inMonth ? 'text-foreground' : 'text-muted-foreground/50',
                          !isSel && 'hover:bg-muted',
                          isSel && 'bg-primary text-primary-foreground font-semibold shadow-sm',
                          isToday && !isSel && 'font-semibold text-primary',
                          blocked && 'opacity-30 pointer-events-none'
                        )}
                      >
                        {d.getDate()}
                        {isToday && !isSel && <span className="absolute bottom-1 size-1 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  emit('');
                  setOpen(false);
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="button"
                disabled={outOfRange(todayISO)}
                onClick={() => pick(new Date())}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                Hoje
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
