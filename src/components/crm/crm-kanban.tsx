'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tip } from '@/components/ui/tooltip';
import { ScrollShadow } from '@/components/ui/scroll-shadow';
import {
  formatarMoeda,
  calcularDiasSemContato,
  gerarLinkWhatsApp,
  calcularTierScore,
  formatarFollowupRelativo,
} from '@/lib/crm';
import type { CrmEstagio, CrmNegocio } from '@/types/crm';
import {
  Building,
  User,
  Zap,
  FileText,
  Target,
  Plus,
  Phone,
  Globe,
  Search,
  MessageCircle,
  MapPin,
  Clock,
  Flame,
  Stethoscope,
  HeartPulse,
  Scale,
  Building2,
  Briefcase,
  GripVertical,
  AlertTriangle,
} from 'lucide-react';

interface CrmKanbanProps {
  estagios: CrmEstagio[];
  negocios: CrmNegocio[];
  onMoverNegocio: (negocioId: string, novoEstagioId: string, targetNegocioId?: string | null) => Promise<void>;
  onAbrirNegocio: (negocio: CrmNegocio) => void;
  onNovoNegocioNoEstagio?: (estagioId: string) => void;
}

const ORIGEM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  presencial: { label: 'Presencial', icon: Building, color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  ligacao: { label: 'Ligação', icon: Phone, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  instagram: { label: 'Instagram', icon: Zap, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  google: { label: 'Google', icon: Search, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  site: { label: 'Site', icon: Globe, color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  formulario: { label: 'Formulário', icon: FileText, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  webhook_ads: { label: 'Meta Ads', icon: Target, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  indicacao: { label: 'Indicação', icon: User, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  manual: { label: 'Manual', icon: User, color: 'bg-muted text-muted-foreground border-border' },
  outros: { label: 'Outros', icon: User, color: 'bg-muted text-muted-foreground border-border' },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgente: { label: 'Urgente', color: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
  alta: { label: 'Alta', color: 'bg-amber-500/15 text-amber-500 border-amber-500/30', dot: 'bg-amber-500' },
  media: { label: 'Média', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', dot: 'bg-blue-500' },
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

function obterIconeNicho(nicho?: string | null) {
  const n = (nicho || '').toLowerCase();
  if (n.includes('cardio') || n.includes('coraç')) return HeartPulse;
  if (
    n.includes('medic') ||
    n.includes('saude') ||
    n.includes('saúde') ||
    n.includes('clinic') ||
    n.includes('clínic') ||
    n.includes('derma') ||
    n.includes('odonto') ||
    n.includes('estet')
  ) {
    return Stethoscope;
  }
  if (n.includes('advog') || n.includes('direit') || n.includes('jurid') || n.includes('juríd')) {
    return Scale;
  }
  if (
    n.includes('imob') ||
    n.includes('corret') ||
    n.includes('imovel') ||
    n.includes('imóvel') ||
    n.includes('constru') ||
    n.includes('arquit')
  ) {
    return Building2;
  }
  if (n.includes('market') || n.includes('agenc') || n.includes('agênc') || n.includes('b2b') || n.includes('consult')) {
    return Briefcase;
  }
  return Target;
}

export default function CrmKanban({
  estagios,
  negocios,
  onMoverNegocio,
  onAbrirNegocio,
  onNovoNegocioNoEstagio,
}: CrmKanbanProps) {
  const [activeStageId, setActiveStageId] = useState<string | null>(estagios[0]?.id || null);
  const [draggingNegocioId, setDraggingNegocioId] = useState<string | null>(null);
  const [draggingOverEstagioId, setDraggingOverEstagioId] = useState<string | null>(null);
  const [draggingOverNegocioId, setDraggingOverNegocioId] = useState<string | null>(null);

  const rolarParaEstagio = (estagioId: string) => {
    setActiveStageId(estagioId);
    const el = document.getElementById(`estagio-${estagioId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {/* Mobile Stage Pill Scroller */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1.5 px-1 scrollbar-none no-scrollbar snap-x">
        {estagios.map((est) => {
          const count = negocios.filter((n) => n.estagio_id === est.id).length;
          const isActive = activeStageId === est.id;
          return (
            <button
              key={est.id}
              type="button"
              onClick={() => rolarParaEstagio(est.id)}
              className={`shrink-0 snap-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isActive
                  ? 'bg-foreground text-background border-foreground font-semibold shadow-2xs'
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: est.cor || '#3b82f6' }}
              />
              <span className="truncate max-w-[130px]">{est.nome}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-background/20 text-background' : 'bg-accent text-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <ScrollShadow className="w-full min-w-0 max-w-full pb-4">
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
                className={`w-[88vw] sm:w-[330px] max-w-[340px] snap-start shrink-0 flex flex-col gap-3 p-3.5 rounded-3xl border transition-all duration-200 min-h-[540px] ${
                  isOver
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-md'
                    : 'bg-accent/20 border-border/80 shadow-2xs'
                }`}
              >
                {/* Cabeçalho da Coluna (Inspirado na Referência Deals Pipeline) */}
                <div className="flex flex-col gap-1.5 px-1 pb-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: estagio.cor || '#3b82f6' }}
                      />
                      <span className="text-xs font-bold font-display text-foreground truncate max-w-[160px]">
                        {estagio.nome}
                      </span>
                      <span className="text-[11px] font-mono font-bold bg-card border border-border text-foreground px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                        {cardsDaColuna.length}
                      </span>
                    </div>

                    {onNovoNegocioNoEstagio && (
                      <Tip label="Adicionar oportunidade nesta etapa">
                        <button
                          type="button"
                          onClick={() => onNovoNegocioNoEstagio(estagio.id)}
                          className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all grid place-items-center cursor-pointer shadow-2xs"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </Tip>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-0.5 pt-0.5 border-t border-border/40">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Subtotal</span>
                    <span className="font-bold text-foreground text-xs">{formatarMoeda(valorTotalColuna)}</span>
                  </div>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="flex flex-col gap-3 flex-1">
                  {cardsDaColuna.map((negocio) => {
                    const isDragging = draggingNegocioId === negocio.id;
                    const isOverCard = draggingOverNegocioId === negocio.id;
                    const diasSemContato = calcularDiasSemContato(negocio.ultimo_contato_em);
                    const limiteEstagnado = estagio.dias_limite_estagnado ?? 3;
                    const estagnado =
                      estagio.tipo_conclusao === 'aberto' &&
                      limiteEstagnado > 0 &&
                      diasSemContato >= limiteEstagnado;

                    const origemMeta = ORIGEM_CONFIG[negocio.origem] || ORIGEM_CONFIG.manual;
                    const OrigemIcon = origemMeta.icon;
                    const prioridadeMeta = PRIORIDADE_CONFIG[negocio.prioridade] || PRIORIDADE_CONFIG.media;
                    const tierMeta = calcularTierScore(negocio.score_qualificacao);
                    const followupRelativo = formatarFollowupRelativo(negocio.data_proximo_followup);
                    const NichoIcon = obterIconeNicho(negocio.nicho);

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
                        className={`group p-3.5 rounded-2xl border bg-card shadow-2xs hover:shadow-md hover:border-border-strong transition-all duration-200 flex flex-col gap-2.5 cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isDragging ? 'opacity-40 scale-[0.98]' : ''
                        } ${isOverCard ? 'border-primary ring-2 ring-primary/20' : 'border-border/80 hover:border-foreground/25'}`}
                      >
                        {/* Topo do Card: Código #LEAD, Tier ICP, Prioridade e Handle */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-mono text-[10px] font-bold text-muted-foreground tracking-wider">
                              #{negocio.id.slice(0, 4).toUpperCase()}
                            </span>

                            {/* Badge Tier Score ICP */}
                            {tierMeta && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${tierMeta.badgeClass}`}
                                title={`Score ICP: ${negocio.score_qualificacao}/10 (${tierMeta.descricao})`}
                              >
                                <span>{tierMeta.emoji}</span>
                                <span>Tier {tierMeta.tier}</span>
                              </span>
                            )}

                            {/* Prioridade com pontinho */}
                            {negocio.prioridade && negocio.prioridade !== 'media' && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${prioridadeMeta.color}`}
                              >
                                <span className={`size-1 rounded-full ${prioridadeMeta.dot} animate-pulse`} />
                                <span>{prioridadeMeta.label}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                            <GripVertical className="size-3.5" />
                          </div>
                        </div>

                        {/* Hero Visual do Card (Inspirado no visual dos cards da Esteira de Demandas) */}
                        <div className="relative aspect-[16/7] w-full rounded-xl overflow-hidden border border-border/70 bg-gradient-to-br from-accent/50 via-card to-muted/40 p-2.5 flex flex-col justify-between shrink-0 group-hover:border-foreground/25 transition-all">
                          {/* Topo do Hero: Nicho Badge + Instagram */}
                          <div className="flex items-center justify-between gap-1 w-full min-w-0">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-card/90 backdrop-blur-xs border border-border/70 text-[10px] font-semibold text-foreground shadow-2xs truncate">
                              <NichoIcon className="size-3 text-primary shrink-0" />
                              <span className="truncate max-w-[120px]">{negocio.nicho || 'Geral'}</span>
                            </div>
                            {negocio.instagram_username && (
                              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 bg-card/90 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-border/60 shrink-0">
                                <Zap className="size-2.5 text-pink-500 shrink-0" />
                                <span className="truncate max-w-[90px]">@{negocio.instagram_username.replace(/^@/, '')}</span>
                              </span>
                            )}
                          </div>

                          {/* Base do Hero: Cidade/Localização + Valor em destaque */}
                          <div className="flex items-end justify-between gap-1 w-full min-w-0">
                            {negocio.cidade ? (
                              <div className="flex items-center gap-1 text-[10px] font-medium text-foreground bg-card/90 backdrop-blur-xs px-2 py-0.5 rounded-md border border-border/70 shadow-2xs truncate">
                                <MapPin className="size-2.5 text-primary shrink-0" />
                                <span className="truncate max-w-[120px] font-semibold">{negocio.cidade}{negocio.bairro ? ` · ${negocio.bairro}` : ''}</span>
                              </div>
                            ) : (
                              <div />
                            )}
                            <span className="text-xs font-mono font-bold text-foreground bg-card/95 backdrop-blur-xs px-2 py-0.5 rounded-md border border-border/80 shadow-2xs shrink-0">
                              {formatarMoeda(negocio.valor)}
                            </span>
                          </div>
                        </div>

                        {/* Título & Empresa em Sora */}
                        <div className="flex flex-col gap-0.5">
                          <h4 className="font-bold text-sm font-display text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {negocio.titulo}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                            {negocio.tipo_perfil === 'empresa' ? (
                              <Building className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <User className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate font-medium text-foreground/90">{negocio.nome_contato}</span>
                            {negocio.empresa && (
                              <>
                                <span className="text-border select-none">·</span>
                                <span className="truncate text-muted-foreground font-normal">
                                  {negocio.empresa}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Grade de Metadados Estruturados (Inspirada no Deals Pipeline) */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
                          <div className="flex items-center gap-1.5 text-muted-foreground truncate min-w-0">
                            <OrigemIcon className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{origemMeta.label}</span>
                          </div>

                          {followupRelativo ? (
                            <div
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border truncate min-w-0 ${
                                followupRelativo.atrasado
                                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-500 dark:text-rose-400'
                                  : followupRelativo.hoje
                                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                                  : 'bg-muted/50 border-border text-muted-foreground'
                              }`}
                            >
                              <Clock className="size-2.5 shrink-0" />
                              <span className="truncate">{followupRelativo.texto}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                              <Clock className="size-2.5 shrink-0" />
                              <span className="truncate">Sem follow-up</span>
                            </div>
                          )}
                        </div>

                        {/* Preview de Gargalo / Dor Principal (Estilo Briefing da Esteira) */}
                        {negocio.dor_principal && (
                          <div className="text-[11px] text-muted-foreground/90 line-clamp-2 bg-accent/40 rounded-xl px-2.5 py-1.5 border border-border/50 leading-relaxed font-normal">
                            <span className="font-semibold text-foreground/80 not-italic mr-1.5">Gargalo:</span>
                            <span>{negocio.dor_principal}</span>
                          </div>
                        )}

                        {/* Alerta de Estagnação (se aplicável) */}
                        {estagnado && !followupRelativo && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-medium">
                            <AlertTriangle className="size-3 shrink-0" />
                            <span>{diasSemContato}d sem contato registrado</span>
                          </div>
                        )}

                        {/* Rodapé: Responsável à esquerda, Ações e WhatsApp à direita */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs mt-auto">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Avatar
                              nome={negocio.responsavel?.nome || 'Não atribuído'}
                              size="xs"
                              className="size-5 text-[9px]"
                            />
                            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[90px]">
                              {negocio.responsavel?.nome ? negocio.responsavel.nome.split(' ')[0] : 'Sem resp.'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {negocio.url_site && (
                              <Tip label={`Abrir site: ${negocio.url_site}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = negocio.url_site?.startsWith('http')
                                      ? negocio.url_site
                                      : `https://${negocio.url_site}`;
                                    window.open(url, '_blank');
                                  }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                  <Globe className="size-3.5" />
                                </button>
                              </Tip>
                            )}

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
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors text-[11px] font-semibold border border-emerald-500/25"
                                >
                                  <MessageCircle className="size-3.5" />
                                  <span>WhatsApp</span>
                                </button>
                              </Tip>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  {cardsDaColuna.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground/60 min-h-[120px]">
                      <span className="text-xs">Nenhum card nesta etapa</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollShadow>
    </div>
  );
}
