import { cn } from '@/lib/utils';

/**
 * Spinner no estilo HeroUI: dois arcos girando em velocidades diferentes,
 * herdando a cor do texto (`text-primary`, `text-foreground`…).
 */
const sizes = { xs: 'size-3.5', sm: 'size-4', md: 'size-6', lg: 'size-9' } as const;

export function Spinner({
  size = 'sm',
  className,
  label = 'Carregando',
}: {
  size?: keyof typeof sizes;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className={cn('relative inline-block shrink-0', sizes[size], className)}>
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-15" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-current animate-spin [animation-duration:0.7s]" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-b-current opacity-60 animate-spin [animation-duration:1.1s] [animation-timing-function:linear]" />
    </span>
  );
}
