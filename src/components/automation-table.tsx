'use client';

import React from 'react';
import { Plus, Trash2, Search } from 'lucide-react';

interface AutomationTableProps {
  automations: any[];
  onEdit: (automation: any) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  mediaList?: any[];
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
}

export default function AutomationTable({
  automations,
  onEdit,
  onDelete,
  onCreate,
  mediaList = [],
  onSearchChange,
  searchQuery = '',
}: AutomationTableProps) {
  const [localSearch, setLocalSearch] = React.useState(searchQuery);

  React.useEffect(() => {
    onSearchChange?.(localSearch);
  }, [localSearch, onSearchChange]);

  if (automations.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-16 text-center flex flex-col items-center gap-6">
        <div className="p-4 rounded-lg bg-accent text-muted-foreground border border-border">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1"></circle>
            <path d="M12 1v6m0 6v6"></path>
            <path d="M4.22 4.22l4.24 4.24m5.08 0l4.24-4.24"></path>
            <path d="M19.78 4.22l-4.24 4.24m0 5.08l4.24 4.24"></path>
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-foreground">Nenhuma automação cadastrada</h4>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            Comece criando seu primeiro fluxo de automação.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Criar Primeira Automação
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar automações..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="w-full bg-accent border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground transition-colors"
          />
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Automação
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-bold text-foreground">Nome</th>
              <th className="px-4 py-2.5 font-bold text-foreground">Gatilhos</th>
              <th className="px-4 py-2.5 font-bold text-foreground">Status</th>
              <th className="px-4 py-2.5 font-bold text-foreground text-right">Executado</th>
              <th className="px-4 py-2.5 font-bold text-foreground text-right">Modificado</th>
              <th className="px-4 py-2.5 font-bold text-foreground w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {automations.map(auto => (
              <tr
                key={auto.id}
                onClick={() => onEdit(auto)}
                className="hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-bold text-foreground">{auto.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="flex gap-1 flex-wrap">
                    {auto.triggers?.slice(0, 2).map((t: string) => {
                      const label = t === 'comment' ? 'Comentários' : t === 'story' ? 'Stories' : 'DM';
                      return (
                        <span
                          key={t}
                          className="text-[9px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20 uppercase"
                        >
                          {label}
                        </span>
                      );
                    })}
                    {(auto.triggers?.length || 0) > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{(auto.triggers?.length || 0) - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      auto.active
                        ? 'bg-success/15 text-success border-success/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {auto.active ? 'Ativo' : 'Pausado'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">0</td>
                <td className="px-4 py-3 text-right text-muted-foreground text-[10px]">
                  {new Date(auto.updated_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onDelete(auto.id);
                    }}
                    className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
