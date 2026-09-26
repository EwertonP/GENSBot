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
} from 'lucide-react';
import type { Form } from '@/types/form';
import FormBuilder from './forms/form-builder';
import { toast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/ui/dialog';

interface FormsTabProps {
  clientes?: { id: string; nome: string; cor?: string }[];
  clienteSelecionado?: string | null;
}

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
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Carrega clientes se não passados via props
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

  // Modal de visualização de respostas
  const [viewingResponsesForm, setViewingResponsesForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Carrega lista de formulários
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

  // Filtra por busca e cliente selecionado
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

  // Cria novo formulário
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
        }),
      });

      if (!res.ok) throw new Error('Não foi possível criar o formulário.');
      const created = await res.json();
      toast.success('Formulário criado com sucesso!');
      setShowNovoModal(false);
      setNovoTitulo('');
      setNovoClienteId('');
      // Abre direto no editor
      setEditingFormId(created.id);
    } catch (err: any) {
      toast.error('Erro ao criar formulário', { description: err.message });
    } finally {
      setCreating(false);
    }
  }

  // Exclui formulário
  async function handleExcluir(form: Form) {
    const ok = await confirmDialog({
      title: `Excluir o formulário "${form.titulo}"?`,
      description: 'Esta ação apagará todas as perguntas e respostas coletadas.',
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

  // Copia link público
  function handleCopiarLink(slug: string, id: string) {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Abre visualizador de respostas
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

  // Se estiver editando um formulário, exibe o construtor visual full screen
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
      {/* Barra de Ferramentas Superior */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar formulário por título, cliente ou slug..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-emerald-500 shadow-2xs"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowNovoModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
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
        <div className="min-h-[360px] flex flex-col items-center justify-center p-8 bg-white border border-zinc-200/80 rounded-3xl text-center space-y-4">
          <div className="p-4 rounded-3xl bg-emerald-50 text-emerald-600">
            <FileQuestion className="w-10 h-10 stroke-[1.75]" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-base font-bold text-zinc-900">Nenhum formulário encontrado</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Crie formulários conversacionais estilo Typeform para captar e qualificar pacientes e clientes com 1 pergunta por vez.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNovoModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Criar meu primeiro formulário</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formsFiltrados.map((form) => {
            const isPublicado = form.publicado;
            const linkPublico = `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${form.slug}`;

            return (
              <div
                key={form.id}
                className="bg-white border border-zinc-200/80 hover:border-zinc-300 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-2xs font-bold px-2.5 py-1 rounded-full border ${
                        isPublicado
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }`}
                    >
                      {isPublicado ? '● Publicado' : '○ Rascunho'}
                    </span>

                    {form.cliente_nome && (
                      <span className="text-2xs font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-lg truncate max-w-[130px]">
                        {form.cliente_nome}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-zinc-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {form.titulo}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5 line-clamp-1">
                      /f/{form.slug}
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-zinc-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                    <button
                      type="button"
                      onClick={() => handleAbrirRespostas(form)}
                      className="hover:text-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{form.total_respostas || 0} respostas</span>
                    </button>
                    <span className="text-2xs text-zinc-400">
                      {new Date(form.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingFormId(form.id)}
                      className="flex-1 py-2 px-3 bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 text-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopiarLink(form.slug, form.id)}
                      title="Copiar link público"
                      className="p-2 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-zinc-600 cursor-pointer transition-colors"
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
                      title="Abrir formulário no navegador"
                      className="p-2 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-zinc-600 cursor-pointer transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleExcluir(form)}
                      title="Excluir formulário"
                      className="p-2 border border-zinc-200 hover:bg-rose-50 hover:border-rose-200 text-zinc-400 hover:text-rose-600 rounded-xl cursor-pointer transition-colors"
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

      {/* Modal Criar Novo Formulário */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCriarFormulario}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900">Novo Formulário Typeform</h3>
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  Título do Formulário *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Avaliação de Estética Facial"
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  Vincular a um Cliente (Opcional)
                </label>
                <select
                  value={novoClienteId}
                  onChange={(e) => setNovoClienteId(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="">Nenhum (Uso Geral da Agência)</option>
                  {listaClientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <span className="text-2xs text-zinc-400 mt-1 block">
                  Herda a identidade visual e o logo do cliente automaticamente.
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating || !novoTitulo.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Formulário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal / Gaveta de Respostas Coletadas */}
      {viewingResponsesForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Respostas: {viewingResponsesForm.titulo}
                </h3>
                <p className="text-xs text-zinc-500">
                  {responses.length} lead(s) capturado(s) até agora
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingResponsesForm(null)}
                className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
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
                <div className="space-y-3">
                  {responses.map((resp, i) => (
                    <div
                      key={resp.id}
                      className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-zinc-400 font-mono text-2xs">
                        <span>Lead #{responses.length - i}</span>
                        <span>{new Date(resp.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {Object.entries(resp.respostas || {}).map(([key, val]) => (
                          <div key={key} className="bg-white p-2.5 rounded-xl border border-zinc-200/80">
                            <span className="font-semibold text-zinc-800 block truncate">
                              {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingResponsesForm(null)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800"
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
