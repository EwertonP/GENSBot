'use client';

import React, { useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { TELAS, type AbaId } from './nav-config';

/**
 * Barra de navegação do celular (some a partir de `md`): uma pílula flutuante
 * com até 3 atalhos, o botão "+" no centro (a única ação cheia da barra) e
 * "Mais", que abre o menu completo. O "+" abre a folha "Criar" com as ações
 * que a pessoa pode fazer.
 */
export const ATALHOS_PREFERIDOS: AbaId[] = ['dashboard', 'esteira', 'calendario_geral', 'publish', 'clientes', 'rotina', 'contacts', 'automations'];

export function atalhosDaBarra(abasVisiveis: readonly AbaId[]): AbaId[] {
  return ATALHOS_PREFERIDOS.filter((a) => abasVisiveis.includes(a)).slice(0, 3);
}

/** Rótulo curto: a barra tem pouco espaço por item. */
const ROTULO_CURTO: Partial<Record<AbaId, string>> = {
  dashboard: 'Início',
  esteira: 'Demandas',
  calendario_geral: 'Calendário',
  publish: 'Agendar',
  contacts: 'Audiência',
  automations: 'Automações',
};

export interface AcaoCriar {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  tom: 'brand' | 'info' | 'warning';
  executar: () => void;
}

const TOM: Record<AcaoCriar['tom'], string> = {
  brand: 'bg-brand-soft text-brand-text',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
};

interface MobileBottomNavProps {
  abasVisiveis: readonly AbaId[];
  activeTab: AbaId;
  onNavigate: (tab: AbaId) => void;
  onMais: () => void;
  acoes: AcaoCriar[];
}

export function MobileBottomNav({ abasVisiveis, activeTab, onNavigate, onMais, acoes }: MobileBottomNavProps) {
  const [criarAberto, setCriarAberto] = useState(false);
  const atalhos = atalhosDaBarra(abasVisiveis);
  const maisAtivo = !atalhos.includes(activeTab);
  const temCriar = acoes.length > 0;
  const esquerda = temCriar ? atalhos.slice(0, 2) : atalhos;
  const direita = temCriar ? atalhos.slice(2) : [];

  const itemClass = (ativo: boolean) =>
    `relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors cursor-pointer ${
      ativo ? 'text-brand-text' : 'text-muted-foreground active:text-foreground'
    }`;

  const botaoAtalho = (id: AbaId) => {
    const { icon: Icon, label } = TELAS[id];
    const ativo = id === activeTab;
    return (
      <li key={id}>
        <button type="button" onClick={() => onNavigate(id)} aria-current={ativo ? 'page' : undefined} className={itemClass(ativo)}>
          <Icon className="size-5" aria-hidden />
          <span className="truncate">{ROTULO_CURTO[id] ?? label}</span>
        </button>
      </li>
    );
  };

  const itens = [
    ...esquerda.map(botaoAtalho),
    ...(temCriar
      ? [
          <li key="criar" className="grid place-items-center">
            <button
              type="button"
              onClick={() => setCriarAberto(true)}
              aria-label="Criar"
              className="grid size-13 place-items-center rounded-full bg-lime text-lime-foreground shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="size-6" strokeWidth={2.5} aria-hidden />
            </button>
          </li>,
        ]
      : []),
    ...direita.map(botaoAtalho),
    <li key="mais">
      <button type="button" onClick={onMais} aria-label="Mais telas e menu" className={itemClass(maisAtivo)}>
        <Menu className="size-5" aria-hidden />
        <span>Mais</span>
      </button>
    </li>,
  ];

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-[28px] border border-sidebar-border bg-sidebar/95 shadow-xl backdrop-blur-xl"
      >
        <ul className="grid h-16 items-center" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
          {itens}
        </ul>
      </nav>

      <Sheet open={criarAberto} onClose={() => setCriarAberto(false)} aria-label="Criar" className="w-full max-w-md">
        <div className="flex flex-col gap-2 p-4 pb-5">
          <h3 className="px-1 pb-1 font-display text-xl font-semibold text-foreground">Criar</h3>
          {acoes.map(({ id, titulo, descricao, icon: Icon, tom, executar }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCriarAberto(false);
                executar();
              }}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent cursor-pointer"
            >
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${TOM[tom]}`}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-foreground">{titulo}</span>
                <span className="block text-sm text-muted-foreground">{descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
