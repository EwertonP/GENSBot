'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { formatarMoeda, calcularDiasSemContato, gerarLinkWhatsApp, calcularTierScore, formatarFollowupRelativo } from '@/lib/crm';
import type { CrmEstagio, CrmNegocio } from '@/types/crm';
import {
  MessageSquare,
  Download,
  Building,
  User,
  ArrowUpDown,
  ExternalLink,
  Zap,
  FileText,
  Target,
  MapPin,
  Clock,
} from 'lucide-react';

interface CrmTabelaProps {
  negocios: CrmNegocio[];
  estagios: CrmEstagio[];
  onAbrirNegocio: (negocio: CrmNegocio) => void;
}

export default function CrmTabela({ negocios, estagios, onAbrirNegocio }: CrmTabelaProps) {
  const [ordemCampo, setOrdemCampo] = useState<'valor' | 'criado_em' | 'ultimo_contato_em'>('criado_em');
  const [ordemDirecao, setOrdemDirecao] = useState<'asc' | 'desc'>('desc');

  const estagiosMap = useMemo(() => new Map(estagios.map((e) => [e.id, e])), [estagios]);

  const negociosOrdenados = useMemo(() => {
    return [...negocios].sort((a, b) => {
      let valA = a[ordemCampo] ? new Date(a[ordemCampo] as string).getTime() : 0;
      let valB = b[ordemCampo] ? new Date(b[ordemCampo] as string).getTime() : 0;
      if (ordemCampo === 'valor') {
        valA = Number(a.valor) || 0;
        valB = Number(b.valor) || 0;
      }
      return ordemDirecao === 'asc' ? valA - valB : valB - valA;
    });
  }, [negocios, ordemCampo, ordemDirecao]);

  const alternarOrdem = (campo: 'valor' | 'criado_em' | 'ultimo_contato_em') => {
    if (ordemCampo === campo) {
      setOrdemDirecao((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdemCampo(campo);
      setOrdemDirecao('desc');
    }
  };

  const exportarCsv = () => {
    const colunas = ['Título', 'Contato', 'WhatsApp', 'Email', 'Empresa', 'Valor (R$)', 'Status', 'Estágio', 'Origem', 'Responsável', 'Criado Em'];
    const linhas = negocios.map((n) => [
      `"${(n.titulo || '').replace(/"/g, '""')}"`,
      `"${(n.nome_contato || '').replace(/"/g, '""')}"`,
      `"${(n.telefone || '').replace(/"/g, '""')}"`,
      `"${(n.email || '').replace(/"/g, '""')}"`,
      `"${(n.empresa || '').replace(/"/g, '""')}"`,
      n.valor || 0,
      n.status,
      `"${(n.estagio?.nome || '').replace(/"/g, '""')}"`,
      n.origem,
      `"${(n.responsavel?.nome || '').replace(/"/g, '""')}"`,
      new Date(n.criado_em).toLocaleDateString('pt-BR'),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [colunas.join(','), ...linhas.map((l) => l.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crm_oportunidades_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-3 w-full min-w-0 max-w-full">
      {/* Botão de Exportação */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground font-sans tabular-nums">
          Exibindo {negocios.length} oportunidade(s)
        </span>
        <Button variant="outline" size="sm" onClick={exportarCsv} className="gap-1.5 h-8 text-xs font-sans tabular-nums">
          <Download className="w-3.5 h-3.5" />
          <span>Exportar CSV</span>
        </Button>
      </div>

      {/* Tabela de Negócios */}
      <Card className="overflow-hidden border border-border">
        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-accent/40 font-sans tabular-nums text-muted-foreground font-bold">
                <th className="py-2.5 px-3">Oportunidade / Lead</th>
                <th className="py-2.5 px-3">Qualificação ICP</th>
                <th className="py-2.5 px-3">Contato / Local</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => alternarOrdem('valor')}
                >
                  <div className="flex items-center gap-1">
                    <span>Valor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Estágio</th>
                <th className="py-2.5 px-3">Próximo Follow-up</th>
                <th className="py-2.5 px-3">Responsável</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {negociosOrdenados.map((negocio) => {
                const estagio = estagiosMap.get(negocio.estagio_id) || negocio.estagio;
                const diasSemContato = calcularDiasSemContato(negocio.ultimo_contato_em);
                const estagnado = estagio?.tipo_conclusao === 'aberto' && diasSemContato >= 3;

                return (
                  <tr
                    key={negocio.id}
                    onClick={() => onAbrirNegocio(negocio)}
                    className="hover:bg-accent/30 cursor-pointer transition-colors group"
                  >
                    {/* Título & Empresa */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-0.5 max-w-[200px]">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {negocio.titulo}
                        </span>
                        {negocio.empresa && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                            <Building className="w-3 h-3 shrink-0" />
                            <span className="truncate">{negocio.empresa}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Qualificação ICP */}
                    <td className="py-3 px-3">
                      {(() => {
                        const tier = calcularTierScore(negocio.score_qualificacao);
                        if (!tier) return <span className="text-muted-foreground/60 font-sans tabular-nums text-[11px]">—</span>;
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.badgeClass}`}>
                              <span>{tier.emoji}</span>
                              <span>Tier {tier.tier}</span>
                              <span className="opacity-80 font-sans tabular-nums">{negocio.score_qualificacao}</span>
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Contato & Local */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-0.5 max-w-[180px]">
                        <span className="text-foreground truncate font-medium">{negocio.nome_contato}</span>
                        {(negocio.cidade || negocio.nicho) && (
                          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
                            <span className="truncate">{negocio.cidade || '—'}{negocio.nicho ? ` • ${negocio.nicho}` : ''}</span>
                          </span>
                        )}
                        {negocio.telefone && (
                          <span className="text-[10px] font-sans tabular-nums text-muted-foreground truncate">
                            {negocio.telefone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="py-3 px-3 font-sans tabular-nums font-bold text-foreground shrink-0">
                      {formatarMoeda(negocio.valor)}
                    </td>

                    {/* Estágio */}
                    <td className="py-3 px-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{
                          backgroundColor: `${estagio?.cor || '#3b82f6'}15`,
                          borderColor: `${estagio?.cor || '#3b82f6'}30`,
                          color: estagio?.cor || '#3b82f6',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: estagio?.cor || '#3b82f6' }}
                        />
                        <span>{estagio?.nome || 'Etapa'}</span>
                      </span>
                    </td>

                    {/* Próximo Follow-up */}
                    <td className="py-3 px-3">
                      {(() => {
                        const fu = formatarFollowupRelativo(negocio.data_proximo_followup);
                        if (!fu) {
                          return (
                            <span
                              className={`font-sans tabular-nums text-[10px] ${
                                estagnado ? 'text-amber-500 font-bold' : 'text-muted-foreground/60'
                              }`}
                            >
                              {estagnado ? `${diasSemContato}d sem contato` : '—'}
                            </span>
                          );
                        }
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              fu.atrasado
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                : fu.hoje
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                                : 'bg-accent border-border text-muted-foreground'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>{fu.texto}</span>
                          </span>
                        );
                      })()}
                    </td>

                    {/* Responsável */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          nome={negocio.responsavel?.nome || 'Não atribuído'}
                          size="sm"
                          className="w-5 h-5 text-[9px]"
                        />
                        <span className="text-muted-foreground text-[11px] truncate max-w-[100px]">
                          {negocio.responsavel?.nome ? negocio.responsavel.nome.split(' ')[0] : 'Sem resp.'}
                        </span>
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-3 text-right">
                      {negocio.telefone && (
                        <Tip label="Abrir conversa no WhatsApp">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = gerarLinkWhatsApp(negocio.telefone!);
                              if (link) window.open(link, '_blank');
                            }}
                            className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </Tip>
                      )}
                    </td>
                  </tr>
                );
              })}

              {negociosOrdenados.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma oportunidade encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
