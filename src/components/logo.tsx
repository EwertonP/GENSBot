'use client';

import React from 'react';

/**
 * Símbolo oficial da Agência GENS (Monograma squircle verde-limão com tipografia verde-oliva).
 */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/fav-icon.png"
      alt="GENS"
      className={`object-contain select-none shrink-0 ${className}`}
      width={128}
      height={128}
      loading="eager"
    />
  );
}

/**
 * Logotipo oficial da Agência GENS:
 * - Tema Claro: exibe /logo-light.png (AllInGens em verde-oliva e lime)
 * - Dark Mode: exibe /logo-dark.png (All Gens em neon lime elétrico de alta visibilidade)
 */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center select-none shrink-0 ${className}`}>
      {/* Versão Tema Claro */}
      <img
        src="/logo-light.png"
        alt="GENS"
        className="h-full w-auto object-contain block dark:hidden"
        width={514}
        height={160}
        loading="eager"
      />
      {/* Versão Dark Mode */}
      <img
        src="/logo-dark.png"
        alt="GENS"
        className="h-full w-auto object-contain hidden dark:block"
        width={514}
        height={160}
        loading="eager"
      />
    </span>
  );
}
