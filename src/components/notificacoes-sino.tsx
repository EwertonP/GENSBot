'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Settings2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import { NotificacoesPush } from '@/components/notificacoes-push';

interface Item {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  url: string | null;
  lida_em: string | null;
  criado_em: string;
}
interface Preferencia {
  tipo: string;
  rotulo: string;
  descricao: string;
  push: boolean;
}

function haQuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Sino com contador e central de notificações. `onAbrir` recebe o caminho guardado na notificação. */
export function NotificacoesSino({ onAbrir, className = '' }: { onAbrir: (url: string) => void; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [mostrarPrefs, setMostrarPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Preferencia[]>([]);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/notificacoes?limite=40', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setItens(j.itens || []);
      setNaoLidas(j.naoLidas || 0);
    } catch {
      /* sem rede: mantém o que já tinha */
    }
  }, []);

  // Contador sempre atualizado: ao montar, a cada minuto e quando a aba volta ao foco.
  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 60_000);
    const aoVoltar = () => document.visibilityState === 'visible' && void carregar();
    document.addEventListener('visibilitychange', aoVoltar);
    // O service worker avisa quando chega um push: atualiza o sino na hora.
    const aoReceberPush = (e: MessageEvent) => {
      if (e.data?.tipo === 'notificacao') void carregar();
    };
    navigator.serviceWorker?.addEventListener('message', aoReceberPush);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
      navigator.serviceWorker?.removeEventListener('message', aoReceberPush);
    };
  }, [carregar]);

  // Número no ícone do app instalado (Android e computador), igual ao do sino.
  useEffect(() => {
    try {
      const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (naoLidas > 0) void nav.setAppBadge?.(naoLidas);
      else void nav.clearAppBadge?.();
    } catch {
      /* badge é só um extra */
    }
  }, [naoLidas]);

  const abrirCentral = async () => {
    setAberto(true);
    setCarregando(true);
    await carregar();
    setCarregando(false);
  };

  const marcarTodas = async () => {
    setItens((l) => l.map((i) => ({ ...i, lida_em: i.lida_em || new Date().toISOString() })));
    setNaoLidas(0);
    await fetch('/api/notificacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'todas' }) });
  };

  const abrirItem = async (item: Item) => {
    if (!item.lida_em) {
      setItens((l) => l.map((i) => (i.id === item.id ? { ...i, lida_em: new Date().toISOString() } : i)));
      setNaoLidas((n) => Math.max(n - 1, 0));
      void fetch('/api/notificacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'lidas', ids: [item.id] }) });
    }
    setAberto(false);
    if (item.url) onAbrir(item.url);
  };

  const alternarPrefs = async () => {
    const novo = !mostrarPrefs;
    setMostrarPrefs(novo);
    if (novo && prefs.length === 0) {
      const res = await fetch('/api/notificacoes/preferencias', { cache: 'no-store' }).catch(() => null);
      if (res?.ok) setPrefs((await res.json()).itens || []);
    }
  };

  const mudarPref = async (tipo: string, push: boolean) => {
    setPrefs((l) => l.map((p) => (p.tipo === tipo ? { ...p, push } : p)));
    const res = await fetch('/api/notificacoes/preferencias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, push }) }).catch(() => null);
    if (!res?.ok) {
      setPrefs((l) => l.map((p) => (p.tipo === tipo ? { ...p, push: !push } : p)));
      toast.error('Não foi possível salvar a preferência.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={abrirCentral}
        aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Notificações'}
        className={`relative inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer ${className}`}
      >
        <Bell className="size-4" />
        {naoLidas > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-xs font-bold leading-none text-destructive-foreground">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      <Sheet open={aberto} onClose={() => setAberto(false)} aria-label="Notificações" className="w-full max-w-md">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="font-display text-base font-semibold text-foreground">Notificações</h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={marcarTodas} disabled={naoLidas === 0} className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 cursor-pointer">
              <CheckCheck className="size-4" /> Marcar todas
            </button>
            <button type="button" onClick={alternarPrefs} aria-label="Preferências" aria-pressed={mostrarPrefs} className={`inline-flex size-10 sm:size-9 items-center justify-center rounded-xl hover:bg-accent cursor-pointer ${mostrarPrefs ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}>
              <Settings2 className="size-4" />
            </button>
          </div>
        </div>

        {mostrarPrefs ? (
          <div className="flex flex-col gap-1 overflow-y-auto p-3">
            <p className="px-2 pb-1 text-xs text-muted-foreground">O aviso aqui no sino sempre aparece. Escolha quais também chegam como notificação no aparelho.</p>
            {prefs.map((p) => (
              <div key={p.tipo} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.rotulo}</p>
                  <p className="text-xs text-muted-foreground">{p.descricao}</p>
                </div>
                <Switch checked={p.push} onCheckedChange={(v) => mudarPref(p.tipo, v)} aria-label={`Receber push: ${p.rotulo}`} />
              </div>
            ))}
            <div className="mt-2 border-t border-border pt-2">
              <NotificacoesPush />
            </div>
          </div>
        ) : (
          <ul className="flex flex-col overflow-y-auto p-2">
            {itens.length === 0 && !carregando && (
              <li>
                <EmptyState size="compact" icon={Bell} title="Nada por aqui" description="Quando algo importante acontecer, avisamos aqui." />
              </li>
            )}
            {itens.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => abrirItem(i)} className="flex w-full min-h-14 items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-accent cursor-pointer">
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${i.lida_em ? 'bg-transparent' : 'bg-primary'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${i.lida_em ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>{i.titulo}</span>
                    {i.corpo && <span className="block truncate text-xs text-muted-foreground">{i.corpo}</span>}
                    <span className="block text-xs text-muted-foreground/80">{haQuanto(i.criado_em)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
