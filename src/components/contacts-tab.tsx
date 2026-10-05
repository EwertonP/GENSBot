'use client';
import { DataTable, DataTablePagination } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';

import { useEffect, useState } from 'react';
import { FileText, Trash2, Info, Search, Users, StickyNote } from 'lucide-react';
import { tagColorClasses } from '@/lib/tag-colors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Tip } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { confirmDialog } from '@/components/ui/dialog';
import { ContactFicha, type FichaContact } from '@/components/contact-ficha';
import { formatDateTime, formatPhone, respostasDe } from '@/lib/contact-format';

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 200;

interface Contact extends FichaContact {
  flow_state?: Record<string, unknown> | null;
}

interface ContactsTabProps {
  /** Constrói a URL da API já com `?account=...` — mesma função usada pelo resto do dashboard. */
  withAccount: (url: string) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
  /** Muda sempre que o usuário troca de conta no seletor da sidebar — reseta a paginação. */
  accountKey: string;
}

/** CSV com uma coluna por resposta de pergunta (cargo, cidade...), além dos dados fixos do lead. */
function exportToCsv(filename: string, contacts: Contact[], showToast: ContactsTabProps['showToast']) {
  if (contacts.length === 0) {
    showToast('Nada para exportar ainda.', 'error');
    return;
  }
  const respostas = contacts.map((c) => respostasDe(c.flow_state));
  const campos = Array.from(new Set(respostas.flatMap((r) => Object.keys(r)))).sort();
  const rows = contacts.map((c, i) => ({
    nome: c.name || '',
    instagram: c.username ? `@${c.username}` : '',
    email: c.email || '',
    telefone: c.phone || '',
    origem: c.origem?.name || '',
    tags: (c.tags || []).join('; '),
    ...Object.fromEntries(campos.map((campo) => [campo, respostas[i][campo] || ''])),
    observacoes: c.notes || '',
    ultima_interacao: c.last_response_at || '',
    primeiro_contato: c.first_contact_at || '',
    instagram_id: c.instagram_id,
  }));
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escapeCell(row[h as keyof typeof row])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Vazio() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * Audiência: quem entrou nas automações da conta. A tabela mostra só o que a equipe
 * consulta no dia a dia (quem é, e-mail, telefone, de onde veio); o resto — respostas,
 * jornada, conversa, ID do Instagram — fica na ficha que abre ao clicar na linha.
 */
export default function ContactsTab({ withAccount, showToast, accountKey }: ContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tagFilter, setTagFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fichaId, setFichaId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Busca só depois de uma pausa na digitação, pra não disparar uma requisição por tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = (p: number, size: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(size) });
    if (tagFilter) params.set('tag', tagFilter);
    if (search) params.set('search', search);
    return params.toString();
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch(withAccount(`/api/contacts?${queryParams(page, PAGE_SIZE)}`));
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

  // Reseta pra página 1 sempre que a conta, a tag ou a busca mudam — ajustado durante a
  // própria renderização (padrão recomendado pelo React pra "resetar estado quando uma
  // prop muda"), não num efeito à parte, que forçaria um ciclo extra de render.
  const resetKey = `${accountKey}:${tagFilter}:${search}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, tagFilter, search, page]);

  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Exporta TODOS os contatos do filtro atual (não só a página na tela), buscando de 200 em 200. */
  const exportAll = async () => {
    setExporting(true);
    try {
      const all: Contact[] = [];
      for (let p = 1; ; p++) {
        const res = await fetch(withAccount(`/api/contacts?${queryParams(p, EXPORT_PAGE_SIZE)}`));
        const data = await res.json();
        if (!res.ok) throw new Error();
        all.push(...(data.contacts || []));
        if (all.length >= (data.total || 0) || (data.contacts || []).length === 0) break;
      }
      exportToCsv('audiencia.csv', all, showToast);
    } catch {
      showToast('Erro ao exportar a audiência.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return;
    if (!(await confirmDialog({ title: `Excluir ${selectedContacts.length} contato${selectedContacts.length > 1 ? 's' : ''}?`, description: 'Eles saem da audiência e das automações. Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', tone: 'destructive' }))) return;
    // Em paralelo, contando o que de fato foi excluído.
    const results = await Promise.allSettled(
      selectedContacts.map(async (c) => {
        const res = await fetch(`/api/contacts/${c.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(c.id);
        return c.id;
      }),
    );
    const falharam = new Set(results.flatMap((r, i) => (r.status === 'rejected' ? [selectedContacts[i].id] : [])));
    const ok = results.length - falharam.size;
    // Mantém selecionados só os que falharam, pra tentar de novo com um clique.
    setSelectedIds(new Set(falharam));
    await fetchContacts();
    if (falharam.size === 0) showToast(ok === 1 ? 'Contato excluído.' : `${ok} contatos excluídos.`, 'success');
    else if (ok === 0) showToast('Nenhum contato foi excluído. Tente novamente.', 'error');
    else showToast(`${ok} excluídos, ${falharam.size} falharam — eles continuam selecionados.`, 'error');
  };

  const filtrando = !!(search || tagFilter);

  return (
    <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-4 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-title font-bold text-foreground">Audiência</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Quem entrou nas suas automações. Clique numa pessoa pra ver a ficha completa.</p>
        </div>
        <Badge variant="muted" className="tabular-nums">
          {total} contato{total !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nome, @, e-mail ou telefone" aria-label="Buscar contatos" className="pl-9" />
        </div>
        {allTags.length > 0 && (
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Filtrar por tag" className="max-w-[220px]">
            <option value="">Todas as tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {selectedContacts.length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={() => exportToCsv('contatos_selecionados.csv', selectedContacts, showToast)}>
                <FileText className="w-3.5 h-3.5" />
                Exportar {selectedContacts.length}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDeleteSelected} className="text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
                Excluir {selectedContacts.length}
              </Button>
            </>
          )}
          <Tip label={filtrando ? 'Exporta todos os contatos deste filtro, com as respostas das perguntas' : 'Exporta toda a audiência, com as respostas das perguntas'}>
            <Button variant="secondary" size="sm" onClick={exportAll} loading={exporting} disabled={total === 0}>
              <FileText className="w-3.5 h-3.5" />
              Exportar CSV
            </Button>
          </Tip>
        </div>
      </div>

      <DataTable
        rows={contacts}
        loading={loading}
        getRowId={(c) => c.id}
        onRowClick={(c) => setFichaId(c.id)}
        selection={{ selectedIds, onToggle: toggleOne, onToggleAll: toggleAll, rowLabel: (c) => c.name || c.username || 'contato' }}
        empty={
          filtrando ? (
            <EmptyState size="compact" icon={Search} title="Ninguém encontrado" description="Nenhum contato bate com essa busca ou tag." action={{ label: 'Limpar filtros', onClick: () => { setSearchInput(''); setSearch(''); setTagFilter(''); } }} />
          ) : (
            <EmptyState size="compact" icon={Users} title="Ninguém entrou nas automações ainda" description="Quem comentar, responder story ou mandar DM com a palavra-chave de uma automação ativa aparece aqui." />
          )
        }
        columns={[
          {
            id: 'contato',
            header: 'Contato',
            mobile: 'primary',
            cell: (c) => {
              const temArroba = !!c.username && c.username !== c.instagram_id;
              return (
                <div className="flex items-center gap-2.5 sm:min-w-[180px]">
                  <Avatar nome={c.name || c.username || '?'} src={c.profile_picture_url} size="md" />
                  <div className="min-w-0">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFichaId(c.id); }} className="font-semibold text-foreground truncate block max-w-[220px] text-left hover:underline cursor-pointer">
                      {c.name || (temArroba ? `@${c.username}` : 'Sem nome')}
                    </button>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      {temArroba ? (
                        c.name ? `@${c.username}` : null
                      ) : (
                        <Tip label="A Meta só libera o @ de quem comentou num post (ou depois do App Review). Ele aparece sozinho na próxima interação.">
                          <span className="italic inline-flex items-center gap-1 cursor-help">
                            @ pendente <Info className="w-3 h-3" />
                          </span>
                        </Tip>
                      )}
                      {c.notes && (
                        <Tip label={c.notes}>
                          <StickyNote className="w-3 h-3 text-warning" aria-label="Tem observações" />
                        </Tip>
                      )}
                    </span>
                  </div>
                </div>
              );
            },
          },
          { id: 'email', header: 'E-mail', className: 'text-foreground max-w-[220px] truncate', cell: (c) => c.email || <Vazio /> },
          { id: 'telefone', header: 'Telefone', className: 'text-foreground tabular-nums whitespace-nowrap', cell: (c) => (c.phone ? formatPhone(c.phone) : <Vazio />) },
          { id: 'origem', header: 'Origem', className: 'text-muted-foreground max-w-[200px] truncate', cell: (c) => c.origem?.name || <Vazio /> },
          {
            id: 'tags',
            header: 'Tags',
            cell: (c) => {
              const tags = c.tags || [];
              return (
                <div className="flex items-center gap-1 max-w-[220px]">
                  {tags.slice(0, 2).map((tag) => (
                    <span key={tag} className={`font-semibold text-xs px-2 py-0.5 rounded-full border truncate max-w-[110px] ${tagColorClasses(tag)}`}>
                      {tag}
                    </span>
                  ))}
                  {tags.length > 2 && (
                    <Tip label={tags.slice(2).join(', ')}>
                      <span className="text-xs text-muted-foreground font-medium">+{tags.length - 2}</span>
                    </Tip>
                  )}
                  {tags.length === 0 && <Vazio />}
                </div>
              );
            },
          },
          { id: 'ultima', header: 'Última interação', align: 'right', mobileLabel: 'Última', className: 'text-xs text-muted-foreground tabular-nums whitespace-nowrap', cell: (c) => formatDateTime(c.last_response_at) || <Vazio /> },
        ]}
      />

      <DataTablePagination page={page} totalPages={totalPages} onPage={setPage} />

      <ContactFicha
        contactId={fichaId}
        onClose={() => setFichaId(null)}
        onSaved={(updated) => setContacts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))}
        onDeleted={(id) => {
          setFichaId(null);
          setContacts((prev) => prev.filter((c) => c.id !== id));
          setTotal((t) => Math.max(0, t - 1));
        }}
        showToast={showToast}
      />
    </Card>
  );
}
