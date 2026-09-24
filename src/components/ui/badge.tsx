import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        success: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-500/40',
        warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/40',
        destructive: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 dark:border-rose-500/40',
        info: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30 dark:border-sky-500/40',
        muted: 'bg-accent/80 text-foreground/80 border border-border/80',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ElementType;
}

export function Badge({ className, variant, icon: Icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}
