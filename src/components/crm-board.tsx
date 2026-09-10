'use client';

import React, { useEffect, useState } from 'react';
import { Star, Phone, AtSign, X, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Board } from '@/components/ui/board';

type LeadStatus = 'novo' | 'qualificado' | 'contatado' | 'promovido' | 'descartado';

interface Lead {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  instagram_handle: string | null;
  email: string | null;
  google_rating: number | null;
  score: number | null;
  status: LeadStatus;
  created_at: string;
}

interface Activity {
  id: string;
  channel: string;
  type: string;
  body: string | null;
  created_at: string;
}

const COLUMNS: { id: LeadStatus; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'contatado', label: 'Contatado' },
  { id: 'promovido', label: 'Promovido' },
];

/** CRM de prospecção (Onda 4) — lê/escreve direto no Supabase do Prospecção Gens,
 * um projeto separado (ver src/lib/prospeccao-client.ts). Uso interno da agência,
 * sem escopo por conta de Instagram como o resto do GENSBot. */
export default function CrmBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/crm/leads')
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return [];
        }
        return res.json();
      })
      .then((data) => setLeads(Array.isArray(data) ? data.filter((l: Lead) => l.status !== 'descartado') : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const moveLead = async (leadId: string, target: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === target) return;

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: target } : l)));
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) throw new Error();
    } catch {
      load();
    }
  };

  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
    setLoadingActivities(true);
    fetch(`/api/crm/leads/${lead.id}/activities`)
      .then((res) => res.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .finally(() => setLoadingActivities(false));
  };

  const handleAddNote = async () => {
    if (!selectedLead || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteText.trim(), channel: 'nota' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar nota.');
      setActivities((prev) => [data, ...prev]);
      setNoteText('');
    } catch {
      // Silencioso — o campo de texto permanece preenchido pro usuário tentar de novo.
    } finally {
      setSavingNote(false);
    }
  };

  if (notConfigured) {
    return (
      <EmptyState
        icon={Star}
        title="CRM não configurado"
        description="Faltam as variáveis de ambiente PROSPECCAO_SUPABASE_URL e PROSPECCAO_SUPABASE_SERVICE_ROLE_KEY na Vercel (Settings > API do projeto ProspeccaoGens no Supabase)."
      />
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-12">Carregando leads...</p>;
  }

  if (leads.length === 0) {
    return <EmptyState icon={Star} title="Nenhum lead ainda" description="Leads aparecem aqui assim que o Prospecção Gens rodar uma coleta." />;
  }

  return (
    <>
      <Board<Lead, LeadStatus>
        columns={COLUMNS}
        items={leads}
        getItemId={(lead) => lead.id}
        getItemStatus={(lead) => lead.status}
        onMove={moveLead}
        renderCard={(lead) => (
          <Card padding="sm" onClick={() => openLead(lead)} interactive className="rounded-xl">
            <p className="text-xs font-bold text-foreground truncate">{lead.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{lead.category || 'Sem categoria'} {lead.city ? `· ${lead.city}` : ''}</p>
            <div className="flex items-center gap-2 mt-2">
              {lead.google_rating && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-warning" /> {lead.google_rating}
                </span>
              )}
              {lead.score !== null && <Badge variant={lead.score >= 70 ? 'success' : 'muted'}>{lead.score} pts</Badge>}
            </div>
          </Card>
        )}
      />

      <Sheet open={!!selectedLead} onClose={() => setSelectedLead(null)} aria-label="Detalhe do lead" className="w-full max-w-md max-h-[85vh] overflow-y-auto">
        {selectedLead && (
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">{selectedLead.name}</h3>
              <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {selectedLead.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {selectedLead.whatsapp_phone || selectedLead.phone}</p>}
              {selectedLead.instagram_handle && <p className="flex items-center gap-1.5"><AtSign className="w-3.5 h-3.5" /> {selectedLead.instagram_handle}</p>}
              {selectedLead.email && <p>{selectedLead.email}</p>}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <p className="text-xs font-bold text-foreground">Registrar atividade</p>
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Nota sobre o contato feito..." />
              <Button onClick={handleAddNote} disabled={savingNote || !noteText.trim()} size="sm">
                <Send className="w-3.5 h-3.5" /> Registrar
              </Button>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <p className="text-xs font-bold text-foreground">Histórico</p>
              {loadingActivities ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="text-xs bg-muted/40 rounded-lg px-3 py-2">
                    <p className="text-foreground">{act.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{act.channel} · {new Date(act.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
