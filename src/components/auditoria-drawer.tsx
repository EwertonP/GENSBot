'use client';

import React, { useEffect, useState } from 'react';
import {
  History,
  X,
  Search,
  Filter,
  Layers,
  FileSignature,
  Briefcase,
  Wallet,
  Share2,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Target,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { EventoAuditoria } from '@/lib/auditoria';

interface AuditoriaDrawerProps {
  aberto: boolean;
  onFechar: () => void;
}

const ICONES_MODULO: Record<string, React.ComponentType<{ className?: string }>> = {
  demandas: Layers,
  propostas: FileSignature,
  contratos: FileSignature,
  clientes: Briefcase,
  financeiro: Wallet,
  redes: Share2,
  crm: Target,
  equipe: Users,
};

export function AuditoriaDrawer({ aberto, onFechar }: AuditoriaDrawerProps) {
  const [carregando, setCarregando] = useState(false);
  const [grupos, setGrupos] = useState<{ data: string; titulo: string; itens: EventoAuditoria[] }[]>([]);
  const [moduloFiltro, setModuloFiltro] = useState('all');
  const [busca, setBusca] = useState('');

  async function carregar() {
    try {
      setCarregando(true);
      const params = new URLSearchParams();
      if (moduloFiltro !== 'all') params.set('modulo', moduloFiltro);
      if (busca.trim()) params.set('busca', busca.trim());

      const res = await fetch(`/api/auditoria?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.grupos) {
        setGrupos(data.grupos);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (aberto) {
      carregar();
    }
  }, [aberto, moduloFiltro]);

  return (
    <Sheet open={aberto} onClose={onFechar} aria-label="Histórico de Auditoria" className="w-full max-w-xl">
      <div className="flex flex-col h-full bg-card text-foreground">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <History className="size-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Auditoria & Histórico de Atividades
              </h2>
              <p className="text-xs text-muted-foreground">
                Trilha de eventos por dia, módulo e colaborador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={carregar}
              disabled={carregando}
              className="size-8 p-0"
              title="Atualizar eventos"
            >
              <RefreshCw className={`size-3.5 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onFechar}
              className="size-8 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar histórico..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregar()}
              className="h-9 pl-8.5 text-xs rounded-xl"
            />
          </div>

          <Select
            value={moduloFiltro}
            onChange={(e) => setModuloFiltro(e.target.value)}
            className="h-9 text-xs w-36 rounded-xl"
          >
            <option value="all">Todos os módulos</option>
            <option value="demandas">Demandas</option>
            <option value="propostas">Propostas</option>
            <option value="contratos">Contratos</option>
            <option value="clientes">Clientes</option>
            <option value="financeiro">Financeiro</option>
            <option value="redes">Conexões</option>
            <option value="crm">CRM</option>
          </Select>
        </div>

        {/* Lista de Atividades */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {carregando ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <p className="text-xs">Carregando trilha de auditoria...</p>
            </div>
          ) : grupos.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-muted/20 border border-dashed text-xs text-muted-foreground">
              Nenhuma atividade registrada no período selecionado.
            </div>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.data} className="space-y-3">
                <div className="sticky top-0 bg-card/90 backdrop-blur-xs py-1 z-10">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    {grupo.titulo}
                  </span>
                </div>

                <div className="space-y-2 border-l-2 border-border/60 pl-3 sm:pl-4 ml-2">
                  {grupo.itens.map((ev, idx) => {
                    const Icone = ICONES_MODULO[ev.modulo] || History;
                    const hora = ev.criado_em
                      ? new Date(ev.criado_em).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--';

                    return (
                      <div
                        key={ev.id || idx}
                        className="p-3 rounded-2xl border border-border/80 bg-background/50 hover:bg-background transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-accent text-foreground">
                              <Icone className="size-3.5" />
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                              {ev.modulo}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">{hora}</span>
                        </div>

                        <p className="text-xs font-semibold text-foreground leading-snug">
                          {ev.descricao}
                        </p>

                        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1.5">
                            {ev.membro ? (
                              <span>Por <strong>{ev.membro.nome}</strong></span>
                            ) : (
                              <span>Ação do sistema</span>
                            )}
                          </div>

                          {ev.cliente && (
                            <span className="px-1.5 py-0.5 rounded-md bg-muted text-foreground font-medium">
                              {ev.cliente.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Sheet>
  );
}
