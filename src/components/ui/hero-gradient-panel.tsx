import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface HeroGradientPanelProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  badgeIcon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Painel Hero com degradê suave (padrão Financeiro) para cabeçalhos executivos e blocos de KPI.
 */
export function HeroGradientPanel({
  eyebrow,
  title,
  subtitle,
  badge,
  badgeIcon: BadgeIcon,
  actions,
  children,
  className = '',
}: HeroGradientPanelProps) {
  return (
    <div
      className={`rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-xs flex flex-col gap-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-xs text-muted-foreground first-letter:uppercase">{eyebrow}</div>
          )}
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {(badge || actions) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {badge && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-xs font-semibold text-foreground">
                {BadgeIcon && <BadgeIcon className="size-3.5 text-primary" />}
                {badge}
              </span>
            )}
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

const ICON_TONES = {
  primary: 'bg-primary/15 text-primary',
  emerald: 'bg-emerald-500/15 text-emerald-500',
  amber: 'bg-amber-500/15 text-amber-500',
  rose: 'bg-rose-500/15 text-rose-500',
  sky: 'bg-sky-500/15 text-sky-500',
  violet: 'bg-violet-500/15 text-violet-500',
} as const;

const VALUE_TONES = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-500',
  primary: 'text-primary',
} as const;

interface HeroKpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: keyof typeof ICON_TONES;
  valueTone?: keyof typeof VALUE_TONES;
  className?: string;
}

/**
 * Sub-card translúcido de KPI utilizado dentro do HeroGradientPanel.
 */
export function HeroKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconTone = 'primary',
  valueTone = 'default',
  className = '',
}: HeroKpiCardProps) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs p-4 flex flex-col justify-between gap-2 shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {Icon && (
          <span className={`grid size-7 place-items-center rounded-xl shrink-0 ${ICON_TONES[iconTone]}`}>
            <Icon className="size-3.5" />
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>

      <div className={`font-display text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${VALUE_TONES[valueTone]}`}>
        {value}
      </div>

      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
