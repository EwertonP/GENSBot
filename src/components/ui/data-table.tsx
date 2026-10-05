'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ScrollShadow } from './scroll-shadow';
import { SkeletonRows } from './skeleton';
import { Checkbox } from './checkbox';
import { Button } from './button';

/**
 * Tabela padrão do sistema (receita da Audiência): texto de 14px, cabeçalho
 * discreto em caixa normal, linha clicável, esqueleto ao carregar e estado
 * vazio no lugar das linhas. Abaixo de `sm` cada linha vira um cartão:
 * colunas `primary` em cima, `meta` como "rótulo: valor" e ações à direita.
 */
export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Classes da célula no desktop (largura, truncate, cor). */
  className?: string;
  /** Papel no cartão do celular. Padrão: `meta`. */
  mobile?: 'primary' | 'meta' | 'hidden';
  /** Rótulo no cartão quando o `header` não é texto. */
  mobileLabel?: string;
}

export interface DataTableSelection<T> {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  /** Nome lido pelo leitor de tela em "Selecionar …". */
  rowLabel: (row: T) => string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Botões da linha (use `IconButton`); ficam na última coluna e no canto do cartão. */
  actions?: (row: T) => React.ReactNode;
  selection?: DataTableSelection<T>;
  loading?: boolean;
  skeletonRows?: number;
  /** Mostrado quando `rows` está vazio (normalmente um `EmptyState size="compact"`). */
  empty: React.ReactNode;
  className?: string;
}

const th = 'py-2.5 px-3 font-medium';
const td = 'py-3 px-3';

export function DataTable<T>({ rows, columns, getRowId, onRowClick, actions, selection, loading, skeletonRows = 6, empty, className }: DataTableProps<T>) {
  if (loading) return <SkeletonRows rows={skeletonRows} className={cn('p-1', className)} />;
  if (rows.length === 0) return <div className={className}>{empty}</div>;

  const allSelected = !!selection && rows.every((r) => selection.selectedIds.has(getRowId(r)));
  const primarias = columns.filter((c) => c.mobile === 'primary');
  const metas = columns.filter((c) => (c.mobile ?? 'meta') === 'meta');
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className={className}>
      <ScrollShadow className="hidden sm:block">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border">
            <tr className="text-xs text-muted-foreground">
              {selection && (
                <th className={cn(th, 'w-8')}>
                  <Checkbox checked={allSelected} onCheckedChange={selection.onToggleAll} aria-label="Selecionar todos desta página" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.id} scope="col" className={cn(th, c.align === 'right' && 'text-right')}>
                  {c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className={cn(th, 'w-px')}>
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const id = getRowId(row);
              return (
                <tr key={id} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-accent')}>
                  {selection && (
                    <td className={td} onClick={parar}>
                      <Checkbox checked={selection.selectedIds.has(id)} onCheckedChange={() => selection.onToggle(id)} aria-label={`Selecionar ${selection.rowLabel(row)}`} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.id} className={cn(td, c.align === 'right' && 'text-right', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className={cn(td, 'py-1.5')} onClick={parar}>
                      <div className="flex items-center justify-end gap-0.5">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollShadow>

      <ul className="sm:hidden flex flex-col divide-y divide-border">
        {rows.map((row) => {
          const id = getRowId(row);
          return (
            <li key={id} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('flex gap-3 py-3', onRowClick && 'cursor-pointer active:bg-accent')}>
              {selection && (
                <div className="pt-0.5" onClick={parar}>
                  <Checkbox checked={selection.selectedIds.has(id)} onCheckedChange={() => selection.onToggle(id)} aria-label={`Selecionar ${selection.rowLabel(row)}`} />
                </div>
              )}
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                {primarias.map((c) => (
                  <div key={c.id} className="min-w-0 text-sm">
                    {c.cell(row)}
                  </div>
                ))}
                {metas.length > 0 && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {metas.map((c) => (
                      <React.Fragment key={c.id}>
                        <dt className="text-xs text-muted-foreground pt-0.5">{c.mobileLabel ?? (typeof c.header === 'string' ? c.header : '')}</dt>
                        <dd className="min-w-0 truncate">{c.cell(row)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </div>
              {actions && (
                <div className="flex items-start -mr-2" onClick={parar}>
                  {actions(row)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DataTablePagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          Anterior
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Próxima
        </Button>
      </div>
    </div>
  );
}
