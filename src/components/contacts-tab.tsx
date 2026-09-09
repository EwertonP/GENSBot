'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { FileText, Trash2, ExternalLink, Plus, X, Pencil, StickyNote } from 'lucide-react';
import { tagColorClasses } from '@/lib/tag-colors';
import { Sheet } from '@/components/ui/sheet';

const PAGE_SIZE = 50;

interface Contact {
  instagram_id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[] | null;
  profile_picture_url: string | null;
  last_response_at: string | null;
  first_contact_at: string | null;
  created_at?: string;
}

interface ContactsTabProps {
  /** Constrói a URL da API já com `?account=...` — mesma função usada pelo resto do dashboard. */
  withAccount: (url: string) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
  /** Muda sempre que o usuário troca de conta no seletor da sidebar — reseta a paginação. */
  accountKey: string;
}

function exportToCsv(filename: string, rows: Record<string, any>[], showToast: ContactsTabProps['showToast']) {
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
}

function contactCsvRow(c: Contact) {
  return {
    nome: c.name || '',
    username: c.username || '',
    instagram_id: c.instagram_id,
    email: c.email || '',
    telefone: c.phone || '',
    tags: (c.tags || []).join('; '),
    observacoes: c.notes || '',
    ultima_interacao: c.last_response_at || '',
    cadastrado_em: c.first_contact_at || c.created_at || '',
  };
}

/**
 * "Leads & Público" extraído de src/app/page.tsx (que tinha ~2500 linhas concentrando
 * todas as abas). Ao contrário da versão anterior, busca sua própria página de
 * contatos via GET /api/contacts (paginado) em vez de depender da lista completa e
 * sem limite que vinha embutida no payload gigante do dashboard.
 */
export default function ContactsTab({ withAccount, showToast, accountKey }: ContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tagFilter, setTagFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; phone: string; notes: string; tags: string[] }>({ name: '', email: '', phone: '', notes: '', tags: [] });
  const [tagDraft, setTagDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (tagFilter) params.set('tag', tagFilter);
      const res = await fetch(withAccount(`/api/contacts?${params.toString()}`));
      const data = await res.json();
      if (res.ok) {
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
        setAllTags(data.allTags || []);
      } else {
        showToast('Erro ao carregar contatos.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao carregar contatos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reseta pra página 1 sempre que a conta ou o filtro de tag mudam — ajustado
  // durante a própria renderização (padrão recomendado pelo React pra "resetar
  // estado quando uma prop muda"), não num efeito à parte, que forçaria um
  // ciclo extra de render só pra aplicar o reset antes do fetch de fato rodar.
  const resetKey = `${accountKey}:${tagFilter}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
    setSelectedContactIds(new Set());
  }

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, tagFilter, page]);

  const selectedContacts = contacts.filter(c => selectedContactIds.has(c.instagram_id));
  const allSelected = contacts.length > 0 && contacts.every(c => selectedContactIds.has(c.instagram_id));

  const toggleAll = () => {
    setSelectedContactIds(allSelected ? new Set() : new Set(contacts.map(c => c.instagram_id)));
  };
  const toggleOne = (id: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return;
    if (!confirm(`Excluir ${selectedContacts.length} contato(s) da audiência? Essa ação não pode ser desfeita.`)) return;
    for (const c of selectedContacts) {
      try {
        await fetch(withAccount(`/api/contacts/${c.instagram_id}`), { method: 'DELETE' });
      } catch (err) {
        console.error('Erro ao excluir contato:', err);
      }
    }
    setSelectedContactIds(new Set());
    await fetchContacts();
    showToast('Contatos excluídos.', 'success');
  };

  const patchTags = async (contactId: string, nextTags: string[]) => {
    try {
      const res = await fetch(withAccount(`/api/contacts/${contactId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (res.ok) {
        setContacts(prev => prev.map(c => c.instagram_id === contactId ? { ...c, tags: nextTags } : c));
      } else {
        showToast('Erro ao atualizar tag.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao atualizar tag.', 'error');
    }
  };

  const handleAddTag = (contactId: string, currentTags: string[], newTag: string) => {
    const tag = newTag.trim();
    if (!tag || currentTags.includes(tag)) return;
    patchTags(contactId, [...currentTags, tag]);
  };

  const handleRemoveTag = (contactId: string, currentTags: string[], tagToRemove: string) => {
    patchTags(contactId, currentTags.filter(t => t !== tagToRemove));
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      tags: contact.tags || [],
    });
    setTagDraft('');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingContact(null);
  };

  const addEditTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    setEditForm(prev => prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] });
  };

  const removeEditTag = (tag: string) => {
    setEditForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  // Digitar "cabelo, " (vírgula, com ou sem espaço depois) cria a tag e limpa o
  // campo — dá pra colar várias de uma vez também ("cabelo, botox, acne").
  const handleTagDraftChange = (value: string) => {
    if (!value.includes(',')) {
      setTagDraft(value);
      return;
    }
    const parts = value.split(',');
    const remainder = parts.pop() || '';
    parts.forEach(addEditTag);
    setTagDraft(remainder.trimStart());
  };

  const handleTagDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEditTag(tagDraft);
      setTagDraft('');
    } else if (e.key === 'Backspace' && !tagDraft && editForm.tags.length > 0) {
      removeEditTag(editForm.tags[editForm.tags.length - 1]);
    }
  };

  const saveEdit = async () => {
    if (!editingContact) return;
    setSavingEdit(true);
    try {
      const tags = tagDraft.trim() ? [...editForm.tags, tagDraft.trim()] : editForm.tags;
      const res = await fetch(withAccount(`/api/contacts/${editingContact.instagram_id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim() || null,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          notes: editForm.notes.trim() || null,
          tags,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setContacts(prev => prev.map(c => c.instagram_id === updated.instagram_id ? { ...c, ...updated } : c));
        setEditingContact(null);
        showToast('Lead atualizado.', 'success');
      } else {
        showToast('Erro ao salvar as alterações do lead.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao salvar o lead.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="bg-card border border-accent rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground text-base">Audiência Cadastrada</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Lista de usuários que interagiram com as suas automações.</p>
        </div>
        <div className="flex items-center gap-2">
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="bg-accent border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="">Todas as tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          )}
          {selectedContacts.length > 0 && (
            <>
              <button
                onClick={() => exportToCsv('contatos_selecionados.csv', selectedContacts.map(contactCsvRow), showToast)}
                className="flex items-center gap-1.5 bg-accent hover:bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Exportar {selectedContacts.length} selecionado{selectedContacts.length > 1 ? 's' : ''}
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 bg-accent hover:bg-destructive/10 border border-border hover:border-destructive/40 rounded-xl px-3 py-1.5 text-xs font-bold text-destructive cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir {selectedContacts.length} selecionado{selectedContacts.length > 1 ? 's' : ''}
              </button>
            </>
          )}
          <button
            onClick={() => exportToCsv('contatos_pagina_atual.csv', contacts.map(contactCsvRow), showToast)}
            title="Exporta só os contatos carregados nesta página"
            className="flex items-center gap-1.5 bg-accent hover:bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Exportar página
          </button>
          <span className="bg-accent border border-primary/25 text-primary font-bold text-xs px-3 py-1.5 rounded-xl">
            {total} Contato{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-muted-foreground">
          <thead className="text-xs uppercase text-muted-foreground font-bold border-b border-accent">
            <tr>
              <th className="py-3 px-4 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos os contatos desta página"
                  className="cursor-pointer"
                />
              </th>
              <th className="py-3 px-4"><span className="sr-only">Foto</span></th>
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">Instagram</th>
              <th className="py-3 px-4">ID do Usuário</th>
              <th className="py-3 px-4">Dados Capturados</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4">Última Interação</th>
              <th className="py-3 px-4">Cadastrado em</th>
              <th className="py-3 px-4"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accent">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-muted-foreground">Carregando...</td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-muted-foreground">Nenhum contato cadastrado no banco de dados até o momento.</td>
              </tr>
            ) : (
              contacts.map(item => (
                <tr key={item.instagram_id} className="hover:bg-card/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <input
                      type="checkbox"
                      checked={selectedContactIds.has(item.instagram_id)}
                      onChange={() => toggleOne(item.instagram_id)}
                      aria-label={`Selecionar ${item.name || item.username || item.instagram_id}`}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    {item.profile_picture_url ? (
                      <img
                        src={item.profile_picture_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {(item.name || item.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      {item.name || <span className="text-muted-foreground font-normal italic">Não informado</span>}
                      {item.notes && (
                        <span title={item.notes}>
                          <StickyNote className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-primary">
                    {item.username ? (
                      <a
                        href={`https://instagram.com/${item.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        @{item.username}
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">Desconhecido</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{item.instagram_id}</td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {item.email && <span className="text-muted-foreground">📧 {item.email}</span>}
                      {item.phone && <span className="text-muted-foreground">📱 {item.phone}</span>}
                      {!item.email && !item.phone && <span className="text-muted-foreground italic">Nenhum</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                      {(item.tags || []).map((tag: string) => (
                        <span key={tag} className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border ${tagColorClasses(tag)}`}>
                          {tag}
                          <button onClick={() => handleRemoveTag(item.instagram_id, item.tags || [], tag)} className="hover:text-destructive cursor-pointer">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {editingTagsFor === item.instagram_id ? (
                        <input
                          autoFocus
                          value={tagInputValue}
                          onChange={e => setTagInputValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleAddTag(item.instagram_id, item.tags || [], tagInputValue);
                              setTagInputValue('');
                              setEditingTagsFor(null);
                            } else if (e.key === 'Escape') {
                              setEditingTagsFor(null);
                              setTagInputValue('');
                            }
                          }}
                          onBlur={() => { setEditingTagsFor(null); setTagInputValue(''); }}
                          placeholder="nova tag..."
                          className="w-20 bg-accent border border-border rounded-full px-2 py-0.5 text-[10px] focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingTagsFor(item.instagram_id)}
                          className="w-5 h-5 rounded-full bg-accent hover:bg-muted flex items-center justify-center text-muted-foreground cursor-pointer"
                          title="Adicionar tag"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">
                    {item.last_response_at ? new Date(item.last_response_at).toLocaleString('pt-BR') : 'Sem interação'}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">
                    {item.first_contact_at || item.created_at ? new Date((item.first_contact_at || item.created_at) as string).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => openEdit(item)}
                      title="Editar lead"
                      className="w-7 h-7 rounded-lg bg-accent hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-xl bg-accent hover:bg-muted border border-border text-xs font-bold text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-xl bg-accent hover:bg-muted border border-border text-xs font-bold text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <Sheet
        open={!!editingContact}
        onClose={closeEdit}
        aria-label="Editar Lead"
        className="w-full max-w-md p-6 flex flex-col gap-4"
      >
        {editingContact && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-base">Editar Lead</h3>
              <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              @{editingContact.username || editingContact.instagram_id}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Nome</label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Telefone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Tags</label>
              <div className="bg-accent border border-border rounded-xl px-2 py-2 flex flex-wrap items-center gap-1.5 focus-within:border-primary">
                {editForm.tags.map(tag => (
                  <span key={tag} className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border text-xs ${tagColorClasses(tag)}`}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeEditTag(tag)}
                      className="hover:text-destructive cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagDraft}
                  onChange={e => handleTagDraftChange(e.target.value)}
                  onKeyDown={handleTagDraftKeyDown}
                  onBlur={() => { if (tagDraft.trim()) { addEditTag(tagDraft); setTagDraft(''); } }}
                  placeholder={editForm.tags.length === 0 ? 'ex: cabelo, botox' : 'nova tag...'}
                  className="flex-1 min-w-[100px] bg-transparent text-sm focus:outline-none text-foreground placeholder-muted-foreground py-0.5"
                />
              </div>
              <p className="text-[9px] text-muted-foreground">Digite e use vírgula (ou Enter) pra criar cada tag.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Observações</label>
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
                placeholder='ex: "Cirurgião plástico, dor principal é captar pacientes particulares"'
                className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground resize-none"
              />
              <p className="text-[9px] text-muted-foreground">Anotações livres — só você vê, não é enviado ao lead.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={closeEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-muted border border-border text-xs font-bold text-foreground cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
