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

function DroppableColumn<TStatus extends string>({ column, count, children }: { column: BoardColumn<TStatus>; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-64 rounded-2xl transition-colors ${isOver ? 'bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between px-2 pb-2">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">{column.label}</h4>
        <Badge variant="muted">{count}</Badge>
      </div>
      <div className="flex flex-col gap-2 min-h-[80px]">{children}</div>
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
    const newStatus = over.id as TStatus;
    onMove(String(active.id), newStatus);
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
