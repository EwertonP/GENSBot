import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 pointer-coarse:min-h-11 font-semibold rounded-full transition-ui duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs hover:shadow-sm',
        lime: 'bg-lime text-lime-foreground hover:bg-lime/90 shadow-xs hover:shadow-sm border border-black/10',
        secondary: 'bg-card text-foreground border border-border-strong hover:bg-accent shadow-2xs',
        outline: 'bg-transparent text-foreground border border-border-strong hover:bg-accent',
        ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs',
      },
      size: {
        sm: 'h-9 text-xs px-3.5',
        md: 'h-10 text-sm px-5 max-md:h-11',
        lg: 'h-12 text-base px-6',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Ocupa a largura toda do contêiner. */
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, block, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), block && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="xs" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
