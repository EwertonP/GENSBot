'use client';

import React, { useEffect, useState } from 'react';
import { X, RotateCcw, Eye } from 'lucide-react';
import type { FlowDefinition } from '@/types/flow';

interface VersionSummary {
  id: string;
  version_number: number;
  label: string | null;
  created_at: string;
}

interface VersionHistoryPanelProps {
  automationId: string;
  onClose: () => void;
  onView: (flow: FlowDefinition, versionId: string) => void;
  onRestore: (versionId: string) => void;
  viewingVersionId: string | null;
}

/** Painel de histórico de versões (Fase 5) — lista snapshots, permite visualizar (read-only) ou restaurar. */
export default function VersionHistoryPanel({ automationId, onClose, onView, onRestore, viewingVersionId }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/automations/${automationId}/versions`)
      .then((res) => res.json())
      .then((data) => setVersions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [automationId]);

  const handleView = async (versionId: string) => {
    const res = await fetch(`/api/automations/${automationId}/versions/${versionId}`);
    const data = await res.json();
    if (res.ok && data.flow_definition) onView(data.flow_definition as FlowDefinition, versionId);
  };

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card p-4 flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">Histórico de versões</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Fechar histórico">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading && <p className="text-[11px] text-muted-foreground">Carregando...</p>}
      {!loading && versions.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Nenhuma versão anterior ainda — o histórico começa a partir do próximo save.</p>
      )}

      <div className="flex flex-col gap-2">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`border rounded-lg p-2.5 flex flex-col gap-1.5 ${
              viewingVersionId === v.id ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground">Versão {v.version_number}</span>
              <span className="text-[9px] text-muted-foreground">{new Date(v.created_at).toLocaleString('pt-BR')}</span>
            </div>
            {v.label && <span className="text-[10px] text-muted-foreground">{v.label}</span>}
            <div className="flex gap-1.5">
              <button
                onClick={() => handleView(v.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-foreground bg-background hover:bg-accent border border-border rounded px-2 py-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" /> Ver
              </button>
              <button
                onClick={() => {
                  if (confirm(`Restaurar a versão ${v.version_number}? Isso salva um novo snapshot do estado atual antes de restaurar.`)) {
                    onRestore(v.id);
                  }
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/90 bg-background hover:bg-accent border border-border rounded px-2 py-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
