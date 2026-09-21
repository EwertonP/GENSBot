import React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs hover:shadow-sm font-bold',
        lime: 'bg-lime text-foreground hover:bg-lime/90 shadow-xs hover:shadow-sm font-bold border border-foreground/10',
        secondary: 'bg-card text-foreground border border-border hover:bg-accent/70 shadow-2xs hover:border-foreground/20',
        outline: 'bg-transparent text-foreground border border-border hover:bg-accent/50',
        ghost: 'bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs',
      },
      size: {
        sm: 'text-xs px-3 py-1.5 rounded-lg',
        md: 'text-sm px-4 py-2 rounded-xl',
        lg: 'text-base px-5 py-2.5 rounded-xl font-bold',
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
