'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tip } from '@/components/ui/tooltip';
import { ScrollShadow } from '@/components/ui/scroll-shadow';
import { formatarMoeda, calcularDiasSemContato, gerarLinkWhatsApp, formatarMensagemWhatsApp } from '@/lib/crm';
import type { CrmEstagio, CrmNegocio } from '@/types/crm';
import {
  MessageSquare,
  AlertTriangle,
  Building,
  User,
  ExternalLink,
  Zap,
  FileText,
  Target,
  Plus,
} from 'lucide-react';

interface CrmKanbanProps {
  estagios: CrmEstagio[];
  negocios: CrmNegocio[];
  onMoverNegocio: (negocioId: string, novoEstagioId: string, targetNegocioId?: string | null) => Promise<void>;
  onAbrirNegocio: (negocio: CrmNegocio) => void;
  onNovoNegocioNoEstagio?: (estagioId: string) => void;
}

const ORIGEM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  instagram: { label: 'Instagram', icon: Zap, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  formulario: { label: 'Formulário', icon: FileText, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  webhook_ads: { label: 'Meta Ads', icon: Target, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  indicacao: { label: 'Indicação', icon: User, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  manual: { label: 'Manual', icon: User, color: 'bg-muted text-muted-foreground border-border' },
  outros: { label: 'Outros', icon: User, color: 'bg-muted text-muted-foreground border-border' },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  alta: { label: 'Alta', color: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  media: { label: 'Média', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground border-border' },
};

export default function CrmKanban({
  estagios,
  negocios,
  onMoverNegocio,
  onAbrirNegocio,
  onNovoNegocioNoEstagio,
}: CrmKanbanProps) {
  const [draggingNegocioId, setDraggingNegocioId] = useState<string | null>(null);
  const [draggingOverEstagioId, setDraggingOverEstagioId] = useState<string | null>(null);
  const [draggingOverNegocioId, setDraggingOverNegocioId] = useState<string | null>(null);

  return (
    <ScrollShadow className="w-full pb-4">
      <div className="flex gap-4 p-1 min-w-full">
        {estagios.map((estagio, estagioIdx) => {
          const cardsDaColuna = negocios.filter((n) => n.estagio_id === estagio.id);
          const valorTotalColuna = cardsDaColuna.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
          const isOver = draggingOverEstagioId === estagio.id;

          return (
            <div
              key={estagio.id}
              id={`estagio-${estagio.id}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggingOverEstagioId !== estagio.id) setDraggingOverEstagioId(estagio.id);
              }}
              onDragLeave={() => {
                if (draggingOverEstagioId === estagio.id) setDraggingOverEstagioId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingOverEstagioId(null);
                setDraggingNegocioId(null);
                const negocioId = e.dataTransfer.getData('text/plain');
                if (negocioId) {
                  onMoverNegocio(negocioId, estagio.id);
                }
              }}
              className={`w-80 snap-start shrink-0 flex flex-col gap-3 p-3.5 rounded-2xl border transition-all duration-200 min-h-[520px] ${
                isOver
                  ? 'bg-lime/10 border-primary ring-2 ring-primary/20 shadow-md'
                  : 'bg-accent/25 border-border'
              }`}
            >
              {/* Cabeçalho da Coluna */}
              <div className="flex flex-col gap-1 px-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: estagio.cor || '#3b82f6' }}
                    />
                    <span className="text-xs font-bold font-display text-foreground truncate max-w-[170px]">
                      {estagio.nome}
                    </span>
                    <span className="text-[11px] font-mono font-bold bg-accent text-muted-foreground px-1.5 py-0.5 rounded-md border border-border">
                      {cardsDaColuna.length}
                    </span>
                  </div>

                  {onNovoNegocioNoEstagio && (
                    <Tip label="Adicionar oportunidade nesta etapa">
                      <button
                        type="button"
                        onClick={() => onNovoNegocioNoEstagio(estagio.id)}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </Tip>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-0.5">
                  <span>Total</span>
                  <span className="font-bold text-foreground">{formatarMoeda(valorTotalColuna)}</span>
                </div>
              </div>

              {/* Lista de Cards da Coluna */}
              <div className="flex flex-col gap-2.5 flex-1">
                {cardsDaColuna.map((negocio) => {
                  const isDragging = draggingNegocioId === negocio.id;
                  const isOverCard = draggingOverNegocioId === negocio.id;
                  const diasSemContato = calcularDiasSemContato(negocio.ultimo_contato_em);
                  const limiteEstagnado = estagio.dias_limite_estagnado ?? 3;
                  const estagnado = estagio.tipo_conclusao === 'aberto' && limiteEstagnado > 0 && diasSemContato >= limiteEstagnado;

                  const origemMeta = ORIGEM_CONFIG[negocio.origem] || ORIGEM_CONFIG.manual;
                  const OrigemIcon = origemMeta.icon;
                  const prioridadeMeta = PRIORIDADE_CONFIG[negocio.prioridade] || PRIORIDADE_CONFIG.media;

                  return (
                    <Card
                      key={negocio.id}
                      draggable={true}
                      tabIndex={0}
                      role="group"
                      aria-label={`${negocio.titulo} — ${estagio.nome}. Enter abre; Alt + setas movem de etapa.`}
                      onClick={() => onAbrirNegocio(negocio)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onAbrirNegocio(negocio);
                          return;
                        }
                        if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                          e.preventDefault();
                          const proximoEstagio = estagios[estagioIdx + (e.key === 'ArrowRight' ? 1 : -1)];
                          if (proximoEstagio) onMoverNegocio(negocio.id, proximoEstagio.id);
                        }
                      }}
                      onDragStart={(e) => {
                        setDraggingNegocioId(negocio.id);
                        e.dataTransfer.setData('text/plain', negocio.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingNegocioId(null);
                        setDraggingOverNegocioId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggingOverNegocioId !== negocio.id) setDraggingOverNegocioId(negocio.id);
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        if (draggingOverNegocioId === negocio.id) setDraggingOverNegocioId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraggingOverEstagioId(null);
                        setDraggingNegocioId(null);
                        setDraggingOverNegocioId(null);
                        const draggedId = e.dataTransfer.getData('text/plain');
                        if (draggedId) {
                          onMoverNegocio(draggedId, estagio.id, negocio.id);
                        }
                      }}
                      className={`group p-3 rounded-xl border bg-card shadow-2xs hover:shadow-xs transition-ui duration-200 flex flex-col gap-2.5 cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isDragging ? 'opacity-40 scale-[0.98]' : ''
                      } ${isOverCard ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-foreground/30'}`}
                    >
                      {/* Topo do Card: Origem, Prioridade e Valor */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${origemMeta.color}`}
                          >
                            <OrigemIcon className="w-2.5 h-2.5" />
                            <span>{origemMeta.label}</span>
                          </span>

                          {negocio.prioridade !== 'media' && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${prioridadeMeta.color}`}
                            >
                              {prioridadeMeta.label}
                            </span>
                          )}
                        </div>

                        <span className="font-mono font-bold text-xs text-foreground shrink-0">
                          {formatarMoeda(negocio.valor)}
                        </span>
                      </div>

                      {/* Título & Empresa */}
                      <div className="flex flex-col gap-0.5">
                        <h4 className="font-semibold text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {negocio.titulo}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate">{negocio.nome_contato}</span>
                          {negocio.empresa && (
                            <>
                              <span className="text-border">•</span>
                              <Building className="w-3 h-3 shrink-0" />
                              <span className="truncate">{negocio.empresa}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Alerta de Estagnação (se aplicável) */}
                      {estagnado && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{diasSemContato}d sem contato registrado</span>
                        </div>
                      )}

                      {/* Rodapé: Responsável e Botão de Ação Rápida */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            nome={negocio.responsavel?.nome || 'Não atribuído'}
                            size="sm"
                            className="w-5 h-5 text-[9px]"
                          />
                          <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">
                            {negocio.responsavel?.nome ? negocio.responsavel.nome.split(' ')[0] : 'Sem resp.'}
                          </span>
                        </div>

                        {/* Botão Rápido de WhatsApp */}
                        {negocio.telefone && (
                          <Tip label={`Chamar ${negocio.nome_contato.split(' ')[0]} no WhatsApp`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const msg = `Olá, ${negocio.nome_contato.split(' ')[0]}! Tudo bem?`;
                                const link = gerarLinkWhatsApp(negocio.telefone!, msg);
                                if (link) window.open(link, '_blank');
                              }}
                              className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </Tip>
                        )}
                      </div>
                    </Card>
                  );
                })}

                {cardsDaColuna.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground/60">
                    <span className="text-xs">Nenhum card aqui</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollShadow>
  );
}
