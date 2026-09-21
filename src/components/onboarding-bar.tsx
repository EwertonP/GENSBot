'use client';

import React, { useState } from 'react';
import { Check, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react';
import { ETAPAS_ONBOARDING_PADRAO, type Cliente, type EtapaOnboarding } from '@/lib/clientes';

interface OnboardingBarProps {
  cliente: Cliente;
  onAtualizarCliente?: (clienteAtualizado: Cliente) => void;
  showToast?: (message: string, type: 'success' | 'error') => void;
}

export function OnboardingBar({ cliente, onAtualizarCliente, showToast }: OnboardingBarProps) {
  const etapasAtuais: EtapaOnboarding[] =
    cliente.onboarding_etapas && cliente.onboarding_etapas.length > 0
      ? cliente.onboarding_etapas
      : ETAPAS_ONBOARDING_PADRAO;

  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const concluidasCount = etapasAtuais.filter((e) => e.concluida).length;
  const totalCount = etapasAtuais.length;
  const percent = Math.round((concluidasCount / totalCount) * 100);

  async function handleToggleEtapa(etapaId: string) {
    const novasEtapas = etapasAtuais.map((e) =>
      e.id === etapaId
        ? {
            ...e,
            concluida: !e.concluida,
            concluida_em: !e.concluida ? new Date().toISOString() : null,
          }
        : e
    );

    setSalvandoId(etapaId);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_etapas: novasEtapas }),
      });

      if (!res.ok) throw new Error('Erro ao salvar etapa');
      const data = await res.json();
      const atualizado: Cliente = data.cliente || { ...cliente, onboarding_etapas: novasEtapas };
      onAtualizarCliente?.(atualizado);

      const etapa = novasEtapas.find((e) => e.id === etapaId);
      if (etapa?.concluida) {
        showToast?.(`Etapa "${etapa.label}" concluída! 🎉`, 'success');
      }
    } catch {
      showToast?.('Não foi possível salvar a alteração.', 'error');
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <div className="w-full bg-card/70 border border-border/80 rounded-2xl p-4 flex flex-col gap-3 shadow-2xs backdrop-blur-sm transition-all select-none">
      {/* Top Header: Título, Progresso e Barra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                Etapas de Onboarding
              </span>
              <span className="text-[11px] font-bold font-mono text-primary px-1.5 py-0.2 rounded-md bg-primary/15 border border-primary/30">
                {concluidasCount}/{totalCount}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Passo a passo fundamental para ativação e alinhamento de marca do cliente
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="flex items-center gap-3 self-end sm:self-auto min-w-[180px]">
          <div className="flex-1 h-2 bg-accent/60 rounded-full overflow-hidden border border-border/60">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(216,255,60,0.5)]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-foreground tabular-nums">{percent}%</span>
        </div>
      </div>

      {/* Lista Horizontal de Pílulas / Checklist (com scroll suave se passar da tela) */}
      <div className="flex flex-wrap gap-2 pt-1">
        {etapasAtuais.map((etapa) => {
          const isSaving = salvandoId === etapa.id;
          const isDone = etapa.concluida;

          return (
            <button
              key={etapa.id}
              type="button"
              disabled={isSaving}
              onClick={() => handleToggleEtapa(etapa.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isDone
                  ? 'bg-primary/15 border-primary/45 text-foreground hover:bg-primary/20 shadow-2xs'
                  : 'bg-accent/25 border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              ) : isDone ? (
                <div className="w-4 h-4 rounded-full bg-primary text-black flex items-center justify-center shrink-0 shadow-xs">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground/80 shrink-0 transition-colors" />
              )}
              <span className={`transition-all ${isDone ? 'font-bold text-foreground' : ''}`}>
                {etapa.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
