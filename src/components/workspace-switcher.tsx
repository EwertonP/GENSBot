'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus, Search, Users, Sparkles } from 'lucide-react';
import { Instagram as InstagramIcon } from '@/components/instagram-icon';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Tip } from '@/components/ui/tooltip';
import type { WorkspaceContexto } from '@/types/workspace';
import type { Cliente } from '@/lib/clientes';

interface InstagramAccountSummary {
  id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  profile_picture_url: string | null;
  token_expires_at: string | null;
}

interface WorkspaceSwitcherProps {
  workspaceAtivo: WorkspaceContexto;
  clientes: Cliente[];
  accounts: InstagramAccountSummary[];
  onSelectWorkspace: (ws: WorkspaceContexto) => void;
  onNovoCliente?: () => void;
  compacto?: boolean;
}

export default function WorkspaceSwitcher({
  workspaceAtivo,
  clientes,
  accounts,
  onSelectWorkspace,
  onNovoCliente,
  compacto = false,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora ou apertar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
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

  // Mapa de contas de instagram por ID
  const accountsMap = useMemo(() => {
    const map = new Map<string, InstagramAccountSummary>();
    for (const acc of accounts) {
      map.set(acc.id, acc);
      map.set(acc.instagram_user_id, acc);
    }
    return map;
  }, [accounts]);

  // Filtra clientes por nome ou @ do instagram
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) => {
      const nomeMatch = c.nome.toLowerCase().includes(termo);
      const nichoMatch = c.nicho?.toLowerCase().includes(termo);
      const igConta = c.instagram_account_id ? accountsMap.get(c.instagram_account_id) : null;
      const userMatch = igConta?.instagram_username?.toLowerCase().includes(termo);
      return nomeMatch || nichoMatch || userMatch;
    });
  }, [clientes, busca, accountsMap]);

  const handleSelectAgencia = () => {
    onSelectWorkspace({
      tipo: 'agencia',
      clienteId: null,
      nome: 'Agência GENS',
      instagramAccountId: null,
      instagramUserId: 'all',
      instagramUsername: null,
    });
    setOpen(false);
  };

  const handleSelectCliente = (cliente: Cliente) => {
    const igConta = cliente.instagram_account_id ? accountsMap.get(cliente.instagram_account_id) : null;
    onSelectWorkspace({
      tipo: 'cliente',
      clienteId: cliente.id,
      nome: cliente.nome,
      nicho: cliente.nicho,
      cor: cliente.cor,
      fotoUrl: cliente.foto_url || igConta?.profile_picture_url,
      instagramAccountId: cliente.instagram_account_id || null,
      instagramUserId: igConta?.instagram_user_id || null,
      instagramUsername: igConta?.instagram_username || null,
    });
    setOpen(false);
  };

  const labelAtivo = workspaceAtivo.tipo === 'agencia' ? 'Agência GENS (Central)' : workspaceAtivo.nome;
  const sublabelAtivo =
    workspaceAtivo.tipo === 'agencia'
      ? `Visão Central (${clientes.length} clientes)`
      : workspaceAtivo.instagramUsername
      ? `@${workspaceAtivo.instagramUsername}`
      : workspaceAtivo.nicho || 'Cliente sem Instagram';

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <Tip label={compacto ? `${labelAtivo} · ${sublabelAtivo}` : 'Alternar cliente / workspace ativo'}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`w-full flex items-center ${
            compacto ? 'justify-center p-2' : 'gap-2.5 p-2'
          } rounded-xl bg-accent/60 hover:bg-accent border border-border hover:border-foreground/20 transition-all cursor-pointer text-left shadow-2xs group`}
        >
          {workspaceAtivo.tipo === 'agencia' ? (
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 border border-primary/30 text-primary">
              <Building2 className="w-4 h-4" />
            </div>
          ) : (
            <ClienteAvatar
              nome={workspaceAtivo.nome}
              cor={workspaceAtivo.cor}
              fotoUrl={workspaceAtivo.fotoUrl}
              tamanho="md"
              className="w-8 h-8 rounded-lg flex-shrink-0"
            />
          )}

          {!compacto && (
            <>
              <div className="flex-1 min-w-0 leading-tight">
                <p className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                  <span className="truncate">{labelAtivo}</span>
                  {workspaceAtivo.tipo === 'agencia' && (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-primary/10 text-primary font-semibold">
                      Agência
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  {workspaceAtivo.instagramUsername && (
                    <InstagramIcon className="w-2.5 h-2.5 text-pink-500 shrink-0 inline" />
                  )}
                  <span className="truncate">{sublabelAtivo}</span>
                </p>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </>
          )}
        </button>
      </Tip>

      {/* Dropdown Menu */}
      {open && (
        <div
          className={`absolute ${
            compacto ? 'left-full top-0 ml-2 w-72' : 'left-0 top-full mt-1.5 w-full min-w-[280px]'
          } bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col`}
        >
          {/* Campo de Busca Rápida */}
          <div className="p-2 border-b border-border/80 bg-muted/20">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente ou @..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1 divide-y divide-border/40">
            {/* Opção 1: Agência GENS */}
            <div className="py-1">
              <button
                type="button"
                onClick={handleSelectAgencia}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors cursor-pointer ${
                  workspaceAtivo.tipo === 'agencia' ? 'bg-accent font-semibold' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 border border-primary/30 text-primary">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-semibold truncate flex items-center gap-1.5">
                    🏢 Agência GENS
                    <span className="text-[10px] text-muted-foreground font-normal">(Visão Central)</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Prospecção de novos clientes &amp; Visão ampla
                  </p>
                </div>
                {workspaceAtivo.tipo === 'agencia' && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            </div>

            {/* Opção 2: Lista de Clientes */}
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center justify-between">
                <span>Carteira de Clientes ({clientesFiltrados.length})</span>
                {clientesFiltrados.length !== clientes.length && (
                  <span className="text-primary lowercase text-[10px]">filtrado</span>
                )}
              </div>

              {clientesFiltrados.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum cliente encontrado para &quot;{busca}&quot;
                </div>
              ) : (
                clientesFiltrados.map((cliente) => {
                  const igConta = cliente.instagram_account_id ? accountsMap.get(cliente.instagram_account_id) : null;
                  const isSelecionado =
                    workspaceAtivo.tipo === 'cliente' && workspaceAtivo.clienteId === cliente.id;

                  return (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => handleSelectCliente(cliente)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors cursor-pointer ${
                        isSelecionado ? 'bg-accent/80 font-semibold' : ''
                      }`}
                    >
                      <ClienteAvatar
                        nome={cliente.nome}
                        cor={cliente.cor}
                        fotoUrl={cliente.foto_url || igConta?.profile_picture_url}
                        tamanho="sm"
                        className="w-7 h-7 rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate font-medium">
                          {cliente.nome}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          {igConta?.instagram_username ? (
                            <>
                              <InstagramIcon className="w-2.5 h-2.5 text-pink-500 shrink-0 inline" />
                              <span>@{igConta.instagram_username}</span>
                            </>
                          ) : (
                            <span className="text-amber-500/90 dark:text-amber-400">
                              {cliente.nicho || 'Sem Instagram conectado'}
                            </span>
                          )}
                        </p>
                      </div>
                      {isSelecionado && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Rodapé: Ação de Cadastrar Cliente */}
          {onNovoCliente && (
            <div className="p-1.5 border-t border-border/80 bg-muted/10">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNovoCliente();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Gerenciar / Novo Cliente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
