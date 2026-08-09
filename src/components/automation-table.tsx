'use client';

import React from 'react';
import { Plus, Trash2, Search, Settings, Workflow } from 'lucide-react';
import type { Automation } from '@/types/automation';

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
      <div className="bg-card border border-border rounded-lg p-16 text-center flex flex-col items-center gap-6">
        <div className="p-4 rounded-lg bg-accent text-muted-foreground border border-border">
          <Settings className="w-8 h-8" />
        </div>
        <div>
          <h4 className="font-bold text-foreground">Nenhuma automação cadastrada</h4>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            Crie seu primeiro fluxo para responder comentários e DMs automaticamente.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Criar Primeira Automação
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nome ou palavra-chave..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar automações"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground transition-colors"
          />
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Automação
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Nome</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Gatilhos</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Palavras-chave</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground">Status</th>
                <th scope="col" className="px-4 py-2.5 font-bold text-foreground text-right">Modificado</th>
                <th scope="col" className="px-4 py-2.5 w-10"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(auto => (
                <tr
                  key={auto.id}
                  onClick={() => onEdit(auto)}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-bold text-foreground">{auto.name}</td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {auto.triggers.map(t => (
                        <span
                          key={t}
                          className="text-[9px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20 uppercase tracking-wider"
                        >
                          {TRIGGER_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap items-center">
                      {auto.keywords.slice(0, 2).map(kw => (
                        <span
                          key={kw}
                          className="text-[9px] bg-muted border border-border text-muted-foreground px-1.5 py-0.5 rounded font-mono"
                        >
                          {kw}
                        </span>
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
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Nenhuma automação encontrada para “{search}”.
          </div>
        )}
      </div>
    </div>
  );
}
