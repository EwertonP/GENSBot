'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { X, ExternalLink, Info, Copy, Trash2, Inbox, MessageSquare } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Tip } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { confirmDialog } from '@/components/ui/dialog';
import { tagColorClasses } from '@/lib/tag-colors';
import { formatDateTime, formatPhone } from '@/lib/contact-format';

export interface FichaContact {
  id: string;
  instagram_id: string;
  instagram_user_id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[] | null;
  profile_picture_url: string | null;
  first_contact_at: string | null;
  last_response_at: string | null;
  origem: { id: string; name: string | null } | null;
}

interface Ficha {
  contact: FichaContact;
  conta: string | null;
  respostas: Record<string, string>;
  jornada: { event_type: string; created_at: string; automation_id: string | null; automation_name: string | null }[];
  mensagens: { id: string; direction: 'inbound' | 'outbound'; text: string | null; created_at: string }[];
}

interface ContactFichaProps {
  contactId: string | null;
  onClose: () => void;
  /** Contato salvo — a tabela atualiza a linha sem recarregar a página. */
  onSaved: (contact: Partial<FichaContact> & { id: string }) => void;
  onDeleted: (id: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const EVENT_LABELS: Record<string, string> = {
  comment: 'Comentou no post',
  welcome_dm_sent: 'Recebeu a DM inicial',
  link_clicked: 'Tocou no botão da DM',
  lead_captured: 'Deixou e-mail e telefone',
  reminder_sent: 'Recebeu um lembrete',
  sequence_sent: 'Recebeu um follow-up',
};

interface FormState {
  name: string;
  email: string;
  phone: string;
  notes: string;
  tags: string[];
  respostas: Record<string, string>;
}

function formFrom(ficha: Ficha): FormState {
  const c = ficha.contact;
  return {
    name: c.name || '',
    email: c.email || '',
    phone: formatPhone(c.phone),
    notes: c.notes || '',
    tags: c.tags || [],
    respostas: { ...ficha.respostas },
  };
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 px-6 py-5 border-t border-border">
      <div className="flex items-center justify-between">
        <h4 className="eyebrow text-muted-foreground">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Ficha detalhada do lead (Onda 4): tudo que o GENSBot sabe sobre a pessoa numa conta —
 * dados capturados, respostas das perguntas, por quais automações ela passou e as
 * últimas mensagens. Dados, respostas, tags e observações são editáveis.
 */
export function ContactFicha({ contactId, onClose, onSaved, onDeleted, showToast }: ContactFichaProps) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  // Trocou de contato: limpa a ficha anterior durante a própria renderização (mesmo
  // padrão de reset por prop da tabela), e o efeito abaixo só busca a nova.
  const [prevContactId, setPrevContactId] = useState(contactId);
  if (contactId !== prevContactId) {
    setPrevContactId(contactId);
    setFicha(null);
    setForm(null);
    setTagDraft('');
  }
  const loading = !!contactId && !ficha;

  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    fetch(`/api/contacts/${contactId}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          showToast(data.error || 'Erro ao abrir a ficha.', 'error');
          onClose();
          return;
        }
        setFicha(data);
        setForm(formFrom(data));
      })
      .catch(() => {
        if (cancelled) return;
        showToast('Erro de conexão ao abrir a ficha.', 'error');
        onClose();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const dirty = useMemo(() => {
    if (!ficha || !form) return false;
    return JSON.stringify(formFrom(ficha)) !== JSON.stringify(form) || !!tagDraft.trim();
  }, [ficha, form, tagDraft]);

  // Jornada agrupada por automação, da mais recente pra mais antiga.
  const jornada = useMemo(() => {
    const groups = new Map<string, { name: string; events: Ficha['jornada'] }>();
    for (const e of ficha?.jornada || []) {
      const key = e.automation_id || 'sem-automacao';
      if (!groups.has(key)) groups.set(key, { name: e.automation_name || 'Automação excluída', events: [] });
      groups.get(key)!.events.push(e);
    }
    return Array.from(groups.values());
  }, [ficha]);

  if (!contactId) return null;
  const c = ficha?.contact;

  // O Sheet só confirma no Esc/clique fora — os botões de fechar da ficha passam pela mesma pergunta.
  const requestClose = async () => {
    if (dirty && !(await confirmDialog({ title: 'Descartar alterações?', description: 'Você tem alterações que ainda não foram salvas. Se fechar agora, elas serão perdidas.', confirmLabel: 'Descartar', cancelLabel: 'Continuar editando', tone: 'destructive' }))) return;
    onClose();
  };
  const temArroba = !!c?.username && c.username !== c.instagram_id;

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    setForm((prev) => (prev && !prev.tags.includes(tag) ? { ...prev, tags: [...prev.tags, tag] } : prev));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagDraft);
      setTagDraft('');
    } else if (e.key === 'Backspace' && !tagDraft && form?.tags.length) {
      setForm({ ...form, tags: form.tags.slice(0, -1) });
    }
  };

  const save = async () => {
    if (!ficha || !form) return;
    setSaving(true);
    try {
      const tags = tagDraft.trim() && !form.tags.includes(tagDraft.trim()) ? [...form.tags, tagDraft.trim()] : form.tags;
      // Resposta apagada no formulário vai como null pra sair do flow_state.
      const respostas: Record<string, string | null> = { ...form.respostas };
      for (const key of Object.keys(ficha.respostas)) if (!form.respostas[key]?.trim()) respostas[key] = null;
      const phoneChanged = form.phone.trim() !== formatPhone(ficha.contact.phone);

      const res = await fetch(`/api/contacts/${ficha.contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          email: form.email.trim() || null,
          ...(phoneChanged ? { phone: form.phone.trim() || null } : {}),
          notes: form.notes.trim() || null,
          tags,
          respostas,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erro ao salvar o lead.', 'error');
        return;
      }
      const next: Ficha = { ...ficha, contact: { ...ficha.contact, ...data, origem: ficha.contact.origem }, respostas: data.respostas || {} };
      setFicha(next);
      setForm(formFrom(next));
      setTagDraft('');
      onSaved({ ...data, origem: ficha.contact.origem });
      showToast('Lead atualizado.', 'success');
    } catch {
      showToast('Erro de conexão ao salvar o lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!ficha) return;
    const quem = ficha.contact.username ? `@${ficha.contact.username}` : ficha.contact.name || 'este contato';
    if (!(await confirmDialog({ title: `Excluir ${quem}?`, description: 'A ficha e o histórico dele nesta conta saem da audiência. Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', tone: 'destructive' }))) return;
    const res = await fetch(`/api/contacts/${ficha.contact.id}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Não consegui excluir o contato. Tente de novo.', 'error');
      return;
    }
    onDeleted(ficha.contact.id);
    showToast('Contato excluído.', 'success');
  };

  const copyIgsid = async () => {
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c.instagram_id);
      showToast('ID copiado.', 'success');
    } catch {
      showToast('Não consegui copiar o ID.', 'error');
    }
  };

  return (
    <Sheet open={!!contactId} onClose={onClose} dirty={dirty} aria-label="Ficha do lead" className="w-full max-w-lg p-0 flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 px-6 pt-6 pb-5">
        {c ? <Avatar nome={c.name || c.username || '?'} src={c.profile_picture_url} size="lg" /> : <Skeleton className="size-10 rounded-full" />}
        <div className="flex-1 min-w-0">
          {c ? (
            <>
              <h3 className="text-title font-bold text-foreground truncate">{c.name || (temArroba ? `@${c.username}` : 'Sem nome')}</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-sm">
                {temArroba ? (
                  <a href={`https://instagram.com/${c.username}`} target="_blank" rel="noopener noreferrer" className="text-brand-text font-semibold hover:underline inline-flex items-center gap-1">
                    @{c.username}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Tip label="A Meta só libera o @ de quem comentou num post (ou depois do App Review). Ele aparece sozinho na próxima interação.">
                    <span className="text-muted-foreground italic inline-flex items-center gap-1 cursor-help">
                      @ pendente <Info className="w-3 h-3" />
                    </span>
                  </Tip>
                )}
                {ficha?.conta && <span className="text-muted-foreground">· em @{ficha.conta}</span>}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          )}
        </div>
        <button onClick={requestClose} className="text-muted-foreground hover:text-foreground cursor-pointer p-1" aria-label="Fechar ficha">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading || !ficha || !form || !c ? (
          <div className="flex flex-col gap-3 px-6 py-5 border-t border-border">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <Section title="Dados do lead">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Ainda não informou" />
                <Input label="Telefone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ainda não informou" className="tabular-nums" />
              </div>
              <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={c.name ? '' : 'A Meta não liberou o nome'} />
            </Section>

            <Section title="Respostas">
              {Object.keys(form.respostas).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma resposta de pergunta salva ainda.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.entries(form.respostas).map(([campo, valor]) => (
                    <div key={campo} className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-3">
                      <span className="text-label font-medium text-muted-foreground truncate">{campo}</span>
                      <Input aria-label={`Resposta: ${campo}`} value={valor} onChange={(e) => setForm({ ...form, respostas: { ...form.respostas, [campo]: e.target.value } })} />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Tags">
              <div className="border border-input rounded-xl px-2 py-2 flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-ring">
                {form.tags.map((tag) => (
                  <span key={tag} className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full border text-xs ${tagColorClasses(tag)}`}>
                    {tag}
                    <button type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })} className="hover:text-destructive cursor-pointer" aria-label={`Remover tag ${tag}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => {
                    addTag(tagDraft);
                    setTagDraft('');
                  }}
                  aria-label="Nova tag"
                  placeholder={form.tags.length === 0 ? 'ex: quente, cliente' : 'nova tag...'}
                  className="flex-1 min-w-[100px] bg-transparent text-sm focus:outline-none text-foreground placeholder-muted-foreground py-0.5"
                />
              </div>
            </Section>

            <Section title="Observações">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Anotações livres. Só a equipe vê, nunca vai pro lead." />
            </Section>

            <Section title="Jornada" aside={c.origem?.name ? <Badge variant="brand">Entrou por: {c.origem.name}</Badge> : undefined}>
              {jornada.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {jornada.map((grupo) => (
                    <div key={grupo.name} className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{grupo.name}</span>
                      <ol className="flex flex-col gap-1 border-l border-border-strong pl-3">
                        {grupo.events.map((e, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className={e.event_type === 'lead_captured' ? 'text-success font-medium' : 'text-muted-foreground'}>{EVENT_LABELS[e.event_type] || e.event_type}</span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDateTime(e.created_at)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Conversa"
              aside={
                ficha.mensagens.length > 0 ? (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Inbox className="w-3 h-3" /> últimas {ficha.mensagens.length} no Inbox
                  </span>
                ) : undefined
              }
            >
              {ficha.mensagens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ficha.mensagens.map((m) => (
                    <div key={m.id} className={`flex flex-col max-w-[85%] ${m.direction === 'outbound' ? 'self-end items-end' : 'self-start items-start'}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.direction === 'outbound' ? 'bg-accent text-foreground' : 'bg-muted text-foreground border border-border'}`}>
                        {m.text || <span className="italic text-muted-foreground inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> mídia</span>}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums mt-0.5">{formatDateTime(m.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Detalhes">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Primeiro contato</dt>
                <dd className="text-foreground tabular-nums">{formatDateTime(c.first_contact_at) || '—'}</dd>
                <dt className="text-muted-foreground">Última interação</dt>
                <dd className="text-foreground tabular-nums">{formatDateTime(c.last_response_at) || '—'}</dd>
                <dt className="text-muted-foreground">ID no Instagram</dt>
                <dd className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground truncate">{c.instagram_id}</span>
                  <Tip label="Copiar ID">
                    <button type="button" onClick={copyIgsid} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Copiar ID no Instagram">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </Tip>
                </dd>
              </dl>
            </Section>
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-card">
        <Button variant="ghost" size="sm" onClick={remove} disabled={!ficha || saving} className="text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
            Fechar
          </Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
            Salvar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
