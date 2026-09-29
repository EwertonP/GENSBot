'use client';

import React from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldLabelClass } from '@/lib/form-styles';

/**
 * Seletor com visual inspirado no HeroUI (popover flutuante, item com
 * destaque arredondado, check animado, chevron que gira), construído sobre
 * o Base UI para manter acessibilidade de teclado/leitor de tela.
 *
 * Mantém a API do <select> nativo: filhos <option>, `value` e
 * `onChange(e => e.target.value)` — as telas existentes não mudam.
 */
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'defaultValue'> {
  label?: string;
  error?: string;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

interface OptionItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

// Base UI trata '' como valor comum, mas usamos um sentinela para não
// colidir com o estado "nada selecionado" (null).
const EMPTY = '__gens_empty__';
const toInternal = (v: string) => (v === '' ? EMPTY : v);
const toExternal = (v: string) => (v === EMPTY ? '' : v);

function collectOptions(children: React.ReactNode, out: OptionItem[] = []): OptionItem[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const el = child as React.ReactElement<{
      value?: string | number;
      children?: React.ReactNode;
      disabled?: boolean;
    }>;
    if (el.type === 'option') {
      const text = el.props.children;
      out.push({
        value: String(el.props.value ?? (typeof text === 'string' ? text : '')),
        label: text,
        disabled: el.props.disabled,
      });
    } else if (el.props.children) {
      // <optgroup>, fragmentos etc.
      collectOptions(el.props.children, out);
    }
  });
  return out;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    { className, label, error, id, children, value, defaultValue, onChange, name, required, disabled, placeholder },
    ref
  ) => {
    const options = React.useMemo(() => collectOptions(children), [children]);
    const labelOf = (v: string) => options.find((o) => o.value === v)?.label;

    const handleChange = (next: string | null) => {
      const ext = toExternal(next ?? '');
      onChange?.({
        target: { value: ext, name: name ?? '', id: id ?? '' },
        currentTarget: { value: ext, name: name ?? '', id: id ?? '' },
      } as unknown as React.ChangeEvent<HTMLSelectElement>);
    };

    const control = (
      <BaseSelect.Root
        value={value === undefined ? undefined : toInternal(String(value))}
        defaultValue={defaultValue === undefined ? undefined : toInternal(String(defaultValue))}
        onValueChange={(v) => handleChange(v as string | null)}
        name={name}
        required={required}
        disabled={disabled}
      >
        <BaseSelect.Trigger
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            'group/select flex w-full items-center justify-between gap-2 text-left',
            'bg-card border border-input rounded-xl px-3.5 py-2 text-sm text-foreground shadow-2xs',
            'transition-[border-color,box-shadow,background-color] duration-150',
            'hover:border-border-strong hover:bg-muted/40',
            'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
            'data-[popup-open]:border-ring data-[popup-open]:ring-2 data-[popup-open]:ring-ring/25',
            'data-[disabled]:opacity-60 data-[disabled]:cursor-not-allowed',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            className
          )}
        >
          <BaseSelect.Value className="truncate data-[placeholder]:text-muted-foreground">
            {(v: string | null) =>
              v == null ? (placeholder ?? 'Selecione…') : (labelOf(toExternal(v)) ?? toExternal(v))
            }
          </BaseSelect.Value>
          <BaseSelect.Icon className="shrink-0 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/select:rotate-180">
            <ChevronDown className="size-4" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>

        <BaseSelect.Portal>
          <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
            <BaseSelect.Popup
              className={cn(
                'min-w-[var(--anchor-width)] max-h-[min(var(--available-height),20rem)] overflow-y-auto',
                'rounded-2xl border border-border bg-popover/95 p-1.5 text-popover-foreground',
                'shadow-lg backdrop-blur-xl outline-none',
                'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
                'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
                'data-[ending-style]:opacity-0 data-[ending-style]:scale-95'
              )}
            >
              <BaseSelect.List>
                {options.map((o) => (
                  <BaseSelect.Item
                    key={o.value}
                    value={toInternal(o.value)}
                    disabled={o.disabled}
                    className={cn(
                      'group/item flex cursor-default select-none items-center justify-between gap-3',
                      'rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-100',
                      'data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
                      'data-[selected]:font-medium',
                      'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none'
                    )}
                  >
                    <BaseSelect.ItemText className="truncate">{o.label}</BaseSelect.ItemText>
                    <BaseSelect.ItemIndicator className="text-primary animate-in zoom-in-50 fade-in duration-150">
                      <Check className="size-4" strokeWidth={2.5} />
                    </BaseSelect.ItemIndicator>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    );

    if (!label) return control;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
        {control}
        {error && <p className="text-xs text-destructive font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
