import React from 'react';
import { cn } from '@/lib/utils';

const PADDING = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof PADDING;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-card border border-border rounded-lg', PADDING[padding], className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';
