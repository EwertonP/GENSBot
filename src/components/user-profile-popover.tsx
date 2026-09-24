'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Users2,
  HelpCircle,
  LogOut,
  ChevronDown,
  Zap,
  UploadCloud,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upload } from '@vercel/blob/client';

interface UserProfilePopoverProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  avatarUrl?: string;
  onNavigate?: (tab: string) => void;
  onLogout?: () => void;
  direction?: 'up' | 'down';
  onUpdateProfile?: (name: string, avatarUrl: string) => void;
}

export default function UserProfilePopover({
  userName = 'Ewerton Monteiro',
  userEmail = 'contato@agenciagens.com',
  userRole = 'Diretor de Conteúdo',
  avatarUrl,
  onNavigate,
  onLogout,
  direction = 'up',
  onUpdateProfile,
}: UserProfilePopoverProps) {
  const [open, setOpen] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editAvatarUrl, setEditAvatarUrl] = useState(avatarUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sincroniza props quando abertos
  useEffect(() => {
    setEditName(userName);
    setEditAvatarUrl(avatarUrl || '');
  }, [userName, avatarUrl]);

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/instagram/upload-media',
      });
      setEditAvatarUrl(blob.url);
    } catch {
      const localUrl = URL.createObjectURL(file);
      setEditAvatarUrl(localUrl);
    } finally {
      setUploading(false);
    }
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (onUpdateProfile) {
      onUpdateProfile(editName.trim(), editAvatarUrl.trim());
    }
    setSaving(false);
    setModalEditOpen(false);
    setOpen(false);
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger principal (Footer do Perfil na Sidebar ou Header) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl bg-accent/40 hover:bg-accent border border-border/60 hover:border-foreground/20 transition-all cursor-pointer text-left shadow-2xs group"
        aria-label="Menu do usuário master"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#d8ff3c] via-emerald-400 to-[#192313] shadow-xs shrink-0">
            <ClienteAvatar
              nome={userName}
              fotoUrl={avatarUrl}
              cor="#192313"
              tamanho="sm"
              className="ring-2 ring-white"
            />
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-xs font-bold text-foreground truncate">{userName}</span>
            <span className="text-[10px] text-muted-foreground truncate">{userEmail}</span>
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Suspenso (Abre para cima por padrão quando no rodapé da sidebar) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: direction === 'up' ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: direction === 'up' ? -8 : 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute left-0 w-64 rounded-2xl bg-card border border-border/80 shadow-2xl p-2 z-50 overflow-hidden text-foreground ${
              direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {/* Header do Perfil no Popover */}
            <div className="px-3 py-2.5 bg-primary/10 rounded-xl border border-primary/30 mb-1.5 flex items-center justify-between">
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-foreground truncate">{userName}</span>
                <span className="text-[10px] text-muted-foreground truncate">{userRole}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-2xs shrink-0">
                <Zap className="w-2.5 h-2.5 fill-current" />
                MASTER
              </span>
            </div>

            {/* Opções de Navegação */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setModalEditOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-primary" />
                <span>Minha Conta & Foto de Perfil</span>
              </button>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onNavigate('equipe');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <Users2 className="w-4 h-4 text-muted-foreground" />
                  <span>Equipe & Sócios</span>
                </button>
              )}
            </div>

            <div className="my-1.5 border-t border-border/60" />

            {/* Suporte & Logout */}
            <div className="flex flex-col gap-0.5">
              <a
                href="https://wa.me/5583999999999"
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
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
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Edição de Perfil e Foto */}
      <Sheet
        open={modalEditOpen}
        onClose={() => setModalEditOpen(false)}
        aria-label="Editar Perfil"
      >
        <form onSubmit={handleSaveProfile} className="p-6 flex flex-col gap-5">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Perfil da Conta Master
            </span>
            <h3 className="text-lg font-bold font-display text-foreground mt-0.5">
              Editar Nome e Foto de Perfil
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Personalize sua foto de avatar que aparece no sistema e nas aprovações.
            </p>
          </div>

          {/* Preview da Foto de Perfil */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-accent/30 border border-border/60">
            <div className="relative group cursor-pointer">
              <ClienteAvatar
                nome={editName}
                fotoUrl={editAvatarUrl}
                cor="#192313"
                tamanho="lg"
                className="w-16 h-16 rounded-full ring-2 ring-primary"
              />
              <label
                htmlFor="user-avatar-upload"
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                title="Alterar foto de perfil"
              >
                <Camera className="w-5 h-5" />
              </label>
              <input
                id="user-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label htmlFor="user-avatar-upload" className="text-xs font-bold text-primary cursor-pointer hover:underline flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4" />
                {uploading ? 'Carregando foto...' : 'Fazer Upload de Nova Foto'}
              </label>
              <span className="text-[11px] text-muted-foreground">PNG, JPG ou WEBP até 5MB</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">URL Direta da Foto (Opcional)</label>
            <Input
              type="url"
              placeholder="https://exemplo.com/minha-foto.jpg"
              value={editAvatarUrl}
              onChange={(e) => setEditAvatarUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Seu Nome Completo</label>
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={() => setModalEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Salvar Perfil
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
