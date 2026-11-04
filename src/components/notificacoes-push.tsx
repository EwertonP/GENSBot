'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { ativarPush, desativarPush, enviarTestePush, estadoPush, type EstadoPush } from '@/lib/push-client';

/**
 * Item de menu para ligar/desligar as notificações neste aparelho.
 * Some quando o navegador não suporta ou o servidor não tem as chaves.
 */
export function NotificacoesPush({ onDone }: { onDone?: () => void }) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    estadoPush().then((e) => vivo && setEstado(e)).catch(() => vivo && setEstado('indisponivel'));
    return () => {
      vivo = false;
    };
  }, []);

  if (estado === null || estado === 'indisponivel') return null;

  const classe = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-60';

  if (estado === 'precisa-instalar') {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Para receber notificações no iPhone, instale o app: toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
      </p>
    );
  }
  if (estado === 'bloqueado') {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador ou do app instalado.
      </p>
    );
  }

  const alternar = async () => {
    setOcupado(true);
    try {
      if (estado === 'ativo') {
        setEstado(await desativarPush());
        toast.info('Notificações desligadas neste aparelho.');
      } else {
        const novo = await ativarPush();
        setEstado(novo);
        if (novo === 'ativo') {
          toast.success('Notificações ligadas neste aparelho.');
          void enviarTestePush().catch(() => {});
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar as notificações.');
    } finally {
      setOcupado(false);
      onDone?.();
    }
  };

  return (
    <button type="button" onClick={alternar} disabled={ocupado} className={classe}>
      {estado === 'ativo' ? <BellOff className="w-4 h-4 text-muted-foreground" /> : <Bell className="w-4 h-4 text-primary" />}
      <span>{estado === 'ativo' ? 'Desligar notificações neste aparelho' : 'Ligar notificações neste aparelho'}</span>
    </button>
  );
}
