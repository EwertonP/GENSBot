'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Layers } from 'lucide-react';
import type { Sequence } from '@/types/sequence';
import type { Followup } from '@/types/automation';

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground transition-colors';

function emptyStep(): Followup {
  return { id: crypto.randomUUID(), delay_minutes: 5, text: '' };
}

/** Tela de gestão de sequências reutilizáveis (Fase 4) — desacopladas de uma automação específica, referenciadas pelo `sequence_id` de um nó `sendMessage` no editor visual. */
export default function SequenceManager() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sequence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sequences');
      const data = await res.json();
      setSequences(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    setError(null);
    try {
      const url = editing.id ? `/api/sequences/${editing.id}` : '/api/sequences';
      const method = editing.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, steps: editing.steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar sequência.');
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
    await load();
  };

  if (editing) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{editing.id ? 'Editar sequência' : 'Nova sequência'}</h3>
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Cancelar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-[11px] text-destructive font-bold">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome</label>
          <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Passos</label>
            <button
              onClick={() => setEditing({ ...editing, steps: [...editing.steps, emptyStep()] })}
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/90 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Adicionar passo
            </button>
          </div>

          {editing.steps.map((step, i) => (
            <div key={step.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground">Passo {i + 1}</span>
                <button
                  onClick={() => setEditing({ ...editing, steps: editing.steps.filter((s) => s.id !== step.id) })}
                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                  aria-label={`Remover passo ${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-muted-foreground">Atraso (min)</label>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={step.delay_minutes}
                    onChange={(e) => {
                      const steps = editing.steps.map((s) => (s.id === step.id ? { ...s, delay_minutes: Number(e.target.value) } : s));
                      setEditing({ ...editing, steps });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-muted-foreground">Texto</label>
                  <textarea
                    rows={2}
                    className={inputCls}
                    value={step.text}
                    onChange={(e) => {
                      const steps = editing.steps.map((s) => (s.id === step.id ? { ...s, text: e.target.value } : s));
                      setEditing({ ...editing, steps });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {editing.steps.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum passo ainda — adicione o primeiro acima.</p>}
        </div>

        <button
          onClick={handleSave}
          className="self-start flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> Salvar sequência
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setEditing({ name: '', steps: [] })}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Nova Sequência
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : sequences.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center flex flex-col items-center gap-6">
          <div className="p-4 rounded-lg bg-accent text-muted-foreground border border-border">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-bold text-foreground">Nenhuma sequência cadastrada</h4>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
              Sequências são séries de mensagens reutilizáveis entre automações — crie uma e referencie no nó de mensagem do editor visual.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
          {sequences.map((seq) => (
            <div key={seq.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
              <button onClick={() => setEditing(seq)} className="text-left cursor-pointer flex-1">
                <p className="text-xs font-bold text-foreground">{seq.name}</p>
                <p className="text-[10px] text-muted-foreground">{seq.steps.length} passo(s)</p>
              </button>
              <button
                onClick={() => seq.id && handleDelete(seq.id)}
                aria-label={`Excluir sequência ${seq.name}`}
                className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
