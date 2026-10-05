'use client';
import { DataTable } from '@/components/ui/data-table';
import { IconButton } from '@/components/ui/icon-button';
import { Tip } from '@/components/ui/tooltip';

import React from 'react';
import { Plus, Trash2, Search, Settings, Workflow } from 'lucide-react';
import type { Automation } from '@/types/automation';
import { getEffectiveTrigger } from '@/lib/automation-display';
import AutomationMediaThumb from '@/components/automation-media-thumb';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';

interface AutomationTableProps {
  automations: Automation[];
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  /** Abre a automação no editor visual (canvas) em vez do form linear. */
  onOpenFlowBuilder: (automation: Automation) => void;
}

const TRIGGER_LABELS: Record<string, string> = {
  comment: 'Comentários',
  story: 'Stories',
  dm: 'DM',
};

/** `updated_at` só existe depois da primeira edição; cai pra data de criação. */
function formatDate(auto: Automation): string {
  const raw = auto.updated_at || auto.created_at;
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export default function AutomationTable({
  automations,
  onEdit,
  onDelete,
  onCreate,
  onOpenFlowBuilder,
}: AutomationTableProps) {
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return automations;
    return automations.filter(
      a =>
        a.name.toLowerCase().includes(q) ||
        a.keywords.some(k => k.toLowerCase().includes(q))
    );
  }, [automations, search]);

  if (automations.length === 0) {
    return (
      <EmptyState
        icon={Settings}
        title="Nenhuma automação cadastrada"
        description="Crie seu primeiro fluxo para responder comentários e DMs automaticamente."
        action={{ label: 'Criar Primeira Automação', onClick: onCreate, icon: Plus }}
      />
    );
  }

  return (
    <Card padding="lg" className="rounded-2xl flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input type="search" placeholder="Buscar por nome ou palavra-chave" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar automações" className="pl-9" />
        </div>
        <Badge variant="muted" className="tabular-nums">
          {automations.length} automaç{automations.length !== 1 ? 'ões' : 'ão'}
        </Badge>
        <Button onClick={onCreate} size="sm" className="ml-auto flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Nova automação
        </Button>
      </div>

      <DataTable
        rows={filtered}
        getRowId={(auto) => auto.id || auto.name}
        onRowClick={onEdit}
        empty={<EmptyState size="compact" icon={Search} title="Nenhuma automação encontrada" description={`Nada bate com “${search}”.`} action={{ label: 'Limpar busca', onClick: () => setSearch('') }} />}
        columns={[
          {
            id: 'nome',
            header: 'Automação',
            mobile: 'primary',
            cell: (auto) => {
              const t = getEffectiveTrigger(auto);
              const kind: 'post' | 'story' | null = t.specific_post_id ? 'post' : t.specific_story_id ? 'story' : null;
              return (
                <div className="flex items-center gap-2.5 min-w-0 sm:min-w-[200px]">
                  <AutomationMediaThumb mediaId={t.specific_post_id || t.specific_story_id} kind={kind} triggers={t.triggers} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(auto);
                    }}
                    className="font-semibold text-foreground truncate max-w-[260px] text-left hover:underline cursor-pointer"
                  >
                    {auto.name}
                  </button>
                </div>
              );
            },
          },
          {
            id: 'gatilhos',
            header: 'Gatilhos',
            cell: (auto) => (
              <div className="flex gap-1 flex-wrap">
                {getEffectiveTrigger(auto).triggers.map((t) => (
                  <Badge key={t} variant="info">
                    {TRIGGER_LABELS[t] || t}
                  </Badge>
                ))}
              </div>
            ),
          },
          {
            id: 'palavras',
            header: 'Palavras-chave',
            cell: (auto) => (
              <div className="flex gap-1 flex-wrap items-center">
                {auto.keywords.slice(0, 2).map((kw) => (
                  <Badge key={kw} variant="muted" className="font-mono">
                    {kw}
                  </Badge>
                ))}
                {auto.keywords.length > 2 && (
                  <Tip label={auto.keywords.slice(2).join(', ')}>
                    <span className="text-xs text-muted-foreground font-medium">+{auto.keywords.length - 2}</span>
                  </Tip>
                )}
                {auto.keywords.length === 0 && <span className="text-muted-foreground">—</span>}
              </div>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (auto) => (
              <Badge variant={auto.active ? 'success' : 'muted'} dot>
                {auto.active ? 'Ativa' : 'Pausada'}
              </Badge>
            ),
          },
          { id: 'modificado', header: 'Modificado', align: 'right', className: 'text-xs text-muted-foreground tabular-nums whitespace-nowrap', cell: formatDate },
        ]}
        actions={(auto) => (
          <>
            <IconButton label="Abrir no editor visual" onClick={() => onOpenFlowBuilder(auto)}>
              <Workflow />
            </IconButton>
            <IconButton label="Excluir automação" tone="destructive" onClick={() => auto.id && onDelete(auto.id)}>
              <Trash2 />
            </IconButton>
          </>
        )}
      />
    </Card>
  );
}
