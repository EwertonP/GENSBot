import React from 'react';
import { Card } from './card';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyAction {
  label: string;
  onClick: () => void;
  icon?: React.ElementType;
}

export interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  /** Próximo passo principal — o empty state deve sempre ensinar o que fazer. */
  action?: EmptyAction;
  /** Alternativa mais leve (ex.: "Limpar filtros"). */
  secondaryAction?: EmptyAction;
  /** `compact` para dentro de colunas, painéis e listas curtas. */
  size?: 'default' | 'compact';
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, size = 'default', className }: EmptyStateProps) {
  const compact = size === 'compact';
  const ActionIcon = action?.icon;
  const SecondaryIcon = secondaryAction?.icon;
  return (
    <Card
      padding="lg"
      className={cn(
        'text-center flex flex-col items-center',
        compact ? 'p-8 gap-3 shadow-none' : 'px-6 py-14 gap-5',
        className
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border',
          compact ? 'size-10' : 'size-14'
        )}
      >
        <Icon aria-hidden className={compact ? 'size-5' : 'size-6'} />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <h4 className={cn('font-semibold text-foreground text-balance', compact ? 'text-sm' : 'text-base')}>{title}</h4>
        {description && (
          <p className={cn('text-muted-foreground max-w-sm text-pretty', compact ? 'text-xs' : 'text-sm')}>{description}</p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {ActionIcon && <ActionIcon aria-hidden className="w-3.5 h-3.5" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
              {SecondaryIcon && <SecondaryIcon aria-hidden className="w-3.5 h-3.5" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
