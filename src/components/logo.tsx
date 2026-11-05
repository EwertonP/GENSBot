'use client';

import React from 'react';

/**
 * Símbolo do GENSBot (dois painéis). Tema claro: painéis verde-floresta e verde médio
 * sobre fundo branco; tema escuro: painéis menta e verde médio sobre preto.
 */
export function LogoMark({ className = '' }: { className?: string }) {
  const base = `object-contain select-none shrink-0 rounded-[22%] ${className}`;
  return (
    <>
      <img src="/fav-icon.png" alt="GENSBot" className={`${base} block dark:hidden`} width={128} height={128} loading="eager" />
      <img src="/fav-icon-dark.png" alt="" aria-hidden className={`${base} hidden dark:block`} width={128} height={128} loading="eager" />
    </>
  );
}

/**
 * Logotipo do GENSBot:
 * - Tema claro: /logo-light.png (ícone e texto em verde-floresta)
 * - Tema escuro: /logo-dark.png (ícone menta e texto claro)
 */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center select-none shrink-0 ${className}`}>
      {/* Versão tema claro */}
      <img
        src="/logo-light.png"
        alt="GENSBot"
        className="h-full w-auto object-contain block dark:hidden"
        width={845}
        height={200}
        loading="eager"
      />
      {/* Versão tema escuro */}
      <img
        src="/logo-dark.png"
        alt="GENSBot"
        className="h-full w-auto object-contain hidden dark:block"
        width={845}
        height={200}
        loading="eager"
      />
    </span>
  );
}
