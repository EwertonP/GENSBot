'use client';

import React from 'react';
import { Toast } from '@base-ui/react/toast';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toasts do app, sobre o Toast do Base UI com um gerenciador global —
 * dá pra disparar de qualquer lugar (handler, lib, fora da árvore React)
 * sem prop drilling de `showToast`. Empilham (fila), pausam no hover,
 * dispensam com swipe e aceitam uma ação ("Desfazer").
 *
 *   toast.success('Demanda salva')
 *   toast.error('Não foi possível publicar', { description: err.message })
 *   toast.undo('Tarefa excluída', () => restaurar())
 */
export const toastManager = Toast.createToastManager();

type Tone = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  description?: React.ReactNode;
  /** ms até sumir sozinho. 0 = só fecha manualmente. */
  timeout?: number;
  action?: { label: string; onClick: () => void };
  /** Chamado sempre que o toast some (timeout, swipe, X ou depois da ação). */
  onClose?: () => void;
}

function add(tone: Tone, title: React.ReactNode, opts: ToastOptions = {}) {
  const id: string = toastManager.add({
    title,
    description: opts.description,
    type: tone,
    timeout: opts.timeout ?? (tone === 'error' ? 8000 : 5000),
    priority: tone === 'error' ? 'high' : 'low',
    onClose: opts.onClose,
    actionProps: opts.action
      ? {
          children: opts.action.label,
          onClick: () => {
            // A ação roda ANTES de fechar: quem usa onClose pra efetivar algo
            // (ex.: exclusão adiada) já vê o 'desfeito' marcado.
            opts.action!.onClick();
            toastManager.close(id);
          },
        }
      : undefined,
  });
  return id;
}

export const toast = {
  success: (title: React.ReactNode, opts?: ToastOptions) => add('success', title, opts),
  error: (title: React.ReactNode, opts?: ToastOptions) => add('error', title, opts),
  warning: (title: React.ReactNode, opts?: ToastOptions) => add('warning', title, opts),
  info: (title: React.ReactNode, opts?: ToastOptions) => add('info', title, opts),
  /** Toast de confirmação de ação destrutiva com botão "Desfazer" (7s). */
  undo: (title: React.ReactNode, onUndo: () => void, opts?: Omit<ToastOptions, 'action'>) =>
    add('success', title, { timeout: 7000, ...opts, action: { label: 'Desfazer', onClick: onUndo } }),
  close: (id: string) => toastManager.close(id),
};

const ICON: Record<Tone, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};
const ICON_TONE: Record<Tone, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => {
    const tone = (t.type as Tone) || 'info';
    const Icon = ICON[tone] ?? Info;
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        className={cn(
          // Pilha à la Sonner: o da frente inteiro, os de trás "espiando" e
          // menores; ao passar o mouse a pilha abre (data-expanded).
          '[--gap:0.625rem] [--peek:0.625rem] [--scale:calc(max(0,1-(var(--toast-index)*0.06)))] [--shrink:calc(1-var(--scale))]',
          '[--height:var(--toast-frontmost-height,var(--toast-height))]',
          '[--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))]',
          'absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom select-none',
          'h-[var(--height)] data-expanded:h-[var(--toast-height)]',
          '[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))]',
          'data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]',
          'data-starting-style:[transform:translateY(150%)] data-limited:opacity-0 data-ending-style:opacity-0',
          '[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]',
          'data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
          'data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
          "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
          'rounded-2xl border border-border-strong bg-popover text-popover-foreground shadow-lg',
          '[transition:transform_0.45s_cubic-bezier(0.22,1,0.36,1),opacity_0.3s,height_0.15s]'
        )}
      >
        <Toast.Content className="flex h-full items-start gap-3 overflow-hidden p-3.5 transition-opacity duration-200 data-behind:opacity-0 data-expanded:opacity-100">
          <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', ICON_TONE[tone])} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Toast.Title className="text-sm font-semibold leading-5" />
            <Toast.Description className="text-xs leading-4 text-muted-foreground" />
          </div>
          {t.actionProps && (
            <Toast.Action className="shrink-0 rounded-lg border border-border-strong bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer" />
          )}
          <Toast.Close
            aria-label="Fechar notificação"
            className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <X className="size-3.5" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={4}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-[100] w-[calc(100vw-2rem)] sm:right-6 sm:bottom-6 sm:w-[23rem]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
