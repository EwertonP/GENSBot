'use client';

import React from 'react';
import { DialogShell, confirmDialog } from './dialog';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  /**
   * Há alterações não salvas? Se sim, Esc / clique fora pedem confirmação
   * antes de fechar em vez de descartar o formulário em silêncio.
   */
  dirty?: boolean;
}

/**
 * Modal/sheet compartilhado. Roda sobre o Dialog do Base UI (ver
 * ui/dialog.tsx): foco preso dentro do painel e devolvido ao gatilho ao
 * fechar, scroll da página travado, Esc/clique fora, e suporte a dialogs
 * aninhados (lightbox, confirmação) sem fechar o de baixo.
 */
export function Sheet({ open, onClose, children, className, 'aria-label': ariaLabel, dirty }: SheetProps) {
  const requestClose = async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Descartar alterações?',
        description: 'Você tem alterações que ainda não foram salvas. Se fechar agora, elas serão perdidas.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'destructive',
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <DialogShell open={open} onRequestClose={requestClose} className={className} aria-label={ariaLabel}>
      {children}
    </DialogShell>
  );
}
