'use client';

import { useState } from 'react';
import { FlaskConical, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Turno = { de: 'paciente' | 'ia'; texto: string };

type Proposta =
  | { tipo: 'responder'; texto: string; agendaVista?: string }
  | { tipo: 'transferir'; texto: string; motivo: string; agendaVista?: string }
  | { tipo: 'urgencia'; texto: string; motivo: string }
  | { tipo: 'vazia'; agendaVista?: string }
  | { tipo: 'sem_chave_ia' };

interface Resposta {
  proposta: Proposta;
  ritmo: { minSegundos: number; maxSegundos: number; dentroDoHorario: boolean };
}

/**
 * Conversa de teste: o que a IA responderia, sem enviar nada a ninguém, sem fila e sem avisar a equipe.
 * Gasta a chave de IA do cliente a cada mensagem.
 */
export function AtendimentoSimulador({ base, showToast }: { base: string; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ultima, setUltima] = useState<Resposta | null>(null);

  async function enviar() {
    const msg = texto.trim();
    if (!msg || enviando) return;
    const novos: Turno[] = [...turnos, { de: 'paciente', texto: msg }];
    setTurnos(novos);
    setTexto('');
    setEnviando(true);
    try {
      const res = await fetch(`${base}/simular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagens: novos }) });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'A simulação falhou.');
      const r = corpo as Resposta;
      setUltima(r);
      // O que a IA mandaria entra na conversa, para a próxima pergunta ter o contexto.
      if ('texto' in r.proposta && r.proposta.texto) setTurnos([...novos, { de: 'ia', texto: r.proposta.texto }]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'A simulação falhou.', 'error');
    } finally {
      setEnviando(false);
    }
  }

  const p = ultima?.proposta;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-sm"><FlaskConical className="w-4 h-4" /> 4. Testar sem enviar</div>
        {turnos.length > 0 ? (
          <Button type="button" variant="outline" className="text-xs" onClick={() => { setTurnos([]); setUltima(null); }}>Limpar conversa</Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Escreva como se fosse um paciente. Nada é enviado, nada entra na fila e a equipe não é avisada. Cada mensagem usa a chave de IA do cliente.
      </p>

      <div className="space-y-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-background/50 p-3" aria-live="polite">
        {turnos.length === 0 ? <p className="text-xs text-muted-foreground">Ex.: “Oi, queria marcar uma consulta” ou “Vocês atendem convênio?”</p> : null}
        {turnos.map((t, i) => (
          <div key={i} className={`flex ${t.de === 'paciente' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${t.de === 'paciente' ? 'bg-accent/60 text-foreground' : 'bg-primary text-primary-foreground'}`}>
              <span className="block text-[10px] opacity-70 mb-0.5">{t.de === 'paciente' ? 'Paciente' : 'IA'}</span>
              {t.texto}
            </div>
          </div>
        ))}
        {enviando ? <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> A IA está pensando…</p> : null}
      </div>

      {p ? (
        <div className="text-xs space-y-1.5 rounded-xl border border-border px-3 py-2">
          {p.tipo === 'sem_chave_ia' ? <p className="text-destructive">Este cliente ainda não tem chave de IA. Cadastre na tela de IA do CRM.</p> : null}
          {p.tipo === 'vazia' ? <p>A IA não responderia nada a essa mensagem.</p> : null}
          {p.tipo === 'urgencia' || p.tipo === 'transferir' ? (
            <p><strong>Passaria a conversa para a equipe</strong> (a equipe receberia um aviso): {p.motivo}</p>
          ) : null}
          {p.tipo === 'responder' || p.tipo === 'transferir' || p.tipo === 'urgencia' ? (
            <p className="text-muted-foreground">
              Na fila esperaria entre {ultima!.ritmo.minSegundos} e {ultima!.ritmo.maxSegundos} segundos
              {ultima!.ritmo.dentroDoHorario ? '' : ' e só sairia dentro do horário de atendimento (agora está fora dele)'}.
            </p>
          ) : null}
          {'agendaVista' in p && p.agendaVista ? (
            <details>
              <summary className="cursor-pointer text-muted-foreground">Agenda que a IA enxergou</summary>
              <pre className="mt-1.5 whitespace-pre-wrap text-[11px] text-muted-foreground">{p.agendaVista}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <Input aria-label="Mensagem do paciente" value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem do paciente…" disabled={enviando} />
        <Button type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
        </Button>
      </form>
    </div>
  );
}
