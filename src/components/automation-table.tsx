'use client';

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            type="search"
            placeholder="Buscar por nome ou palavra-chave..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar automações"
            className="pl-9"
          />
        </div>
        <Button onClick={onCreate} size="sm" className="flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Nova Automação
        </Button>
      </div>

      <Card padding="sm" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th scope="col" className="px-4 py-2.5 w-14"><span className="sr-only">Mídia</span></th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Nome</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Gatilhos</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Palavras-chave</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Status</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground text-right">Modificado</th>
                <th scope="col" className="px-4 py-2.5 w-10"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(auto => {
                const effectiveTrigger = getEffectiveTrigger(auto);
                const mediaId = effectiveTrigger.specific_post_id || effectiveTrigger.specific_story_id;
                const mediaKind: 'post' | 'story' | null = effectiveTrigger.specific_post_id
                  ? 'post'
                  : effectiveTrigger.specific_story_id
                  ? 'story'
                  : null;
                return (
                <tr
                  key={auto.id}
                  onClick={() => onEdit(auto)}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <AutomationMediaThumb mediaId={mediaId} kind={mediaKind} triggers={effectiveTrigger.triggers} />
                  </td>

                  <td className="px-4 py-3 font-bold text-foreground">{auto.name}</td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {effectiveTrigger.triggers.map(t => (
                        <Badge key={t} variant="info" className="rounded uppercase tracking-wider">
                          {TRIGGER_LABELS[t] || t}
                        </Badge>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap items-center">
                      {auto.keywords.slice(0, 2).map(kw => (
                        <Badge key={kw} className="rounded font-mono">
                          {kw}
                        </Badge>
                      ))}
                      {auto.keywords.length > 2 && (
                        <span className="text-[9px] text-muted-foreground font-bold">
                          +{auto.keywords.length - 2}
                        </span>
                      )}
                      {auto.keywords.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                        auto.active ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          auto.active ? 'bg-success' : 'bg-muted-foreground'
                        }`}
                      />
                      {auto.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {formatDate(auto)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onOpenFlowBuilder(auto);
                        }}
                        aria-label={`Abrir ${auto.name} no editor visual`}
                        title="Editor visual (canvas)"
                        className="p-1.5 hover:bg-accent text-muted-foreground hover:text-primary rounded-lg transition-colors cursor-pointer"
                      >
                        <Workflow className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (auto.id) onDelete(auto.id);
                        }}
                        aria-label={`Excluir automação ${auto.name}`}
                        className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Nenhuma automação encontrada para “{search}”.
          </div>
        )}
      </Card>
    </div>
  );
}
