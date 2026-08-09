'use client';

import React from 'react';
import { NODE_PALETTE_ITEMS } from './nodes';
import type { FlowNodeType } from '@/types/flow';

/** Paleta lateral — clique adiciona o nó no canvas (mais simples que drag-and-drop nativo do browser, mesmo resultado: nó aparece e pode ser arrastado dentro do canvas via @xyflow/react). */
export default function NodePalette({ onAdd }: { onAdd: (type: FlowNodeType) => void }) {
  return (
    <div className="w-44 shrink-0 border-r border-border bg-card p-3 flex flex-col gap-2 overflow-y-auto">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Adicionar nó</h3>
      {NODE_PALETTE_ITEMS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onAdd(type)}
          className="flex items-center gap-2 text-xs font-bold text-foreground bg-background hover:bg-accent border border-border rounded-lg px-3 py-2 transition-colors cursor-pointer text-left"
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}
