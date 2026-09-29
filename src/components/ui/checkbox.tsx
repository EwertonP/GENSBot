'use client';

import React from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { cn } from '@/lib/utils';

/**
 * Checkbox no estilo HeroUI: caixa arredondada que "enche" com a cor
 * primária, check desenhado com animação de traço e leve compressão ao
 * clicar. Com `label`/`description` vira uma linha clicável inteira.
 */
export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({ label, description, className, onCheckedChange, ...props }: CheckboxProps) {
  const box = (
    <BaseCheckbox.Root
      {...props}
      onCheckedChange={(v) => onCheckedChange?.(v)}
      className={cn(
        'peer relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-md cursor-pointer',
        'border-2 border-border-strong bg-card shadow-2xs',
        'transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out',
        'hover:border-foreground/40 active:scale-90',
        'data-[checked]:bg-primary data-[checked]:border-primary',
        'data-[indeterminate]:bg-primary data-[indeterminate]:border-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        !label && className
      )}
    >
      <BaseCheckbox.Indicator keepMounted className="text-primary-foreground group">
        {props.indeterminate ? (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path d="M2.5 6h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" fill="none" className="size-3" aria-hidden>
            <path
              d="M2.5 6.2 5 8.5l4.5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-200 ease-out group-data-[checked]:[stroke-dashoffset:0]"
            />
          </svg>
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );

  if (!label) return box;

  return (
    <label className={cn('group/cb inline-flex items-start gap-2.5 cursor-pointer select-none', className)}>
      <span className="pt-0.5">{box}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground leading-5">{label}</span>
        {description && <span className="text-xs text-muted-foreground leading-4">{description}</span>}
      </span>
    </label>
  );
}
