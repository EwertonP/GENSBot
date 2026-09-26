'use client';

import React from 'react';
import { Toaster } from '@/components/ui/toast';
import { ConfirmHost } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';

/** Camadas globais de UI: tooltips, toasts e o host do confirmDialog(). */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={400} closeDelay={0}>
      {children}
      <Toaster />
      <ConfirmHost />
    </TooltipProvider>
  );
}
