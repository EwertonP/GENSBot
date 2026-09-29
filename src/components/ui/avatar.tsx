import { cn } from '@/lib/utils';

/**
 * Avatar no estilo HeroUI: foto quando houver; senão iniciais sobre uma cor
 * própria de cada pessoa (derivada do nome, sempre a mesma), com anel sutil.
 * `AvatarGroup` empilha vários com sobreposição e contador "+N".
 */
const sizes = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export function initialsOf(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function hueOf(nome: string) {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export interface AvatarProps {
  nome: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ nome, src, size = 'sm', className }: AvatarProps) {
  const hue = hueOf(nome);
  return (
    <span
      title={nome}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold leading-none',
        'ring-2 ring-background shadow-2xs',
        sizes[size],
        className
      )}
      style={
        src
          ? undefined
          : {
              background: `linear-gradient(135deg, hsl(${hue} 70% 58% / .95), hsl(${(hue + 40) % 360} 70% 45% / .95))`,
              color: 'white',
            }
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={nome} className="size-full object-cover" />
      ) : (
        initialsOf(nome)
      )}
    </span>
  );
}

export function AvatarGroup({
  pessoas,
  max = 3,
  size = 'sm',
  className,
}: {
  pessoas: { nome: string; foto_url?: string | null }[];
  max?: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const visiveis = pessoas.slice(0, max);
  const resto = pessoas.length - visiveis.length;
  return (
    <span className={cn('inline-flex items-center -space-x-1.5', className)}>
      {visiveis.map((p, i) => (
        <Avatar key={`${p.nome}-${i}`} nome={p.nome} src={p.foto_url} size={size} className="transition-transform hover:z-10 hover:-translate-y-0.5" />
      ))}
      {resto > 0 && (
        <span
          title={pessoas.slice(max).map((p) => p.nome).join(', ')}
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-muted font-bold text-muted-foreground ring-2 ring-background',
            sizes[size]
          )}
        >
          +{resto}
        </span>
      )}
    </span>
  );
}
