'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Cliente } from '@/lib/clientes';

export interface DuplicarMesSheetProps {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  duplicarClienteId: string;
  setDuplicarClienteId: (v: string) => void;
  duplicarMesOrigem: string;
  setDuplicarMesOrigem: (v: string) => void;
  duplicarMesDestino: string;
  setDuplicarMesDestino: (v: string) => void;
  duplicando: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/** Duplica os conteúdos de um mês de um cliente para outro mês. */
export function DuplicarMesSheet({
  open,
  onClose,
  clientes,
  duplicarClienteId,
  setDuplicarClienteId,
  duplicarMesOrigem,
  setDuplicarMesOrigem,
  duplicarMesDestino,
  setDuplicarMesDestino,
  duplicando,
  onSubmit,
}: DuplicarMesSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      aria-label="Duplicar Mês"
    >
      <form onSubmit={onSubmit} className="p-6 flex flex-col gap-5 max-w-md">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
            Agilidade & Escala
          </span>
          <h3 className="text-lg sm:text-xl font-bold font-display text-foreground mt-0.5">
            Duplicar Mês de Conteúdo
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Clona todas as demandas do mês de origem para o novo período com status reiniciado em Planejamento.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">
            Cliente
          </label>
          <Select
            value={duplicarClienteId}
            onChange={(e) => setDuplicarClienteId(e.target.value)}
            required
          >
            <option value="">Selecione o cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Mês de Origem
            </label>
            <Input
              type="month"
              value={duplicarMesOrigem}
              onChange={(e) => setDuplicarMesOrigem(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Mês de Destino
            </label>
            <Input
              type="month"
              value={duplicarMesDestino}
              onChange={(e) => setDuplicarMesDestino(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-accent/40 border border-border text-xs text-muted-foreground flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p>
            As cópias são criadas como demandas novas independentes. Briefings, legendas e carrosséis são preservados, e o status é resetado para o início da esteira.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onClose()}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={duplicando}>
            Duplicar Demandas Agora
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
