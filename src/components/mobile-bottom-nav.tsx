'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { TELAS, type AbaId } from './nav-config';

/**
 * Barra de navegação inferior do celular (some a partir de `md`).
 * Mostra até 4 atalhos, na ordem de preferência abaixo e só entre as telas que
 * a pessoa pode ver, mais o botão "Mais", que abre o menu completo.
 */
export const ATALHOS_PREFERIDOS: AbaId[] = ['dashboard', 'esteira', 'calendario_geral', 'publish', 'clientes', 'rotina', 'contacts', 'automations'];

export function atalhosDaBarra(abasVisiveis: readonly AbaId[]): AbaId[] {
  return ATALHOS_PREFERIDOS.filter((a) => abasVisiveis.includes(a)).slice(0, 4);
}

/** Rótulo curto: a barra tem pouco espaço por item. */
const ROTULO_CURTO: Partial<Record<AbaId, string>> = {
  esteira: 'Demandas',
  calendario_geral: 'Calendário',
  publish: 'Agendar',
  contacts: 'Audiência',
  automations: 'Automações',
};

interface MobileBottomNavProps {
  abasVisiveis: readonly AbaId[];
  activeTab: AbaId;
  onNavigate: (tab: AbaId) => void;
  onMais: () => void;
}

export function MobileBottomNav({ abasVisiveis, activeTab, onNavigate, onMais }: MobileBottomNavProps) {
  const atalhos = atalhosDaBarra(abasVisiveis);
  const maisAtivo = !atalhos.includes(activeTab);

  const itemClass = (ativo: boolean) =>
    `relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition-colors cursor-pointer ${
      ativo ? 'text-brand-text' : 'text-muted-foreground active:text-foreground'
    }`;
  const iconeClass = (ativo: boolean) =>
    `grid h-7 w-12 place-items-center rounded-full transition-colors ${ativo ? 'bg-accent' : ''}`;

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${atalhos.length + 1}, minmax(0, 1fr))` }}>
        {atalhos.map((id) => {
          const { icon: Icon, label } = TELAS[id];
          const ativo = id === activeTab;
          return (
            <li key={id}>
              <button type="button" onClick={() => onNavigate(id)} aria-current={ativo ? 'page' : undefined} className={`${itemClass(ativo)} w-full`}>
                <span className={iconeClass(ativo)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="truncate">{ROTULO_CURTO[id] ?? label}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMais} aria-label="Mais telas e menu" className={`${itemClass(maisAtivo)} w-full`}>
            <span className={iconeClass(maisAtivo)}>
              <Menu className="size-5" aria-hidden />
            </span>
            <span>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
