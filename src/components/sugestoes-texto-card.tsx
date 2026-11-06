'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, MessageSquareQuote, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROTULO_CAMPO, type CampoSugestao } from '@/lib/sugestoes-texto';

interface Sugestao {
  id: string;
  campo: CampoSugestao;
  texto_original: string | null;
  texto_proposto: string;
  autor: string | null;
  criado_em: string;
}

interface Props {
  itemId: string;
  /** Texto já gravado na demanda: o sheet atualiza o formulário com ele. */
  onAceita: (campo: CampoSugestao, texto: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

/** Sugestões de texto que a cliente enviou pelo link do mês: aceitar grava na demanda. */
export function SugestoesTextoCard({ itemId, onAceita, showToast }: Props) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/conteudo/${itemId}/sugestoes`);
      if (!res.ok) return;
      const json = await res.json();
      setSugestoes(json.sugestoes || []);
    } catch {
      /* sem sugestões: o cartão simplesmente não aparece */
    }
  }, [itemId]);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/conteudo/${itemId}/sugestoes`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (ativo && json) setSugestoes(json.sugestoes || []);
      })
      .catch(() => {
        /* sem sugestões: o cartão simplesmente não aparece */
      });
    return () => {
      ativo = false;
    };
  }, [itemId]);

  async function resolver(s: Sugestao, acao: 'aceitar' | 'recusar') {
    setResolvendo(s.id);
    try {
      const res = await fetch(`/api/sugestoes-texto/${s.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível resolver.');
      setSugestoes((lista) => lista.filter((x) => x.id !== s.id));
      if (acao === 'aceitar') {
        onAceita(s.campo, typeof json.texto_final === 'string' ? json.texto_final : s.texto_proposto);
        showToast('Texto da cliente aplicado na demanda.', 'success');
      } else {
        showToast('Sugestão recusada.', 'success');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível resolver.', 'error');
      carregar();
    } finally {
      setResolvendo(null);
    }
  }

  if (sugestoes.length === 0) return null;

  return (
    <section aria-label="Sugestões da cliente" className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <MessageSquareQuote className="size-4 text-warning" aria-hidden />
        A cliente sugeriu mudanças no texto ({sugestoes.length})
      </h3>
      {sugestoes.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {ROTULO_CAMPO[s.campo]}
              {s.autor ? ` · ${s.autor}` : ''}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="min-w-0 rounded-lg bg-muted/50 p-2.5">
              <p className="mb-1 text-[11px] font-bold uppercase text-muted-foreground">Atual</p>
              <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{s.texto_original?.trim() || 'Em branco'}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-success/10 p-2.5">
              <p className="mb-1 text-[11px] font-bold uppercase text-success">Sugerido</p>
              <p className="whitespace-pre-line break-words text-sm">{s.texto_proposto}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => resolver(s, 'recusar')} disabled={resolvendo === s.id}>
              <X className="size-3.5" aria-hidden /> Recusar
            </Button>
            <Button size="sm" onClick={() => resolver(s, 'aceitar')} loading={resolvendo === s.id}>
              <Check className="size-3.5" aria-hidden /> Aceitar
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
