'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  Phone,
  AtSign,
  X,
  Send,
  Building2,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  MessageSquare,
  Mail,
  UserCheck,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  { id: 'promovido', label: 'Promovido a Cliente' },
];

const CANAIS_ATIVIDADE = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'ligacao', label: 'Ligação' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'email', label: 'E-mail' },
  { id: 'nota', label: 'Nota Interna' },
];

/** CRM de prospecção (Onda 4) — Estilo Apollo.io / Attio com promoção 1-clique para Cliente. */
export default function CrmBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [canalAtividade, setCanalAtividade] = useState('whatsapp');
  const [savingNote, setSavingNote] = useState(false);
  const [promovendo, setPromovendo] = useState(false);
  const [promovidoComSucesso, setPromovidoComSucesso] = useState(false);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroScore, setFiltroScore] = useState<'all' | 'high' | 'medium'>('all');

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

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchNome = (lead.name || '').toLowerCase().includes(termo);
        const matchCat = (lead.category || '').toLowerCase().includes(termo);
        const matchCidade = (lead.city || '').toLowerCase().includes(termo);
        const matchIg = (lead.instagram_handle || '').toLowerCase().includes(termo);
        if (!matchNome && !matchCat && !matchCidade && !matchIg) return false;
      }
      if (filtroScore === 'high' && (lead.score == null || lead.score < 70)) return false;
      if (filtroScore === 'medium' && (lead.score == null || lead.score < 40)) return false;
      return true;
    });
  }, [leads, busca, filtroScore]);

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
    setPromovidoComSucesso(lead.status === 'promovido');
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
        body: JSON.stringify({ body: noteText.trim(), channel: canalAtividade }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar nota.');
      setActivities((prev) => [data, ...prev]);
      setNoteText('');
    } catch {
      // Silencioso
    } finally {
      setSavingNote(false);
    }
  };

  const handlePromoverParaCliente = async () => {
    if (!selectedLead) return;
    setPromovendo(true);
    try {
      // 1. Cria o cliente no banco de clientes
      const resCliente = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: selectedLead.name,
          nicho: selectedLead.category,
        }),
      });
      if (!resCliente.ok) {
        const dataErr = await resCliente.json();
        throw new Error(dataErr.error || 'Erro ao criar cliente.');
      }

      // 2. Atualiza o status do lead para 'promovido'
      await moveLead(selectedLead.id, 'promovido');
      setPromovidoComSucesso(true);
      setSelectedLead((prev) => (prev ? { ...prev, status: 'promovido' } : null));

      // 3. Registra atividade de promoção
      await fetch(`/api/crm/leads/${selectedLead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Promovido a Cliente ativo da GENS.', channel: 'sistema' }),
      });
    } catch (err: any) {
      alert(err.message || 'Erro ao promover lead.');
    } finally {
      setPromovendo(false);
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

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 1. Barra de Filtros e Busca Estilo Apollo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome, nicho, cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-accent/60 p-1 rounded-xl border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setFiltroScore('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filtroScore === 'all' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground'
              }`}
            >
              Todos ({leads.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroScore('high')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                filtroScore === 'high' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground'
              }`}
            >
              <Flame className="w-3 h-3 text-primary" />
              Alta Relevância (70+)
            </button>
          </div>
        </div>

        <span className="text-xs text-muted-foreground font-mono">
          {leadsFiltrados.length} leads no radar
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : leadsFiltrados.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou aguarde uma nova coleta do módulo de prospecção."
        />
      ) : (
        <Board<Lead, LeadStatus>
          columns={COLUMNS}
          items={leadsFiltrados}
          getItemId={(lead) => lead.id}
          getItemStatus={(lead) => lead.status}
          onMove={moveLead}
          renderCard={(lead) => {
            const isHigh = lead.score != null && lead.score >= 70;
            const isPromovido = lead.status === 'promovido';

            return (
              <Card
                padding="sm"
                onClick={() => openLead(lead)}
                interactive
                className={`rounded-2xl border border-border/80 hover:border-foreground/30 bg-card shadow-2xs hover:shadow-xs transition-all flex flex-col gap-2.5 ${
                  isPromovido ? 'border-lime/60 bg-lime/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{lead.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {lead.category || 'Sem nicho'} {lead.city ? `· ${lead.city}` : ''}
                    </p>
                  </div>

                  {lead.score !== null && (
                    <Badge variant={isHigh ? 'success' : 'muted'} className="text-[9px] font-bold shrink-0">
                      {lead.score} pts
                    </Badge>
                  )}
                </div>

                {/* Contatos Rápidos */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  {lead.google_rating && (
                    <span className="flex items-center gap-0.5 font-medium">
                      <Star className="w-3 h-3 text-warning fill-warning" /> {lead.google_rating}
                    </span>
                  )}
                  {lead.whatsapp_phone && (
                    <span className="flex items-center gap-0.5 font-mono text-foreground font-semibold">
                      <Phone className="w-2.5 h-2.5 text-primary" /> WA
                    </span>
                  )}
                  {lead.instagram_handle && (
                    <span className="flex items-center gap-0.5 font-mono">
                      @{lead.instagram_handle}
                    </span>
                  )}
                </div>
              </Card>
            );
          }}
        />
      )}

      {/* Sheet Lateral de Detalhes e Ações do Lead (Apollo-like) */}
      <Sheet
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        aria-label="Detalhe do lead"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {selectedLead && (
          <div className="p-6 flex flex-col gap-5">
            {/* Header do Lead */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Prospecção B2B
                </span>
                <h3 className="text-lg font-bold font-display text-foreground mt-0.5">
                  {selectedLead.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedLead.category || 'Geral'} {selectedLead.city ? `· ${selectedLead.city}, ${selectedLead.state || 'BR'}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CTA de Promoção Direta para Cliente GENS */}
            <div className="p-4 rounded-2xl bg-accent/60 border border-border/80 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Status no GENSBot</span>
                </div>
                <Badge variant={promovidoComSucesso ? 'success' : 'muted'} className="text-[10px] font-bold">
                  {promovidoComSucesso ? 'Cliente da Agência' : 'Lead em Prospecção'}
                </Badge>
              </div>

              {!promovidoComSucesso ? (
                <Button
                  type="button"
                  variant="lime"
                  size="sm"
                  onClick={handlePromoverParaCliente}
                  loading={promovendo}
                  className="w-full rounded-xl text-xs font-bold shadow-2xs text-neutral-950 dark:text-neutral-950"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  Promover a Cliente da Agência
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold bg-lime/30 p-2.5 rounded-xl border border-foreground/10">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Este lead já foi cadastrado na sua base de Clientes!</span>
                </div>
              )}
            </div>

            {/* Dados de Contato e Canais */}
            <div className="grid grid-cols-2 gap-3">
              {selectedLead.phone && (
                <a
                  href={`https://wa.me/55${selectedLead.whatsapp_phone?.replace(/\D/g, '') || selectedLead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl bg-card border border-border/70 hover:border-foreground/30 transition-all flex items-center gap-2 text-xs font-semibold text-foreground"
                >
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">WhatsApp</span>
                  <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                </a>
              )}

              {selectedLead.instagram_handle && (
                <a
                  href={`https://instagram.com/${selectedLead.instagram_handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl bg-card border border-border/70 hover:border-foreground/30 transition-all flex items-center gap-2 text-xs font-semibold text-foreground"
                >
                  <AtSign className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">@{selectedLead.instagram_handle}</span>
                  <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                </a>
              )}

              {selectedLead.email && (
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="col-span-2 p-3 rounded-xl bg-card border border-border/70 hover:border-foreground/30 transition-all flex items-center gap-2 text-xs font-semibold text-foreground"
                >
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{selectedLead.email}</span>
                  <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                </a>
              )}
            </div>

            {/* Registro de Atividades e Notas */}
            <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Registrar Interação</span>
                <select
                  value={canalAtividade}
                  onChange={(e) => setCanalAtividade(e.target.value)}
                  className="h-7 text-[11px] font-semibold bg-accent border border-border/70 rounded-lg px-2 text-foreground"
                >
                  {CANAIS_ATIVIDADE.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Detalhes da ligação, mensagem ou reunião..."
                className="text-xs"
              />

              <div className="flex justify-end">
                <Button
                  onClick={handleAddNote}
                  disabled={savingNote || !noteText.trim()}
                  size="sm"
                  variant="secondary"
                  className="rounded-xl text-xs font-bold"
                >
                  <Send className="w-3 h-3 mr-1" />
                  Registrar Atividade
                </Button>
              </div>
            </div>

            {/* Histórico / Timeline */}
            <div className="flex flex-col gap-2 pt-3 border-t border-border/60">
              <span className="text-xs font-bold text-foreground">Histórico de Atividades</span>
              {loadingActivities ? (
                <p className="text-xs text-muted-foreground py-2">Carregando...</p>
              ) : activities.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma atividade registrada ainda.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="text-xs bg-accent/30 border border-border/50 rounded-xl px-3 py-2.5 flex flex-col gap-1"
                    >
                      <p className="text-foreground leading-relaxed">{act.body}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {act.channel.toUpperCase()} · {new Date(act.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
