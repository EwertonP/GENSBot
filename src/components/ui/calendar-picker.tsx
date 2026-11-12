'use client';

import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Minus, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostingTimeSuggestion } from '@/lib/best-posting-time';

export interface CalendarPickerProps {
  /** Data/hora selecionada, formato compatível com `new Date()`, ou null. */
  value: Date | null;
  onChange: (date: Date) => void;
  suggestions?: PostingTimeSuggestion[];
  className?: string;
}

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PRESET_TIMES = ['09:00', '12:00', '18:00', '20:00'];
const MINUTE_QUICKS = [0, 15, 30, 45];

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
 * Seletor inline em 2 colunas (Calendário mensal + Seletor ergonômico de horário)
 * para agendamento de publicações sem depender de `<input type="time">` nativo.
 */
export function CalendarPicker({ value, onChange, suggestions, className }: CalendarPickerProps) {
  const [monthAnchor, setMonthAnchor] = useState(() => value || new Date());

  const activeDate = value || new Date();
  const selectedHour = value ? value.getHours() : 10;
  const selectedMinute = value ? value.getMinutes() : 0;

  useEffect(() => {
    if (value) {
      setMonthAnchor(new Date(value.getFullYear(), value.getMonth(), 1));
    }
  }, [value]);

  const applyDateAndTime = (day: Date, hour: number, minute: number) => {
    const combined = new Date(day);
    combined.setHours(((hour % 24) + 24) % 24, ((minute % 60) + 60) % 60, 0, 0);
    onChange(combined);
  };

  const applyDay = (day: Date) => {
    applyDateAndTime(day, selectedHour, selectedMinute);
  };

  const setHourMinute = (hour: number, minute: number) => {
    const base = value || new Date();
    applyDateAndTime(base, hour, minute);
  };

  const adjustMinutes = (delta: number) => {
    const base = new Date(value || new Date());
    if (!value) base.setHours(selectedHour, selectedMinute, 0, 0);
    base.setMinutes(base.getMinutes() + delta);
    base.setSeconds(0, 0);
    onChange(base);
  };

  const applySuggestion = (s: PostingTimeSuggestion) => {
    const suggested = nextOccurrenceOf(s.weekday, s.hourStart);
    setMonthAnchor(new Date(suggested.getFullYear(), suggested.getMonth(), 1));
    onChange(suggested);
  };

  const cells = buildMonthGrid(monthAnchor);
  const monthLabel = monthAnchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const currentTimeStr = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;

  return (
    <div className={cn('rounded-2xl border border-border bg-card shadow-2xs overflow-hidden', className)}>
      <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Coluna Esquerda: Calendário Mensal */}
        <div className="md:col-span-7 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
              className="size-8 rounded-xl border border-border bg-accent/40 hover:bg-accent flex items-center justify-center text-foreground transition-ui cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="font-display text-sm font-bold text-foreground capitalize">{monthLabel}</p>
            <button
              type="button"
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
              className="size-8 rounded-xl border border-border bg-accent/40 hover:bg-accent flex items-center justify-center text-foreground transition-ui cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_HEADERS.map((w, i) => (
              <div key={i} className="text-center text-[11px] text-muted-foreground font-semibold py-1">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="aspect-square" />;
              }
              const isSelected = value && day.toDateString() === value.toDateString();
              const isToday = day.toDateString() === today.toDateString();
              const isPast = day.getTime() < todayStart;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => applyDay(day)}
                  className={cn(
                    'aspect-square rounded-xl text-xs font-sans tabular-nums transition-ui flex items-center justify-center cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : isToday
                      ? 'bg-primary/12 text-primary font-bold ring-1 ring-primary/40 hover:bg-primary/20'
                      : isPast
                      ? 'text-muted-foreground/55 hover:bg-accent/50'
                      : 'text-foreground hover:bg-accent font-medium'
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Coluna Direita: Seletor Ergonômico de Horário */}
        <div className="md:col-span-5 p-4 bg-muted/20 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Horário da Publicação
              </span>
              <span className="font-mono text-sm font-bold text-primary tabular-nums bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                {currentTimeStr}
              </span>
            </div>

            {/* Controle de Hora e Minuto com Passo Rápido */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-card border border-border flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hora</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHourMinute(selectedHour - 1, selectedMinute)}
                    className="size-7 rounded-lg bg-accent/60 hover:bg-accent flex items-center justify-center text-foreground cursor-pointer transition-ui"
                    aria-label="Diminuir 1 hora"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-base font-bold tabular-nums text-foreground">
                    {String(selectedHour).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHourMinute(selectedHour + 1, selectedMinute)}
                    className="size-7 rounded-lg bg-accent/60 hover:bg-accent flex items-center justify-center text-foreground cursor-pointer transition-ui"
                    aria-label="Aumentar 1 hora"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-card border border-border flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Minuto</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustMinutes(-5)}
                    className="size-7 rounded-lg bg-accent/60 hover:bg-accent flex items-center justify-center text-foreground cursor-pointer transition-ui"
                    aria-label="Diminuir 5 minutos"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-base font-bold tabular-nums text-foreground">
                    {String(selectedMinute).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustMinutes(5)}
                    className="size-7 rounded-lg bg-accent/60 hover:bg-accent flex items-center justify-center text-foreground cursor-pointer transition-ui"
                    aria-label="Aumentar 5 minutos"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Minutos rápidos */}
            <div className="grid grid-cols-4 gap-1.5">
              {MINUTE_QUICKS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHourMinute(selectedHour, m)}
                  className={cn(
                    'py-1 rounded-lg text-[11px] font-mono font-semibold border transition-ui cursor-pointer',
                    selectedMinute === m
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/25'
                  )}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              ))}
            </div>

            {/* Atalhos Populares */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Atalhos rápidos</span>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_TIMES.map((preset) => {
                  const [h, m] = preset.split(':').map(Number);
                  const active = currentTimeStr === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHourMinute(h, m)}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-mono font-semibold border transition-ui cursor-pointer',
                        active
                          ? 'bg-foreground text-background border-foreground shadow-2xs'
                          : 'bg-card border-border text-foreground hover:bg-accent'
                      )}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Melhores Horários Sugeridos */}
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-border/70">
                <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Melhores horários da conta
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.weekday}-${s.hourStart}`}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25 hover:bg-primary hover:text-primary-foreground transition-ui font-semibold cursor-pointer"
                    >
                      {s.weekdayLabel} {String(s.hourStart).padStart(2, '0')}h
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Resumo da Data e Hora Escolhida */}
          <div className="pt-2.5 border-t border-border flex items-center gap-2 text-xs">
            <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">
              {value ? (
                <>
                  Agendado para{' '}
                  <strong className="text-foreground font-semibold capitalize">
                    {activeDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} às {currentTimeStr}
                  </strong>
                </>
              ) : (
                'Selecione um dia no calendário'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
