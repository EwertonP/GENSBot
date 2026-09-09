import React from 'react';
import { Card } from './card';
import { Button } from './button';

export interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <Card padding="lg" className="p-16 text-center flex flex-col items-center gap-6">
      <div className="p-4 rounded-lg bg-accent text-muted-foreground border border-border">
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <h4 className="font-bold text-foreground">{title}</h4>
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">{description}</p>
        )}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
          {action.label}
        </Button>
      )}
    </Card>
  );
}
