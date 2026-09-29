'use client';
import { Avatar } from './avatar';

import React, { useState, useRef, useEffect } from 'react';
import { User, UserX, Check, ChevronDown } from 'lucide-react';

export interface MembroOption {
  id: string;
  nome: string;
  cargo?: string | null;
  papel?: string | null;
  foto_url?: string | null;
}

export interface MemberChipSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  membros: MembroOption[];
  placeholder?: string;
  className?: string;
}

export function MemberChipSelect({
  label,
  value,
  onChange,
  membros,
  placeholder = 'Nenhum...',
  className = '',
}: MemberChipSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o popover ao clicar fora ou ao pressionar ESC
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const membroSelecionado = membros.find((m) => m.id === value);

  return (
    <div className={`relative flex flex-col gap-0.5 ${className}`} ref={containerRef}>
      {label && (
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      )}

      {/* Trigger: Chip / Tag Minimalista */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-8 w-full px-2.5 rounded-xl border text-xs transition-ui flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs group text-left ${
          membroSelecionado
            ? 'bg-accent/40 border-border hover:bg-accent/70 hover:border-foreground/30 text-foreground font-semibold'
            : 'bg-background/80 border-border hover:bg-accent/40 hover:border-foreground/30 text-muted-foreground'
        } ${open ? 'ring-2 ring-primary/20 border-primary/50' : ''}`}
        title={membroSelecionado ? `Responsável: ${membroSelecionado.nome}` : placeholder}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {membroSelecionado ? (
            <>
              {/* Mini Avatar com Iniciais */}
              <Avatar nome={membroSelecionado.nome} src={membroSelecionado.foto_url} size="xs" />
              <span className="truncate text-xs font-semibold text-foreground">
                {membroSelecionado.nome}
              </span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-xs text-muted-foreground font-medium">
                {placeholder}
              </span>
            </>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-foreground' : ''
          }`}
        />
      </button>

      {/* Popover Ultra-Enxuto com Membros */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[210px] rounded-xl border border-border bg-card/98 backdrop-blur-md shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
          {/* Opção: Desatribuir / Nenhum */}
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className={`w-full p-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer text-left ${
              !value
                ? 'bg-accent/80 font-bold text-foreground'
                : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-xs">Nenhum...</span>
            </div>
            {!value && <Check className="w-3.5 h-3.5 text-primary shrink-0 font-bold" />}
          </button>

          <div className="h-px bg-border/50 my-0.5" />

          {/* Lista de Membros da Equipe */}
          <div className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
            {membros.map((m) => {
              const isSelected = m.id === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`w-full p-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-accent/80 font-bold text-foreground'
                      : 'hover:bg-accent/40 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Avatar nome={m.nome} src={m.foto_url} size="xs" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate text-xs font-semibold leading-tight">{m.nome}</span>
                      {m.cargo && (
                        <span className="truncate text-xs text-muted-foreground font-mono leading-tight">
                          {m.cargo}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 font-bold ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
