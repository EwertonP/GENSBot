'use client';

import React from 'react';

/**
 * Símbolo do GENSBot (dois painéis, menta e verde médio, sobre floresta).
 * O ícone já vem com o fundo floresta, então funciona igual nos dois temas.
 */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/fav-icon.png"
      alt="GENSBot"
      className={`object-contain select-none shrink-0 rounded-[22%] ${className}`}
      width={128}
      height={128}
      loading="eager"
    />
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
        width={581}
        height={196}
        loading="eager"
      />
      {/* Versão tema escuro */}
      <img
        src="/logo-dark.png"
        alt="GENSBot"
        className="h-full w-auto object-contain hidden dark:block"
        width={581}
        height={196}
        loading="eager"
      />
    </span>
  );
}
