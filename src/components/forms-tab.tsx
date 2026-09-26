'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Layers,
  Sparkles,
  Calendar,
  MessageCircle,
  Eye,
  BarChart3,
  X,
  Download,
  Stethoscope,
  Briefcase,
  Star,
  FileText,
} from 'lucide-react';
import type { Form } from '@/types/form';
import FormBuilder from './forms/form-builder';
import { toast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/ui/dialog';

interface FormsTabProps {
  clientes?: { id: string; nome: string; cor?: string }[];
  clienteSelecionado?: string | null;
}

const TEMPLATES = [
  {
    id: 'estetica',
    nome: 'Avaliação Clínica / Estética',
    descricao: 'Para captação de pacientes de Botox, Harmonização, Odonto ou Cirurgia.',
    icon: Stethoscope,
    badge: 'Popular',
  },
  {
    nome: 'Qualificação de Lead B2B',
    id: 'b2b',
    descricao: 'Descubra faturamento, urgência e desafio do cliente antes de agendar.',
    icon: Briefcase,
    badge: 'Comercial',
  },
  {
    nome: 'Pesquisa NPS & Satisfação',
    id: 'nps',
    descricao: 'Avaliação pós-atendimento com notas de 0 a 10 e feedback.',
    icon: Star,
    badge: 'Feedback',
  },
  {
    nome: 'Em Branco (Personalizado)',
    id: 'custom',
    descricao: 'Comece com uma estrutura vazia e adicione suas próprias perguntas.',
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
      description: 'Esta ação apagará todas as perguntas e respostas coletadas deste formulário.',
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
    <div className="space-y-6 pb-12 font-sans">
      {/* Barra Superior */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por título, cliente ou link..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowNovoModal(true)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Formulário</span>
        </button>
      </div>

      {/* Grid de Formulários */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-500 text-xs font-medium">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Carregando formulários...</span>
          </div>
        </div>
      ) : formsFiltrados.length === 0 ? (
        <div className="min-h-[380px] flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl text-center space-y-4 shadow-2xs">
          <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <FileQuestion className="w-10 h-10 stroke-[1.75]" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Nenhum formulário ativo</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Crie formulários conversacionais estilo Typeform para captar e qualificar leads com foco em 1 pergunta por vez.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNovoModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Criar meu primeiro formulário</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {formsFiltrados.map((form) => {
            const isPublicado = form.publicado;
            const linkPublico = `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${form.slug}`;

            return (
              <div
                key={form.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-3xl p-5 shadow-2xs hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-2xs font-bold px-2.5 py-1 rounded-full border ${
                        isPublicado
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                      }`}
                    >
                      {isPublicado ? '● Publicado' : '○ Rascunho'}
                    </span>

                    {form.cliente_nome && (
                      <span className="text-2xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg truncate max-w-[140px]">
                        {form.cliente_nome}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors line-clamp-1">
                      {form.titulo}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5 line-clamp-1">
                      /f/{form.slug}
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                    <button
                      type="button"
                      onClick={() => handleAbrirRespostas(form)}
                      className="hover:text-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {form.total_respostas || 0} respostas
                      </span>
                    </button>
                    <span className="text-2xs text-zinc-400 font-mono">
                      {new Date(form.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingFormId(form.id)}
                      className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopiarLink(form.slug, form.id)}
                      title="Copiar link público"
                      className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors"
                    >
                      {copiedId === form.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <a
                      href={`/f/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no navegador"
                      className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleExcluir(form)}
                      title="Excluir formulário"
                      className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 text-zinc-400 hover:text-rose-600 rounded-xl cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar Novo Formulário com Seleção de Template */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCriarFormulario}
            className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Criar Formulário Typeform</h3>
                <p className="text-xs text-zinc-500">Escolha um modelo inicial para acelerar a criação.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Título do Formulário *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Avaliação de Estética Facial"
                  className="w-full text-xs font-medium p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Vincular a um Cliente (Opcional)
                </label>
                <select
                  value={novoClienteId}
                  onChange={(e) => setNovoClienteId(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-white dark:bg-zinc-900"
                >
                  <option value="">Nenhum (Uso Geral da Agência)</option>
                  {listaClientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-2">
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
                        className={`p-3 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 shadow-2xs'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-zinc-500'}`} />
                          {tmpl.badge && (
                            <span className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                              {tmpl.badge}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{tmpl.nome}</h4>
                        <p className="text-3xs text-zinc-400 leading-tight mt-0.5">{tmpl.descricao}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating || !novoTitulo.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Formulário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Respostas Coletadas com Exportação CSV */}
      {viewingResponsesForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Respostas: {viewingResponsesForm.titulo}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {responses.length} lead(s) capturado(s) no total
                </p>
              </div>

              <div className="flex items-center gap-2">
                {responses.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingResponsesForm(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingResponses ? (
                <div className="py-12 flex justify-center text-zinc-400 text-xs">
                  Carregando respostas...
                </div>
              ) : responses.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  Nenhuma resposta recebida para este formulário ainda.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {responses.map((resp, i) => {
                    // Procura telefone para botão WhatsApp
                    let phoneFound: string | null = null;
                    Object.values(resp.respostas || {}).forEach((v) => {
                      if (typeof v === 'string' && /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.trim())) {
                        phoneFound = v.replace(/\D/g, '');
                      }
                    });

                    return (
                      <div
                        key={resp.id}
                        className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between text-zinc-400 font-mono text-2xs">
                          <span className="font-bold text-zinc-600 dark:text-zinc-300">
                            Lead #{responses.length - i}
                          </span>
                          <div className="flex items-center gap-3">
                            {phoneFound && (
                              <a
                                href={`https://wa.me/55${phoneFound}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/25 transition-colors"
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
                              className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800"
                            >
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                                {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingResponsesForm(null)}
                className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
