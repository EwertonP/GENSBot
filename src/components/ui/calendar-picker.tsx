'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PostingTimeSuggestion } from '@/lib/best-posting-time';

export interface CalendarPickerProps {
  /** Data/hora selecionada, formato compatível com `new Date()`, ou null. */
  value: Date | null;
  onChange: (date: Date) => void;
  suggestions?: PostingTimeSuggestion[];
  className?: string;
}

const WEEKDAY_HEADERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(monthAnchor: Date): (Date | null)[] {
  const first = startOfMonth(monthAnchor);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const leadingBlanks = first.getDay();
  const cells: (Date | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  }
  return cells;
}

function nextOccurrenceOf(weekday: number, hour: number): Date {
  const now = new Date();
  const result = new Date(now);
  const diff = (weekday - now.getDay() + 7) % 7;
  result.setDate(now.getDate() + diff);
  result.setHours(hour, 0, 0, 0);
  if (result.getTime() <= now.getTime()) result.setDate(result.getDate() + 7);
  return result;
}

/**
 * Calendário/hora próprio pro agendamento de publicações — substitui o
 * `<input type=datetime-local>` cru pedido no PLANO_REDESIGN_2.0.md Parte 5,
 * com spring de abrir/fechar (mesmo padrão do Sheet) e os blocos de melhor
 * horário (quando existem) como sugestão clicável.
 */
export function CalendarPicker({ value, onChange, suggestions, className }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState(() => value || new Date());
  const [timeStr, setTimeStr] = useState(() => {
    const d = value || new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const applyDay = (day: Date) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const combined = new Date(day);
    combined.setHours(hours || 0, minutes || 0, 0, 0);
    onChange(combined);
  };

  const handleTimeChange = (newTime: string) => {
    setTimeStr(newTime);
    const base = value || monthAnchor;
    const [hours, minutes] = newTime.split(':').map(Number);
    const combined = new Date(base);
    combined.setHours(hours || 0, minutes || 0, 0, 0);
    onChange(combined);
  };

  const applySuggestion = (s: PostingTimeSuggestion) => {
    const suggested = nextOccurrenceOf(s.weekday, s.hourStart);
    setMonthAnchor(suggested);
    setTimeStr(`${String(suggested.getHours()).padStart(2, '0')}:00`);
    onChange(suggested);
    setOpen(false);
  };

  const cells = buildMonthGrid(monthAnchor);
  const monthLabel = monthAnchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)} className="w-full justify-between">
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {value
            ? value.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Escolher data e hora'}
        </span>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
            className="absolute z-30 top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-2xl p-3"
          >
            {suggestions && suggestions.length > 0 && (
              <div className="mb-3 pb-3 border-b border-border flex flex-col gap-1.5">
                <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Melhores horários (baseado nos seus posts)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.weekday}-${s.hourStart}`}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="text-[11px] px-2 py-1 rounded-lg bg-accent text-accent-foreground hover:bg-accent/70 transition-all font-medium"
                    >
                      {s.weekdayLabel} {String(s.hourStart).padStart(2, '0')}h–{String(s.hourEnd).padStart(2, '0')}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
                className="p-1 rounded-lg hover:bg-accent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-xs font-bold capitalize">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
                className="p-1 rounded-lg hover:bg-accent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAY_HEADERS.map((w, i) => (
                <div key={i} className="text-center text-[10px] text-muted-foreground font-bold py-1">
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                const isSelected = day && value && day.toDateString() === value.toDateString();
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!day}
                    onClick={() => day && applyDay(day)}
                    className={cn(
                      'aspect-square rounded-lg text-xs transition-all',
                      !day && 'invisible',
                      isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-accent text-foreground'
                    )}
                  >
                    {day?.getDate()}
                  </button>
                );
              })}
            </div>

            <input
              type="time"
              value={timeStr}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full bg-accent border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
