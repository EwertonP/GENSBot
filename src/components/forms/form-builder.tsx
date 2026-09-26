'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Monitor,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Type,
  AlignLeft,
  Phone,
  Mail,
  ListOrdered,
  Star,
  Gauge,
  UploadCloud,
  FileCheck2,
  Settings,
  Palette,
  Bell,
  HelpCircle,
} from 'lucide-react';
import type { Form, FormField, FormFieldType, FormTemaConfig } from '@/types/form';
import FormPlayer from './form-player';
import { toast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/ui/dialog';

interface FormBuilderProps {
  formId: string;
  onBack: () => void;
  clientes?: { id: string; nome: string; cor?: string }[];
}

const LETRAS_OPCOES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const TEMA_PRESETS = [
  {
    nome: 'Esmeralda Clínico',
    config: { cor_primaria: '#059669', cor_fundo: '#ffffff', cor_texto: '#09090b', cor_card: '#f4f4f5' },
    badge: 'bg-emerald-600',
  },
  {
    nome: 'Obsidian Dark',
    config: { cor_primaria: '#10b981', cor_fundo: '#09090b', cor_texto: '#fafafa', cor_card: '#18181b' },
    badge: 'bg-zinc-900 border border-zinc-700',
  },
  {
    nome: 'Rose Gold / Dermato',
    config: { cor_primaria: '#e11d48', cor_fundo: '#fff1f2', cor_texto: '#881337', cor_card: '#ffe4e6' },
    badge: 'bg-rose-500',
  },
  {
    nome: 'Champagne Nude',
    config: { cor_primaria: '#d97706', cor_fundo: '#fefce8', cor_texto: '#451a03', cor_card: '#fef9c3' },
    badge: 'bg-amber-600',
  },
  {
    nome: 'Lavanda Tech',
    config: { cor_primaria: '#7c3aed', cor_fundo: '#faf5ff', cor_texto: '#3b0764', cor_card: '#f3e8ff' },
    badge: 'bg-purple-600',
  },
];

const FIELD_TYPE_INFO: Record<
  FormFieldType,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  welcome: { label: 'Boas-vindas', icon: Sparkles, description: 'Tela inicial com botão começar' },
  text: { label: 'Texto Curto', icon: Type, description: 'Para nome, cidade ou resposta breve' },
  textarea: { label: 'Texto Longo', icon: AlignLeft, description: 'Para queixas, mensagens detalhadas' },
  whatsapp: { label: 'WhatsApp', icon: Phone, description: 'Telefone com máscara brasileira' },
  email: { label: 'E-mail', icon: Mail, description: 'E-mail com validação' },
  choice: { label: 'Múltipla Escolha', icon: ListOrdered, description: 'Opções A, B, C com auto-avanço' },
  rating: { label: 'Estrelas (1-5)', icon: Star, description: 'Classificação por estrelas' },
  nps: { label: 'NPS (0-10)', icon: Gauge, description: 'Escala de recomendação' },
  date: { label: 'Data', icon: Settings, description: 'Seleção de data' },
  file: { label: 'Upload de Arquivo', icon: UploadCloud, description: 'Anexo de fotos ou exames (R2)' },
  terms: { label: 'Termos / LGPD', icon: FileCheck2, description: 'Checkbox de consentimento' },
  thank_you: { label: 'Agradecimento', icon: Check, description: 'Tela final de sucesso com CTA' },
};

export default function FormBuilder({ formId, onBack, clientes = [] }: FormBuilderProps) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pergunta' | 'tema' | 'ajustes'>('pergunta');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms/${formId}`);
        if (!res.ok) throw new Error('Não foi possível carregar o formulário.');
        const data = await res.json();
        setForm(data);
        const loadedFields = data.fields || [];
        setFields(loadedFields);
        if (loadedFields.length > 0) {
          setSelectedFieldId(loadedFields[0].id);
        }
      } catch (err: any) {
        toast.error('Erro ao carregar formulário', { description: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadForm();
  }, [formId]);

  const selectedField = fields.find((f) => f.id === selectedFieldId) || fields[0];

  function handleAddField(tipo: FormFieldType) {
    if (!form) return;
    const info = FIELD_TYPE_INFO[tipo];
    const newField: FormField = {
      id: crypto.randomUUID(),
      form_id: form.id,
      tipo,
      label: tipo === 'thank_you' ? 'Obrigado!' : `Pergunta sobre ${info.label.toLowerCase()}`,
      descricao: null,
      placeholder: null,
      obrigatorio: tipo !== 'thank_you' && tipo !== 'welcome',
      ordem: fields.length,
      opcoes:
        tipo === 'choice'
          ? [
              { id: crypto.randomUUID(), label: 'Opção 1' },
              { id: crypto.randomUUID(), label: 'Opção 2' },
            ]
          : [],
    };

    const updated = [...fields, newField];
    setFields(updated);
    setSelectedFieldId(newField.id);
    setActiveTab('pergunta');
    setShowAddMenu(false);
  }

  function handleMoveField(idx: number, dir: 'up' | 'down') {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const newFields = [...fields];
    const [moved] = newFields.splice(idx, 1);
    newFields.splice(targetIdx, 0, moved);
    setFields(newFields);
  }

  async function handleDeleteField(fieldId: string) {
    if (fields.length <= 1) {
      toast.error('O formulário precisa ter pelo menos 1 etapa.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Excluir esta pergunta?',
      description: 'Esta pergunta será removida permanentemente do formulário.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'destructive',
    });
    if (!ok) return;

    const updated = fields.filter((f) => f.id !== fieldId);
    setFields(updated);
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(updated[0]?.id || null);
    }
  }

  function handleUpdateSelectedField(patch: Partial<FormField>) {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => (f.id === selectedFieldId ? { ...f, ...patch } : f))
    );
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const formRes = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: form.titulo,
          slug: form.slug,
          descricao: form.descricao,
          publicado: form.publicado,
          cliente_id: form.cliente_id,
          tema_config: form.tema_config,
          notificacao_whatsapp_numero: form.notificacao_whatsapp_numero,
          redirect_url: form.redirect_url,
        }),
      });
      if (!formRes.ok) throw new Error('Falha ao salvar configurações do formulário.');

      const fieldsRes = await fetch(`/api/forms/${form.id}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!fieldsRes.ok) throw new Error('Falha ao salvar perguntas do formulário.');

      toast.success('Formulário salvo com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublicado() {
    if (!form) return;
    const novoStatus = !form.publicado;
    setForm({ ...form, publicado: novoStatus });
    try {
      await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicado: novoStatus }),
      });
      toast.success(novoStatus ? 'Formulário publicado! Acessível pelo link.' : 'Formulário pausado.');
    } catch {
      setForm({ ...form, publicado: !novoStatus });
    }
  }

  if (loading || !form) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500 font-medium text-xs">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando construtor de formulários...</span>
        </div>
      </div>
    );
  }

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;

  const previewForm: Form = {
    ...form,
    fields,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Topo do Construtor */}
      <header className="h-14 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Voltar para a lista"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="font-bold text-sm text-zinc-900 dark:text-white bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 focus:ring-1 focus:ring-emerald-500 px-2 py-1 rounded-lg transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            placeholder="Título do Formulário"
          />
        </div>

        {/* Alternador Desktop / Celular */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              previewDevice === 'desktop'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              previewDevice === 'mobile'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Celular</span>
          </button>
        </div>

        {/* Ações da Direita */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePublicado}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-all ${
              form.publicado
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${form.publicado ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            <span>{form.publicado ? 'Publicado' : 'Rascunho'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartilhar</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-bold px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm active:scale-98 cursor-pointer transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Salvando...' : 'Salvar'}</span>
          </button>
        </div>
      </header>

      {/* Grid com 3 Colunas */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUNA 1: Lista Estruturada de Perguntas */}
        <aside className="w-68 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-2xs font-mono font-bold uppercase tracking-widest text-zinc-400">
              Etapas ({fields.length})
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddMenu((v) => !v)}
                className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Adicionar pergunta"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>

              {showAddMenu && (
                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 grid gap-1 max-h-80 overflow-y-auto">
                  <span className="text-2xs font-bold uppercase tracking-wider text-zinc-400 px-2 py-1">
                    Escolha o tipo
                  </span>
                  {(Object.keys(FIELD_TYPE_INFO) as FormFieldType[]).map((tipo) => {
                    const info = FIELD_TYPE_INFO[tipo];
                    const Icon = info.icon;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => handleAddField(tipo)}
                        className="w-full p-2 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{info.label}</span>
                          <span className="text-2xs text-zinc-400 leading-tight">{info.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fields.map((f, idx) => {
              const isSelected = f.id === selectedFieldId;
              const info = FIELD_TYPE_INFO[f.tipo] || { label: f.tipo, icon: Type };
              const Icon = info.icon;

              return (
                <div
                  key={f.id}
                  onClick={() => {
                    setSelectedFieldId(f.id);
                    setActiveTab('pergunta');
                  }}
                  className={`group p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-300 font-semibold shadow-2xs'
                      : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xs font-mono text-zinc-400 w-3.5 text-center">{idx + 1}</span>
                    <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
                    <span className="text-xs truncate">{f.label || 'Pergunta sem título'}</span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveField(idx, 'up');
                      }}
                      className="p-1 hover:text-emerald-600 disabled:opacity-20"
                      title="Mover para cima"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === fields.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveField(idx, 'down');
                      }}
                      className="p-1 hover:text-emerald-600 disabled:opacity-20"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteField(f.id);
                      }}
                      className="p-1 hover:text-rose-600 text-zinc-400 transition-colors"
                      title="Excluir pergunta"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* COLUNA 2: Canvas com Molduras de Dispositivo (Apple / Linear Tier) */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden bg-zinc-100/70 dark:bg-zinc-950/70">
          {previewDevice === 'desktop' ? (
            /* Moldura Estilo Janela macOS */
            <div className="w-full max-w-4xl h-full flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all">
              <div className="h-10 bg-zinc-100/90 dark:bg-zinc-800/90 border-b border-zinc-200/80 dark:border-zinc-700/80 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10" />
                </div>
                <div className="max-w-md w-full h-6 rounded-lg bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center px-3 gap-1.5 text-2xs text-zinc-500 font-mono">
                  <span className="text-emerald-600">🔒</span>
                  <span className="truncate">gensbot.com/f/{form.slug}</span>
                </div>
                <div className="w-10" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <FormPlayer form={previewForm} isPreview={true} />
              </div>
            </div>
          ) : (
            /* Moldura Estilo iPhone 16 Pro com Dynamic Island */
            <div className="w-[360px] max-h-[720px] h-full flex flex-col rounded-[50px] p-3 bg-zinc-950 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.35)] border-4 border-zinc-800 shrink-0 transition-all">
              {/* Dynamic Island */}
              <div className="w-24 h-5 rounded-full bg-black mx-auto mb-2 shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-zinc-900 mr-2" />
              </div>
              <div className="flex-1 rounded-[38px] overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">
                <FormPlayer form={previewForm} isPreview={true} />
              </div>
            </div>
          )}
        </main>

        {/* COLUNA 3: Inspetor de Propriedades */}
        <aside className="w-80 border-l border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
          <div className="h-12 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-around px-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('pergunta')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'pergunta'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pergunta</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tema')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'tema'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Tema</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ajustes')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'ajustes'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Ajustes</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ABA 1: CONFIGURAÇÕES DA PERGUNTA */}
            {activeTab === 'pergunta' && selectedField && (
              <div className="space-y-4">
                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Tipo do Bloco
                  </label>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                    {React.createElement(FIELD_TYPE_INFO[selectedField.tipo]?.icon || Type, {
                      className: 'w-4 h-4 text-emerald-600',
                    })}
                    <span>{FIELD_TYPE_INFO[selectedField.tipo]?.label || selectedField.tipo}</span>
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Título da Pergunta
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                    className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-transparent"
                    placeholder="Ex: Qual procedimento te interessa?"
                  />
                </div>

                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Instrução / Descrição Auxiliar
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.descricao || ''}
                    onChange={(e) => handleUpdateSelectedField({ descricao: e.target.value })}
                    className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-transparent resize-none"
                    placeholder="Ex: Entraremos em contato com você por aqui."
                  />
                </div>

                {selectedField.tipo !== 'welcome' && selectedField.tipo !== 'thank_you' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Resposta Obrigatória</span>
                    <input
                      type="checkbox"
                      checked={selectedField.obrigatorio}
                      onChange={(e) => handleUpdateSelectedField({ obrigatorio: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                )}

                {/* Opções de Múltipla Escolha */}
                {selectedField.tipo === 'choice' && (
                  <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                      Opções de Resposta
                    </label>
                    <div className="space-y-2">
                      {(selectedField.opcoes || []).map((opt, i) => (
                        <div key={opt.id} className="flex items-center gap-1.5">
                          <span className="w-5 text-2xs font-bold text-zinc-400 text-center">
                            {LETRAS_OPCOES[i] || i + 1}
                          </span>
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(selectedField.opcoes || [])];
                              newOpts[i] = { ...newOpts[i], label: e.target.value };
                              handleUpdateSelectedField({ opcoes: newOpts });
                            }}
                            className="flex-1 text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 focus:border-emerald-500 focus:outline-none bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = (selectedField.opcoes || []).filter((_, idx) => idx !== i);
                              handleUpdateSelectedField({ opcoes: newOpts });
                            }}
                            className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newOpts = [
                          ...(selectedField.opcoes || []),
                          { id: crypto.randomUUID(), label: `Nova Opção` },
                        ];
                        handleUpdateSelectedField({ opcoes: newOpts });
                      }}
                      className="w-full mt-1 py-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      + Adicionar Opção
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: TEMA & PALETAS LUXURY */}
            {activeTab === 'tema' && (
              <div className="space-y-5">
                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                    Paletas Predefinidas
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {TEMA_PRESETS.map((preset) => (
                      <button
                        key={preset.nome}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, ...preset.config },
                          })
                        }
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-4 h-4 rounded-full ${preset.badge}`} />
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            {preset.nome}
                          </span>
                        </div>
                        <span className="text-2xs text-zinc-400 font-mono">{preset.config.cor_primaria}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div>
                    <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                      Cor Primária
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.tema_config?.cor_primaria || '#10b981'}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_primaria: e.target.value },
                          })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200"
                      />
                      <input
                        type="text"
                        value={form.tema_config?.cor_primaria || '#10b981'}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_primaria: e.target.value },
                          })
                        }
                        className="flex-1 text-xs font-mono uppercase p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                      Cor de Fundo
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.tema_config?.cor_fundo || '#ffffff'}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_fundo: e.target.value },
                          })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200"
                      />
                      <input
                        type="text"
                        value={form.tema_config?.cor_fundo || '#ffffff'}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_fundo: e.target.value },
                          })
                        }
                        className="flex-1 text-xs font-mono uppercase p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                      Logo do Cliente (URL)
                    </label>
                    <input
                      type="url"
                      value={form.tema_config?.logo_url || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tema_config: { ...form.tema_config, logo_url: e.target.value },
                        })
                      }
                      placeholder="https://exemplo.com/logo.png"
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: AJUSTES & NOTIFICAÇÕES */}
            {activeTab === 'ajustes' && (
              <div className="space-y-4">
                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Slug do Link
                  </label>
                  <div className="flex items-center gap-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-800">
                    <span className="text-zinc-400">/f/</span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      className="flex-1 bg-transparent font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Cliente Vinculado
                  </label>
                  <select
                    value={form.cliente_id || ''}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value || null })}
                    className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-white dark:bg-zinc-900"
                  >
                    <option value="">Nenhum (Uso Geral da Agência)</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    WhatsApp para Alerta de Novo Lead
                  </label>
                  <input
                    type="tel"
                    value={form.notificacao_whatsapp_numero || ''}
                    onChange={(e) => setForm({ ...form, notificacao_whatsapp_numero: e.target.value })}
                    placeholder="11999999999 (com DDD)"
                    className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500 bg-transparent"
                  />
                  <span className="text-2xs text-zinc-400 mt-1 block">
                    Número que receberá o botão de contato direto no final.
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal de Compartilhamento */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Compartilhar Formulário</h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 block">Link Direto</label>
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-transparent text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-700 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-100 shadow-2xs hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 block">Incorporar em Site (Iframe)</label>
              <textarea
                readOnly
                rows={2}
                value={`<iframe src="${publicUrl}" width="100%" height="650" frameborder="0"></iframe>`}
                className="w-full text-2xs font-mono p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 resize-none focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-between items-center">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
              >
                <span>Abrir formulário</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-bold cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
