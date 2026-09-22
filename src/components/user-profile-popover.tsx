'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Briefcase,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ClienteAvatar } from '@/components/cliente-avatar';

interface UserProfilePopoverProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  avatarUrl?: string;
  onNavigate?: (tab: string) => void;
  onLogout?: () => void;
}

export default function UserProfilePopover({
  userName = 'Ewerton Monteiro',
  userEmail = 'contato@agenciagens.com',
  userRole = 'Diretor de Conteúdo',
  avatarUrl,
  onNavigate,
  onLogout,
}: UserProfilePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão do Avatar com Anel Gradiente Lime GENS */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 p-1 rounded-full hover:bg-accent/60 transition-all focus:outline-hidden"
        aria-label="Menu do usuário"
      >
        <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#d8ff3c] via-emerald-400 to-[#192313] shadow-xs">
          <ClienteAvatar
            nome={userName}
            fotoUrl={avatarUrl}
            cor="#192313"
            tamanho="md"
            className="ring-2 ring-white"
          />
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-bold text-foreground leading-tight">{userName}</span>
          <span className="text-[10px] text-muted-foreground font-medium">{userRole}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Suspenso (Estilo Referência 1 com Paleta Verde GENS) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-64 rounded-2xl bg-card border border-border/80 shadow-2xl p-2 z-50 overflow-hidden text-foreground"
          >
            {/* Header do Perfil no Popover */}
            <div className="px-3 py-2.5 bg-[#edf4d8]/60 rounded-xl border border-[#d8ff3c]/40 mb-1.5 flex items-center justify-between">
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-[#192313] truncate">{userName}</span>
                <span className="text-[10px] text-[#59614f] truncate">{userEmail}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d8ff3c] text-[#192313] shadow-2xs shrink-0">
                <Zap className="w-2.5 h-2.5 fill-[#192313]" />
                PRO
              </span>
            </div>

            {/* Grupo 1: Preferências e Conta do Usuário */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  alert('Configurações de Conta do Usuário');
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>Minha Conta / Preferências</span>
                </div>
              </button>
            </div>

            <div className="my-1.5 border-t border-border/60" />

            {/* Grupo 2: Suporte & Sair */}
            <div className="flex flex-col gap-0.5">
              <a
                href="https://wa.me/5583999999999"
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span>Central de Suporte GENS</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
