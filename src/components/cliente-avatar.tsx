import { corPadraoDoCliente, iniciais, textoSobre } from '@/lib/clientes';

const TAMANHOS = {
  sm: 'size-8 text-[11px]',
  md: 'size-11 text-sm',
  lg: 'size-16 text-xl',
} as const;

interface ClienteAvatarProps {
  nome: string;
  cor?: string | null;
  fotoUrl?: string | null;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}

/**
 * Círculo com as iniciais do cliente. Círculo é o formato mais repetido da
 * identidade da marca (badges numerados, avatares). A cor do texto é escolhida
 * por contraste real, não por limiar fixo — ver textoSobre().
 */
export function ClienteAvatar({ nome, cor, fotoUrl, tamanho = 'md', className = '' }: ClienteAvatarProps) {
  const fundo = cor || corPadraoDoCliente(nome);

  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto externa (Instagram), sem domínio fixo para otimizar
      <img
        src={fotoUrl}
        alt=""
        className={`${TAMANHOS[tamanho]} shrink-0 rounded-full object-cover border border-border ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${TAMANHOS[tamanho]} shrink-0 inline-flex items-center justify-center rounded-full font-bold tracking-tight ${className}`}
      style={{ backgroundColor: fundo, color: textoSobre(fundo) }}
    >
      {iniciais(nome)}
    </span>
  );
}
