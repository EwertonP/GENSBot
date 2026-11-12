'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Send,
  Share2,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedItem } from '@/components/ui/segmented';
import { Tip } from '@/components/ui/tooltip';
import {
  mapearStatusParaColunaKanban,
  PRIORIDADE_CONFIG,
  type ConteudoItem,
} from '@/lib/conteudo';

interface AprovacaoGridProps {
  items: ConteudoItem[];
  onAbrirItem: (item: ConteudoItem) => void;
  onCopiarLink: (token?: string | null) => void;
  onEnviarWhatsApp: (item: ConteudoItem, reenviar?: boolean) => void;
  enviandoId?: string | null;
}

type FiltroAprovacao = 'todos' | 'pendente' | 'alteracao' | 'aprovado' | 'producao';

function ehAlteracao(item: ConteudoItem) {
  return (item as any).aprovacao_status === 'ajustes' || item.status === 'travado';
}

function ehAprovado(item: ConteudoItem) {
  const col = mapearStatusParaColunaKanban(item.status);
  return col === 'agendamento' || col === 'publicado' || (item as any).aprovacao_status === 'aprovado';
}

function ehPendente(item: ConteudoItem) {
  const col = mapearStatusParaColunaKanban(item.status);
  return !ehAlteracao(item) && !ehAprovado(item) && col === 'revisao_cliente';
}

function badgeStatusAprovacao(item: ConteudoItem) {
  if (ehAlteracao(item)) {
    return {
      label: 'Alteração',
      cls: 'bg-amber-500/95 text-white border-amber-400/50',
      Icon: AlertCircle,
    };
  }
  if (ehAprovado(item)) {
    return {
      label: 'Aprovado',
      cls: 'bg-emerald-600/95 text-white border-emerald-400/40',
      Icon: CheckCircle2,
    };
  }
  if (ehPendente(item)) {
    return {
      label: 'Pendente',
      cls: 'bg-zinc-900/85 text-white border-white/15',
      Icon: Clock,
    };
  }
  return {
    label: 'Em produção',
    cls: 'bg-sky-600/90 text-white border-sky-400/40',
    Icon: Clock,
  };
}

function formatarDataCurta(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarAgendamentoBadge(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `Agendado ${dia}/${mes} ${hora}:${min}`;
}

export function AprovacaoGrid({
  items,
  onAbrirItem,
  onCopiarLink,
  onEnviarWhatsApp,
  enviandoId,
}: AprovacaoGridProps) {
  const [filtro, setFiltro] = useState<FiltroAprovacao>('todos');

  const contagens = useMemo(() => {
    let pendente = 0;
    let alteracao = 0;
    let aprovado = 0;
    let producao = 0;
    for (const it of items) {
      if (ehAlteracao(it)) alteracao += 1;
      else if (ehAprovado(it)) aprovado += 1;
      else if (ehPendente(it)) pendente += 1;
      else producao += 1;
    }
    return { todos: items.length, pendente, alteracao, aprovado, producao };
  }, [items]);

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return items;
    return items.filter((it) => {
      if (filtro === 'alteracao') return ehAlteracao(it);
      if (filtro === 'aprovado') return ehAprovado(it);
      if (filtro === 'pendente') return ehPendente(it);
      return !ehAlteracao(it) && !ehAprovado(it) && !ehPendente(it);
    });
  }, [items, filtro]);

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de filtros por status de aprovação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtrar por status de aprovação"
          className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1 shadow-2xs"
        >
          {(
            [
              ['todos', `Todos (${contagens.todos})`],
              ['pendente', `Pendentes (${contagens.pendente})`],
              ['alteracao', `Alteração (${contagens.alteracao})`],
              ['aprovado', `Aprovados (${contagens.aprovado})`],
              ['producao', `Em produção (${contagens.producao})`],
            ] as const
          ).map(([id, label]) => (
            <SegmentedItem
              key={id}
              group="aprovacao-status"
              active={filtro === id}
              onClick={() => setFiltro(id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              {label}
            </SegmentedItem>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum post nesta categoria"
          description="Altere o filtro acima ou cadastre novas demandas com mídia na esteira."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map((item) => {
            const capaUrl =
              (item.tipo === 'reel' && item.cover_url) ||
              item.arquivos?.[0]?.url ||
              (item as any).midia_url ||
              null;
            const statusInfo = badgeStatusAprovacao(item);
            const StatusIcon = statusInfo.Icon;
            const agendadoBadge = formatarAgendamentoBadge(item.data_programada);
            const dataExibicao = formatarDataCurta(item.data_programada || item.prazo || item.criado_em);
            const prioCfg = item.prioridade ? PRIORIDADE_CONFIG[item.prioridade] : null;
            const formatoLabel =
              item.tipo === 'post'
                ? 'Carrossel'
                : item.tipo === 'reel'
                ? 'Reels'
                : item.tipo === 'story'
                ? 'Story'
                : 'Post';

            return (
              <div
                key={item.id}
                onClick={() => onAbrirItem(item)}
                className="group rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs hover:shadow-md hover:border-foreground/25 transition-all duration-200 flex flex-col cursor-pointer"
              >
                {/* Capa em proporção real 4:5 (1080×1350) com badges flutuantes */}
                <div
                  className="relative w-full bg-black/60 overflow-hidden border-b border-border/60 shrink-0"
                  style={{ aspectRatio: '4 / 5' }}
                >
                  {capaUrl ? (
                    item.tipo === 'reel' && capaUrl.match(/\.(mp4|mov|webm)/i) ? (
                      <video src={capaUrl} className="absolute inset-0 w-full h-full object-contain" muted />
                    ) : (
                      <img
                        src={capaUrl}
                        alt={item.titulo || 'Prévia da arte'}
                        className="absolute inset-0 w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/50 bg-accent/20">
                      <ImageIcon className="size-8" />
                      <span className="text-[11px] font-medium">Sem arte anexada</span>
                    </div>
                  )}

                  {/* Badges flutuantes no canto superior esquerdo */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-col items-start gap-1.5 pointer-events-none">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm backdrop-blur-xs ${statusInfo.cls}`}
                    >
                      <StatusIcon className="size-3" />
                      {statusInfo.label}
                    </span>

                    {agendadoBadge && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-600/95 text-white border border-blue-400/40 shadow-sm backdrop-blur-xs">
                        <Calendar className="size-2.5" />
                        {agendadoBadge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Informações do Card */}
                <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ClienteAvatar
                        nome={item.cliente?.nome || 'Cliente'}
                        cor={item.cliente?.cor}
                        fotoUrl={item.cliente?.foto_url}
                        tamanho="xs"
                      />
                      <span className="text-[11px] font-medium text-muted-foreground truncate">
                        {item.cliente?.nome || 'Cliente da Agência'}
                      </span>
                    </div>

                    <h4 className="font-display font-bold text-sm text-foreground leading-snug line-clamp-2">
                      {item.titulo || 'Demanda sem título'}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {formatoLabel}
                      </span>

                      {prioCfg && (item.prioridade === 'alta' || item.prioridade === 'urgente') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {prioCfg.label}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent text-muted-foreground border border-border/60">
                        {item.data_programada ? 'Programado' : 'Não programado'}
                      </span>
                    </div>
                  </div>

                  {/* Rodapé: Data + Ações rápidas */}
                  <div
                    className="flex items-center justify-between gap-2 pt-2.5 mt-1 border-t border-border/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                      <Calendar className="size-3" />
                      {dataExibicao || 'Sem data'}
                    </span>

                    <div className="flex items-center gap-1">
                      {item.token_aprovacao && (
                        <>
                          <Tip label="Copiar link de aprovação">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onCopiarLink(item.token_aprovacao)}
                              className="h-7 px-2 text-[11px] rounded-full hover:bg-accent"
                            >
                              <Share2 className="size-3" />
                            </Button>
                          </Tip>
                          <Tip label="Abrir tela de aprovação">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/aprovacao/${item.token_aprovacao}`, '_blank')}
                              className="h-7 px-2 text-[11px] rounded-full hover:bg-accent"
                            >
                              <ExternalLink className="size-3" />
                            </Button>
                          </Tip>
                        </>
                      )}

                      <Tip label="Enviar para aprovação no WhatsApp">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={enviandoId === item.id}
                          onClick={() => onEnviarWhatsApp(item, item.status === 'revisao_cliente')}
                          className="h-7 px-2.5 text-[11px] font-semibold rounded-full border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Send className="size-3 mr-1" />
                          Enviar
                        </Button>
                      </Tip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
