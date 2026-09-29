'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldInputClass, fieldLabelClass } from '@/lib/form-styles';
import { DatePicker } from './date-picker';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    // type="date" vira o DatePicker (popover com calendário), mesma API.
    const inputEl =
      props.type === 'date' ? (
        <DatePicker
          id={id}
          value={props.value == null ? undefined : String(props.value)}
          onChange={props.onChange}
          name={props.name}
          disabled={props.disabled}
          required={props.required}
          min={props.min == null ? undefined : String(props.min)}
          max={props.max == null ? undefined : String(props.max)}
          aria-label={props['aria-label']}
          className={className}
        />
      ) : props.type === 'number' ? (
        <NumberStepper id={id} ref={ref} className={className} {...props} />
      ) : (
        <input id={id} ref={ref} className={cn(fieldInputClass, className)} {...props} />
      );

    if (!label) return inputEl;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
        {inputEl}
        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

/**
 * type="number" com botões − / + no estilo HeroUI (NumberField). Esconde as
 * setinhas nativas e respeita min/max/step, emitindo onChange normal.
 */
const NumberStepper = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  const step = Number(props.step) || 1;
  const min = props.min == null || props.min === '' ? -Infinity : Number(props.min);
  const max = props.max == null || props.max === '' ? Infinity : Number(props.max);
  const current = Number(props.value ?? props.defaultValue ?? 0) || 0;

  const bump = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, current + dir * step));
    const v = String(Number.isFinite(next) ? next : current);
    props.onChange?.({
      target: { value: v, name: props.name ?? '', id: props.id ?? '' },
      currentTarget: { value: v, name: props.name ?? '', id: props.id ?? '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const btn =
    'grid h-full aspect-square max-h-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ' +
    'active:scale-90 transition-[background-color,color,transform] duration-100 cursor-pointer disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div className={cn('relative flex items-center', className?.match(/\bw-\S+/)?.[0])}>
      <input
        ref={ref}
        {...props}
        className={cn(
          fieldInputClass,
          className,
          // Depois do className: o espaço dos botões não pode ser sobrescrito por px-*.
          'pr-16 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
        )}
      />
      <div className="absolute inset-y-1 right-1 flex items-center gap-0.5">
        <button type="button" tabIndex={-1} aria-label="Diminuir" className={btn} disabled={props.disabled || current <= min} onClick={() => bump(-1)}>
          <Minus className="size-3.5" />
        </button>
        <button type="button" tabIndex={-1} aria-label="Aumentar" className={btn} disabled={props.disabled || current >= max} onClick={() => bump(1)}>
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
});
NumberStepper.displayName = 'NumberStepper';
