'use client';

import React, { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tip } from '@/components/ui/tooltip';
import type { CrmPipeline, CrmEstagio } from '@/types/crm';
import { Plus, Trash2, ArrowUp, ArrowDown, Layers, Palette, X } from 'lucide-react';

interface CrmPipelineModalProps {
  open: boolean;
  onClose: () => void;
  clienteId?: string | null;
  pipelineParaEditar?: CrmPipeline | null;
  onSalvo: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface EstagioEdicao {
  id?: string;
  nome: string;
  cor: string;
  tipo_conclusao: 'aberto' | 'ganho' | 'perdido';
  dias_limite_estagnado: number;
}

const CORES_SUGERIDAS = [
  '#3b82f6', // azul
  '#6366f1', // indigo
  '#8b5cf6', // roxo
  '#ec4899', // rosa
  '#f59e0b', // âmbar
  '#10b981', // esmeralda
  '#14b8a6', // teal
  '#ef4444', // vermelho
];

export default function CrmPipelineModal({
  open,
  onClose,
  clienteId,
  pipelineParaEditar,
  onSalvo,
  showToast,
}: CrmPipelineModalProps) {
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [estagios, setEstagios] = useState<EstagioEdicao[]>([]);

  useEffect(() => {
    if (open) {
      if (pipelineParaEditar) {
        setNome(pipelineParaEditar.nome || '');
        setDescricao(pipelineParaEditar.descricao || '');
        setEstagios(
          (pipelineParaEditar.estagios || []).map((e) => ({
            id: e.id,
            nome: e.nome,
            cor: e.cor || '#3b82f6',
            tipo_conclusao: e.tipo_conclusao || 'aberto',
            dias_limite_estagnado: e.dias_limite_estagnado ?? 3,
          }))
        );
      } else {
        setNome('');
        setDescricao('');
        setEstagios([
          { nome: 'Novo Lead', cor: '#3b82f6', tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
          { nome: 'Contato Feito', cor: '#6366f1', tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
          { nome: 'Proposta Enviada', cor: '#f59e0b', tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
          { nome: 'Fechado / Ganho', cor: '#10b981', tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
          { nome: 'Perdido', cor: '#ef4444', tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
        ]);
      }
    }
  }, [open, pipelineParaEditar]);

  const handleAddEstagio = () => {
    const novaCor = CORES_SUGERIDAS[estagios.length % CORES_SUGERIDAS.length];
    setEstagios([
      ...estagios,
      {
        nome: `Nova Etapa ${estagios.length + 1}`,
        cor: novaCor,
        tipo_conclusao: 'aberto',
        dias_limite_estagnado: 3,
      },
    ]);
  };

  const handleRemoveEstagio = (index: number) => {
    if (estagios.length <= 2) {
      showToast('O funil precisa ter ao menos duas etapas.', 'error');
      return;
    }
    setEstagios(estagios.filter((_, i) => i !== index));
  };

  const handleMoveEstagio = (index: number, direcao: 'up' | 'down') => {
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= estagios.length) return;
    const copia = [...estagios];
    const [removido] = copia.splice(index, 1);
    copia.splice(novoIndex, 0, removido);
    setEstagios(copia);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      showToast('O nome do funil é obrigatório.', 'error');
      return;
    }
    if (estagios.some((est) => !est.nome.trim())) {
      showToast('Todas as etapas precisam ter um nome.', 'error');
      return;
    }

    setSalvando(true);
    try {
      const url = pipelineParaEditar
        ? `/api/crm/pipelines/${pipelineParaEditar.id}`
        : '/api/crm/pipelines';
      const method = pipelineParaEditar ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          cliente_id: clienteId || null,
          estagios: estagios.map((est, idx) => ({
            ...est,
            ordem: idx,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar funil');
      }

      showToast(pipelineParaEditar ? 'Funil atualizado!' : 'Novo funil criado!', 'success');
      onSalvo();
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar funil', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onRequestClose={onClose}
      aria-label={pipelineParaEditar ? 'Editar Funil de Vendas' : 'Novo Funil de Vendas'}
      className="max-w-xl w-full"
    >
      <form onSubmit={handleSalvar} className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                {pipelineParaEditar ? 'Editar Funil de Vendas' : 'Novo Funil de Vendas'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure as etapas do pipeline e os limites de dias sem contato.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-foreground">Nome do Funil *</label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Comercial Principal, Prospecção B2B, Pós-Venda"
            className="h-8 text-xs"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-muted-foreground">Descrição (opcional)</label>
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Funil focado em fechamento de novos clientes para a agência"
            className="h-8 text-xs"
          />
        </div>

        {/* Lista de Estágios */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Etapas do Funil ({estagios.length})</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEstagio}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Adicionar Etapa</span>
            </Button>
          </div>

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {estagios.map((est, idx) => (
              <div
                key={est.id || idx}
                className="flex items-center gap-2 p-2 rounded-xl bg-accent/30 border border-border/70"
              >
                {/* Seletor de cor rápido */}
                <input
                  type="color"
                  value={est.cor}
                  onChange={(e) => {
                    const copia = [...estagios];
                    copia[idx].cor = e.target.value;
                    setEstagios(copia);
                  }}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                />

                {/* Nome da Etapa */}
                <Input
                  value={est.nome}
                  onChange={(e) => {
                    const copia = [...estagios];
                    copia[idx].nome = e.target.value;
                    setEstagios(copia);
                  }}
                  placeholder="Nome da etapa"
                  className="h-7 text-xs flex-1"
                />

                {/* Tipo de Conclusão */}
                <select
                  value={est.tipo_conclusao}
                  onChange={(e) => {
                    const copia = [...estagios];
                    copia[idx].tipo_conclusao = e.target.value as any;
                    setEstagios(copia);
                  }}
                  className="h-7 px-2 rounded-md border border-border bg-background text-[11px] font-medium"
                >
                  <option value="aberto">Em Aberto</option>
                  <option value="ganho">🏆 Ganho</option>
                  <option value="perdido">❌ Perdido</option>
                </select>

                {/* Dias Limite Alerta */}
                {est.tipo_conclusao === 'aberto' && (
                  <Tip label="Dias sem contato para alertar estagnação">
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        max="60"
                        value={est.dias_limite_estagnado}
                        onChange={(e) => {
                          const copia = [...estagios];
                          copia[idx].dias_limite_estagnado = parseInt(e.target.value, 10) || 0;
                          setEstagios(copia);
                        }}
                        className="w-12 h-7 text-xs text-center p-0 font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground">dias</span>
                    </div>
                  </Tip>
                )}

                {/* Reordenação */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveEstagio(idx, 'up')}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === estagios.length - 1}
                    onClick={() => handleMoveEstagio(idx, 'down')}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Excluir Etapa */}
                <button
                  type="button"
                  onClick={() => handleRemoveEstagio(idx)}
                  className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-accent/20">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={salvando}>
            {salvando && <Spinner className="w-3.5 h-3.5 mr-1" />}
            <span>{pipelineParaEditar ? 'Salvar Alterações' : 'Criar Funil'}</span>
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
