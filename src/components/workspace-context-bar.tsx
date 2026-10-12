'use client';

import { Building2, Sparkles, ArrowRight, UserCheck } from 'lucide-react';
import { Instagram } from '@/components/instagram-icon';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Badge } from '@/components/ui/badge';
import type { WorkspaceContexto } from '@/types/workspace';

interface WorkspaceContextBarProps {
  workspace: WorkspaceContexto;
  onTrocarWorkspace?: () => void;
  abaAtual?: string;
}

export default function WorkspaceContextBar({
  workspace,
  onTrocarWorkspace,
  abaAtual,
}: WorkspaceContextBarProps) {
  const isAgencia = workspace.tipo === 'agencia';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-card/60 border border-border/80 shadow-2xs backdrop-blur-xs mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {isAgencia ? (
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0 border border-primary/30">
            <Building2 className="w-3.5 h-3.5" />
          </div>
        ) : (
          <ClienteAvatar
            nome={workspace.nome}
            cor={workspace.cor}
            fotoUrl={workspace.fotoUrl}
            tamanho="sm"
            className="w-6 h-6 rounded-md shrink-0"
          />
        )}

        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-xs text-muted-foreground">Contexto ativo:</span>
          <span className="text-xs font-bold text-foreground truncate">{workspace.nome}</span>

          {isAgencia ? (
            <Badge variant="brand" className="text-[10px] py-0 px-1.5 h-5">
              🏢 Visão Agência
            </Badge>
          ) : (
            <>
              {workspace.instagramUsername ? (
                <Badge variant="muted" className="text-[10px] py-0 px-1.5 h-5 flex items-center gap-1 font-mono text-pink-600 dark:text-pink-400 border-pink-500/20 bg-pink-500/5">
                  <Instagram className="w-2.5 h-2.5 inline" />
                  @{workspace.instagramUsername}
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-5">
                  Sem Instagram
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground hidden md:inline">
          {isAgencia
            ? 'Dados e prospecção da própria agência'
            : `Operando nos dados de ${workspace.nome}`}
        </span>
        {onTrocarWorkspace && (
          <button
            type="button"
            onClick={onTrocarWorkspace}
            className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Trocar cliente
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
