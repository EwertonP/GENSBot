'use client';

import React from 'react';
import { FileText, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LogsTabProps {
  recentEvents: any[];
  recentQueue: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

/** Aba "Logs de Eventos" — extraída de src/app/page.tsx (primeiro passo da
 * quebra do monólito em componentes por aba, ver DESIGN.md §6). Corta-e-cola
 * literal, sem mudança de comportamento: webhooks brutos da Meta + fila de
 * disparos detalhada com export CSV. */
export default function LogsTab({ recentEvents, recentQueue, showToast }: LogsTabProps) {
  // Gera e baixa um CSV a partir de uma lista de objetos, direto no navegador
  const exportToCsv = (filename: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) {
      showToast('Nada para exportar ainda.', 'error');
      return;
    }
    const headers = Object.keys(rows[0]);
    const escapeCell = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
    ].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Eventos Recentes */}
      <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-4 text-foreground">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Webhooks da Meta (Payload Bruto)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Logs em tempo real dos pacotes de eventos entregues pela Meta.</p>
        </div>

        <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
          {recentEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">Nenhum evento captado até o momento.</p>
          ) : (
            recentEvents.map(evt => (
              <div key={evt.id} className="bg-accent border border-border p-4 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">
                    ID: {evt.id.substring(0, 8)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(evt.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <pre className="text-[10px] text-foreground font-mono bg-card p-2.5 rounded-lg border border-border overflow-x-auto max-h-[120px]">
                  {JSON.stringify(evt.payload, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Fila de Disparos Completa */}
      <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-4 text-foreground">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Fila de Disparos de DMs
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Histórico e status do pipeline de entrega de mensagens.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportToCsv('fila_de_disparos.csv', recentQueue.map(item => ({
              contato: item.contact_id,
              tipo: item.type,
              status: item.status,
              erro: item.error_message || '',
              criado_em: item.created_at,
              enviado_em: item.sent_at || '',
            })))}
            className="rounded-xl flex-shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            CSV
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
          {recentQueue.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">Nenhuma mensagem enfileirada no banco.</p>
          ) : (
            recentQueue.map(item => (
              <div key={item.id} className="bg-accent border border-border p-4 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">
                    Destino ID: {item.contact_id.substring(0, 10)}...
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-semibold text-foreground">
                    {item.type === 'private_reply' && 'Resposta Privada'}
                    {item.type === 'link_dm' && 'DM de Link'}
                    {item.type === 'reminder_dm' && 'DM de Lembrete'}
                  </span>
                  <Badge
                    variant={item.status === 'sent' ? 'success' : item.status === 'pending' ? 'muted' : 'destructive'}
                    className="text-[9px]"
                  >
                    {item.status === 'sent' && 'Enviado'}
                    {item.status === 'pending' && 'Pendente'}
                    {item.status === 'failed' && 'Falhou'}
                  </Badge>
                </div>
                {item.error_message && (
                  <div className="text-[10px] text-destructive bg-card p-2 rounded-lg border border-destructive/25 font-mono mt-1">
                    Erro: {item.error_message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
