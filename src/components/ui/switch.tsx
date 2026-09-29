'use client';

import React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

/**
 * Switch no estilo HeroUI: trilho que muda de cor com transição suave e
 * polegar que "estica" enquanto pressionado, como no iOS.
 */
export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  size?: 'sm' | 'md';
  label?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const sizes = {
  sm: { root: 'h-5 w-9', thumb: 'size-4 group-active/sw:w-5 data-[checked]:translate-x-4 data-[checked]:group-active/sw:translate-x-3' },
  md: { root: 'h-6 w-11', thumb: 'size-5 group-active/sw:w-6 data-[checked]:translate-x-5 data-[checked]:group-active/sw:translate-x-4' },
};

export function Switch({ label, className, size = 'md', onCheckedChange, ...props }: SwitchProps) {
  const s = sizes[size];
  const control = (
    <BaseSwitch.Root
      {...props}
      onCheckedChange={(v) => onCheckedChange?.(v)}
      className={cn(
        'group/sw relative inline-flex shrink-0 items-center rounded-full p-0.5 cursor-pointer',
        'bg-muted border border-border transition-colors duration-200 ease-out',
        'data-[checked]:bg-primary data-[checked]:border-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        s.root,
        !label && className
      )}
    >
      <BaseSwitch.Thumb
        className={cn(
          'block rounded-full bg-background shadow-md ring-1 ring-black/5',
          'transition-[transform,width] duration-200 ease-[cubic-bezier(.3,1.4,.6,1)]',
          'data-[checked]:bg-primary-foreground',
          s.thumb
        )}
      />
    </BaseSwitch.Root>
  );

  if (!label) return control;

  return (
    <label className={cn('inline-flex items-center gap-2.5 cursor-pointer select-none', className)}>
      {control}
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}
