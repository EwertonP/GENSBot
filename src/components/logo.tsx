/**
 * Identidade visual do GENSBot.
 *
 * O símbolo é um "G" geométrico (anel com abertura à direita + barra interna)
 * que também lê como balão de mensagem, graças ao rabinho na base esquerda —
 * as duas ideias da marca numa forma só: GENS + direct do Instagram.
 *
 * Desenhado em stroke com `currentColor`, então herda a cor de quem o contém:
 * clay sobre fundo claro, clay-claro no tema escuro, branco dentro do bloco
 * de acento do login. Nunca fixe cor aqui.
 */

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="GENSBot"
    >
      {/* Anel do G: abertura entre 1h e 3h, terminando na barra interna */}
      <path
        d="M31 11.88 A14 14 0 1 0 38 24 L27 24"
        stroke="currentColor"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rabinho do balão, na base esquerda */}
      <path d="M20.9 35.6 L12.5 43.9 L15.5 32.5 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Lockup completo (símbolo + "GENSBot"). Defina a altura no `className`
 * (ex: `h-8`) — o símbolo acompanha e o texto escala junto.
 */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <LogoMark className="h-full w-auto text-primary" />
      <span className="text-[1.05em] font-black tracking-tight text-foreground leading-none">
        GENSBot
      </span>
    </span>
  );
}
