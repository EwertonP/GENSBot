'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/* ────────────────────────────────────────────────────────────────────────
   DialogShell — modal base do app (usado pelo <Sheet>).
   Base UI entrega: focus trap, foco volta pro gatilho ao fechar, scroll da
   página travado, Esc/clique fora, e dialogs ANINHADOS (um Dialog renderizado
   dentro de outro fecha só o de cima no Esc).
   ──────────────────────────────────────────────────────────────────────── */

const backdropClass =
  'fixed inset-0 z-50 bg-foreground/25 dark:bg-black/70 backdrop-blur-[2px] ' +
  'transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0';

const popupMotion =
  'transition-[opacity,scale,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'data-starting-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:translate-y-2 ' +
  'data-ending-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:duration-150';

export interface DialogShellProps {
  open: boolean;
  /** Chamado quando o usuário pede pra fechar (Esc, clique fora, botão). */
  onRequestClose: () => void;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function DialogShell({ open, onRequestClose, children, className, 'aria-label': ariaLabel }: DialogShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onRequestClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClass} />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            aria-label={ariaLabel}
            className={cn(
              'bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground max-h-[92vh] flex flex-col outline-none',
              popupMotion,
              className
            )}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   confirmDialog() — substituto do window.confirm(), com Promise.
     if (!(await confirmDialog({ title: 'Excluir demanda?', tone: 'destructive' }))) return;
   Renderizado pelo <ConfirmHost/> montado uma vez no layout.
   ──────────────────────────────────────────────────────────────────────── */

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'default';
}

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Um de cada vez: se já houver um aberto, o anterior conta como "cancelar".
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function settle(ok: boolean) {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => pending,
    () => null
  );
  // Mantém o conteúdo durante a animação de saída.
  const [shown, setShown] = useState<PendingConfirm | null>(null);
  if (current && current !== shown) setShown(current);
  const opts = current ?? shown;
  const destructive = opts?.tone === 'destructive';

  return (
    <AlertDialog.Root open={!!current} onOpenChange={(next) => { if (!next) settle(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={cn(backdropClass, 'z-[70]')} />
        <AlertDialog.Viewport className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <AlertDialog.Popup
            className={cn(
              'w-full max-w-md rounded-2xl border border-border-strong bg-popover text-popover-foreground shadow-2xl p-6 flex flex-col gap-5 outline-none',
              popupMotion
            )}
          >
            <div className="flex flex-col gap-1.5">
              {destructive && (
                <span className="mb-2 inline-flex size-10 items-center justify-center rounded-full bg-destructive-soft text-destructive ring-4 ring-destructive/10 animate-in zoom-in-75 duration-200">
                  <AlertTriangle className="size-5" />
                </span>
              )}
              <AlertDialog.Title className="text-base font-semibold leading-6">{opts?.title}</AlertDialog.Title>
              {opts?.description && (
                <AlertDialog.Description className="text-sm text-muted-foreground leading-5">
                  {opts.description}
                </AlertDialog.Description>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <AlertDialog.Close render={<Button variant="secondary" />}>{opts?.cancelLabel ?? 'Cancelar'}</AlertDialog.Close>
              <Button
                variant={destructive ? 'destructive' : 'primary'}
                onClick={() => settle(true)}
                autoFocus={!destructive}
              >
                {opts?.confirmLabel ?? (destructive ? 'Excluir' : 'Confirmar')}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   MediaLightbox — zoom de imagem/vídeo. Renderize DENTRO do Sheet que o
   abre: como dialog aninhado, o Esc fecha só o lightbox, não o formulário.
   ──────────────────────────────────────────────────────────────────────── */

export function MediaLightbox({ src, onClose, alt = 'Pré-visualização da mídia' }: { src: string | null; onClose: () => void; alt?: string }) {
  const [last, setLast] = useState(src);
  if (src && src !== last) setLast(src);
  const url = src ?? last;
  const isVideo = !!url && (url.endsWith('.mp4') || url.includes('video'));

  return (
    <Dialog.Root open={!!src} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop forceRender className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <Dialog.Popup aria-label={alt} className={cn('relative max-w-4xl max-h-[88vh] flex flex-col items-center outline-none', popupMotion)}>
            <Dialog.Close
              aria-label="Fechar visualização"
              className="absolute -top-11 right-0 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="w-5 h-5" />
            </Dialog.Close>
            {url && (isVideo ? (
              <video src={url} controls autoPlay className="max-w-full max-h-[82vh] rounded-2xl shadow-2xl object-contain border border-white/20" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={alt} className="max-w-full max-h-[82vh] rounded-2xl shadow-2xl object-contain border border-white/20" />
            ))}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
