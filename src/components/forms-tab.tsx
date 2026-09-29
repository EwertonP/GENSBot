'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@/components/ui/spinner';
import {
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  Trash2,
  Users,
  FileQuestion,
  MessageCircle,
  X,
  Download,
  Stethoscope,
  Briefcase,
  Star,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { Form } from '@/types/form';
import FormBuilder from './forms/form-builder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { DialogShell, confirmDialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';

interface FormsTabProps {
  clientes?: { id: string; nome: string; cor?: string }[];
  clienteSelecionado?: string | null;
}

const TEMPLATES = [
  {
    id: 'estetica',
    nome: 'Avaliação Clínica / Estética',
    descricao: 'Captação de pacientes para procedimentos e consultas médicas/estéticas.',
    icon: Stethoscope,
    badge: 'Popular',
  },
  {
    id: 'b2b',
    nome: 'Qualificação de Lead B2B',
    descricao: 'Diagnóstico de perfil, maturidade e faturamento pré-agendamento.',
    icon: Briefcase,
    badge: 'Comercial',
  },
  {
    id: 'nps',
    nome: 'Pesquisa NPS & Satisfação',
    descricao: 'Escala 0 a 10 de satisfação e coleta de depoimentos pós-atendimento.',
    icon: Star,
    badge: 'Feedback',
  },
  {
    id: 'custom',
    nome: 'Em Branco (Personalizado)',
    descricao: 'Comece com uma tela em branco e monte suas próprias perguntas.',
    icon: FileText,
  },
];

export default function FormsTab({ clientes = [], clienteSelecionado = 'all' }: FormsTabProps) {
  const filtroCliente = clienteSelecionado || 'all';
  const [listaClientes, setListaClientes] = useState<{ id: string; nome: string; cor?: string }[]>(clientes);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoClienteId, setNovoClienteId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState('estetica');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal de visualização de respostas
  const [viewingResponsesForm, setViewingResponsesForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    if (clientes && clientes.length > 0) {
      setListaClientes(clientes);
    } else {
      fetch('/api/clientes')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setListaClientes(data.map((c: any) => ({ id: c.id, nome: c.nome, cor: c.cor })));
          }
        })
        .catch(() => {});
    }
  }, [clientes]);

  async function loadForms() {
    try {
      setLoading(true);
      const res = await fetch('/api/forms');
      if (!res.ok) throw new Error('Falha ao carregar formulários.');
      const data = await res.json();
      setForms(data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar formulários', { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForms();
  }, []);

  const formsFiltrados = useMemo(() => {
    return forms.filter((f) => {
      if (filtroCliente !== 'all' && f.cliente_id !== filtroCliente) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        return (
          f.titulo.toLowerCase().includes(termo) ||
          f.slug.toLowerCase().includes(termo) ||
          (f.cliente_nome || '').toLowerCase().includes(termo)
        );
      }
      return true;
    });
  }, [forms, filtroCliente, busca]);

  async function handleCriarFormulario(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novoTitulo.trim(),
          cliente_id: novoClienteId || null,
          template: selectedTemplate,
        }),
      });

      if (!res.ok) throw new Error('Não foi possível criar o formulário.');
      const created = await res.json();
      toast.success('Formulário criado com sucesso!');
      setShowNovoModal(false);
      setNovoTitulo('');
      setNovoClienteId('');
      setEditingFormId(created.id);
    } catch (err: any) {
      toast.error('Erro ao criar formulário', { description: err.message });
    } finally {
      setCreating(false);
    }
  }

  async function handleExcluir(form: Form) {
    const ok = await confirmDialog({
      title: `Excluir o formulário "${form.titulo}"?`,
      description: 'Esta ação apagará permanentemente todas as perguntas e respostas coletadas deste formulário.',
      confirmLabel: 'Excluir definitivamente',
      cancelLabel: 'Cancelar',
      tone: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/forms/${form.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir.');
      toast.success('Formulário excluído.');
      setForms((prev) => prev.filter((f) => f.id !== form.id));
    } catch (err: any) {
      toast.error('Erro ao excluir', { description: err.message });
    }
  }

  function handleCopiarLink(slug: string, id: string) {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleAbrirRespostas(form: Form) {
    setViewingResponsesForm(form);
    setLoadingResponses(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/responses`);
      if (!res.ok) throw new Error('Falha ao carregar respostas.');
      const data = await res.json();
      setResponses(data.responses || []);
    } catch (err: any) {
      toast.error('Erro ao carregar respostas', { description: err.message });
    } finally {
      setLoadingResponses(false);
    }
  }

  function handleExportCSV() {
    if (!responses || responses.length === 0 || !viewingResponsesForm) return;

    const allKeys = new Set<string>();
    responses.forEach((r) => {
      Object.keys(r.respostas || {}).forEach((k) => allKeys.add(k));
    });
    const headerCols = ['Data', 'Tempo (s)', 'UTM Source', 'UTM Campaign', ...Array.from(allKeys)];

    const rows = responses.map((r) => {
      const dataStr = new Date(r.created_at).toLocaleString('pt-BR');
      const tempo = r.tempo_preenchimento_segundos || '';
      const utmSrc = r.utm_source || '';
      const utmCmp = r.utm_campaign || '';
      const fieldVals = Array.from(allKeys).map((k) => {
        const val = r.respostas?.[k];
        return typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val || '');
      });
      return [dataStr, tempo, utmSrc, utmCmp, ...fieldVals]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = [headerCols.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `respostas_${viewingResponsesForm.slug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV exportado com sucesso!');
  }

  if (editingFormId) {
    return (
      <FormBuilder
        formId={editingFormId}
        onBack={() => {
          setEditingFormId(null);
          loadForms();
        }}
        clientes={listaClientes}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-12 font-sans">
      {/* Cabeçalho da Tela (Padrão GENSBot DESIGN.md) */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
          Captação & Leads · FORMULÁRIOS
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight flex items-center gap-2.5">
              <span>Formulários Conversacionais</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-foreground font-mono font-bold">
                {formsFiltrados.length}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formulários interativos focados em 1 pergunta por vez para qualificar contatos e salvar direto no CRM.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => setShowNovoModal(true)}
            className="self-start sm:self-auto shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Novo Formulário</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtro & Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por título, cliente ou link..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Grid de Formulários */}
      {loading ? (
        <div className="min-h-[280px] flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-medium">
            <Spinner className="text-primary" />
            <span>Carregando formulários...</span>
          </div>
        </div>
      ) : formsFiltrados.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="Nenhum formulário ativo"
          description="Crie formulários conversacionais estilo Typeform para captar e qualificar leads diretamente para o CRM."
          action={{
            label: 'Criar meu primeiro formulário',
            onClick: () => setShowNovoModal(true),
            icon: Plus,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formsFiltrados.map((form) => {
            const isPublicado = form.publicado;

            return (
              <Card
                key={form.id}
                padding="md"
                className="rounded-2xl border border-border bg-card shadow-2xs hover:border-border-strong hover:shadow-xs transition-[border-color,box-shadow] flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={isPublicado ? 'brand' : 'muted'} dot>
                      {isPublicado ? 'Publicado' : 'Rascunho'}
                    </Badge>

                    {form.cliente_nome && (
                      <span className="text-xs font-medium text-muted-foreground bg-accent px-2 py-0.5 rounded-lg truncate max-w-[150px]">
                        {form.cliente_nome}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-base text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                      {form.titulo}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 line-clamp-1">
                      /f/{form.slug}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleAbrirRespostas(form)}
                      className="hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {form.total_respostas || 0} respostas
                      </span>
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(form.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingFormId(form.id)}
                      className="flex-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      <span>Editar</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopiarLink(form.slug, form.id)}
                      title="Copiar link público"
                      className="px-2.5"
                    >
                      {copiedId === form.id ? (
                        <Check className="w-3.5 h-3.5 text-brand-text" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    <a
                      href={`/f/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no navegador"
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-border-strong text-foreground hover:bg-accent transition-ui text-xs font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExcluir(form)}
                      title="Excluir formulário"
                      className="px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive-soft"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Criar Novo Formulário com DialogShell (Base UI) */}
      <DialogShell
        open={showNovoModal}
        onRequestClose={() => setShowNovoModal(false)}
        aria-label="Criar Formulário"
        className="max-w-lg w-full"
      >
        <form onSubmit={handleCriarFormulario} className="flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Novo Formulário</h3>
              <p className="text-xs text-muted-foreground">Escolha um modelo inicial para acelerar a criação.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowNovoModal(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="text-label font-medium text-foreground block mb-1">
                Título do Formulário *
              </label>
              <Input
                type="text"
                required
                autoFocus
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Ex: Avaliação de Estética Facial"
              />
            </div>

            <div>
              <label className="text-label font-medium text-foreground block mb-1">
                Vincular a um Cliente (Opcional)
              </label>
              <Select
                value={novoClienteId}
                onChange={(e) => setNovoClienteId(e.target.value)}
              >
                <option value="">Nenhum (Uso Geral da Agência)</option>
                {listaClientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-label font-medium text-foreground block mb-2">
                Modelo Inicial
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  const Icon = tmpl.icon;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-ui ${
                        isSelected
                          ? 'border-primary bg-secondary/40 shadow-2xs'
                          : 'border-border hover:border-border-strong hover:bg-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        {tmpl.badge && (
                          <Badge variant="brand" className="text-3xs px-1.5 py-0">
                            {tmpl.badge}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-display text-xs font-bold text-foreground">{tmpl.nome}</h4>
                      <p className="text-caption text-muted-foreground leading-snug mt-0.5">{tmpl.descricao}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNovoModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
              disabled={!novoTitulo.trim()}
            >
              Criar Formulário
            </Button>
          </div>
        </form>
      </DialogShell>

      {/* Modal de Respostas Coletadas com DialogShell (Base UI) */}
      <DialogShell
        open={!!viewingResponsesForm}
        onRequestClose={() => setViewingResponsesForm(null)}
        aria-label="Respostas Coletadas"
        className="max-w-3xl w-full"
      >
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Respostas: {viewingResponsesForm?.titulo}
            </h3>
            <p className="text-xs text-muted-foreground font-mono">
              {responses.length} lead(s) capturado(s) no total
            </p>
          </div>

          <div className="flex items-center gap-2">
            {responses.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                <span>Exportar CSV</span>
              </Button>
            )}
            <button
              type="button"
              onClick={() => setViewingResponsesForm(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {loadingResponses ? (
            <div className="py-12 flex justify-center text-muted-foreground text-xs">
              Carregando respostas...
            </div>
          ) : responses.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Nenhuma resposta recebida para este formulário ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map((resp, i) => {
                let phoneFound: string | null = null;
                Object.values(resp.respostas || {}).forEach((v) => {
                  if (typeof v === 'string' && /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.trim())) {
                    phoneFound = v.replace(/\D/g, '');
                  }
                });

                return (
                  <Card
                    key={resp.id}
                    padding="sm"
                    className="rounded-xl border border-border bg-card shadow-2xs space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground font-mono text-caption">
                      <span className="font-bold text-foreground">
                        Lead #{responses.length - i}
                      </span>
                      <div className="flex items-center gap-3">
                        {phoneFound && (
                          <a
                            href={`https://wa.me/55${phoneFound}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chamar no WhatsApp</span>
                          </a>
                        )}
                        <span>{new Date(resp.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {Object.entries(resp.respostas || {}).map(([key, val]) => (
                        <div
                          key={key}
                          className="bg-accent/40 p-2.5 rounded-lg border border-border"
                        >
                          <span className="font-medium text-foreground block truncate">
                            {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/30 flex justify-end shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setViewingResponsesForm(null)}
          >
            Fechar
          </Button>
        </div>
      </DialogShell>
    </div>
  );
}
