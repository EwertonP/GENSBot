'use client';

import React, { useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';

export interface BoardColumn<TStatus extends string> {
  id: TStatus;
  label: string;
}

interface BoardProps<TItem, TStatus extends string> {
  columns: BoardColumn<TStatus>[];
  items: TItem[];
  getItemId: (item: TItem) => string;
  getItemStatus: (item: TItem) => TStatus;
  renderCard: (item: TItem) => React.ReactNode;
  onMove: (itemId: string, newStatus: TStatus) => void;
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-30' : ''}`}
    >
      {children}
    </div>
  );
}

function DroppableColumn<TStatus extends string>({
  column,
  count,
  children,
}: {
  column: BoardColumn<TStatus>;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { status: column.id },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 rounded-3xl p-3.5 border transition-all duration-200 min-h-[500px] flex flex-col gap-3 ${
        isOver
          ? 'bg-[#d8ff3c]/25 border-primary ring-2 ring-primary/30 shadow-md scale-[1.01]'
          : 'bg-[#edf4d8]/35 border border-[#d8ff3c]/40 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between px-1.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#192313]" />
          <h4 className="text-xs font-bold text-[#192313] font-display uppercase tracking-wider">
            {column.label}
          </h4>
        </div>
        <Badge variant="muted" className="font-mono text-[10px] font-bold bg-white text-[#192313] border border-border/70 shadow-2xs">
          {count}
        </Badge>
      </div>
      <div className="flex flex-col gap-3 flex-1">{children}</div>
    </div>
  );
}

/**
 * Board de Kanban genérico — extraído de kanban-board.tsx e crm-board.tsx (que
 * tinham cada um sua própria lógica de drag-and-drop HTML5 nativo copiada).
 * Usa `dnd-kit` em vez de nativo por dois motivos concretos: nativo não
 * funciona em touch (celular/tablet), e não dá pra fazer o "ghost card"
 * (DragOverlay) que o HTML5 não tem embutido.
 *
 * Não usa `@dnd-kit/sortable` de propósito — nenhum board reordena dentro da
 * mesma coluna, só move entre colunas, então useDraggable/useDroppable puro
 * já resolve com menos superfície de risco que o Sortable completo.
 */
export function Board<TItem, TStatus extends string>({
  columns,
  items,
  getItemId,
  getItemStatus,
  renderCard,
  onMove,
}: BoardProps<TItem, TStatus>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const activeItem = activeId ? items.find((i) => getItemId(i) === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = (over.data?.current?.status || over.id) as TStatus;
    if (newStatus && typeof newStatus === 'string') {
      onMove(String(active.id), newStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const cardsInColumn = items.filter((item) => getItemStatus(item) === col.id);
          return (
            <DroppableColumn key={col.id} column={col} count={cardsInColumn.length}>
              {cardsInColumn.map((item) => (
                <DraggableCard key={getItemId(item)} id={getItemId(item)}>
                  {renderCard(item)}
                </DraggableCard>
              ))}
            </DroppableColumn>
          );
        })}
      </div>
      <DragOverlay>{activeItem ? renderCard(activeItem) : null}</DragOverlay>
    </DndContext>
  );
}
