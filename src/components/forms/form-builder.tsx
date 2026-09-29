'use client';
import { SegmentedItem } from '@/components/ui/segmented';
import { Checkbox } from '@/components/ui/checkbox';

import React, { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import {
  ArrowLeft,
  Save,
  Globe,
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
  Sun,
  Moon,
  X,
} from 'lucide-react';
import type { Form, FormField, FormFieldType, FormTemaConfig } from '@/types/form';
import FormPlayer from './form-player';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DialogShell, confirmDialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { isColorDark, getOptimalTextColor, ensureAccessibleTextColor } from '@/lib/form-engine';
import { fieldInputClass } from '@/lib/form-styles';

interface FormBuilderProps {
  formId: string;
  onBack: () => void;
  clientes?: { id: string; nome: string; cor?: string }[];
}

const LETRAS_OPCOES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const TEMA_PRESETS: {
  nome: string;
  config: FormTemaConfig;
  badge: string;
}[] = [
  {
    nome: 'GENS Assinatura (Escuro)',
    config: {
      cor_primaria: '#d8ff3c',
      cor_fundo: '#09090b',
      cor_texto: '#f4f4f5',
      cor_card: '#141417',
      modo: 'dark',
    },
    badge: 'bg-[#d8ff3c] border border-black/20',
  },
  {
    nome: 'GENS Papel Warm (Claro)',
    config: {
      cor_primaria: '#192313',
      cor_fundo: '#f7f8f2',
      cor_texto: '#192313',
      cor_card: '#ffffff',
      modo: 'light',
    },
    badge: 'bg-[#192313]',
  },
  {
    nome: 'Clínica Pure (Claro)',
    config: {
      cor_primaria: '#0f766e',
      cor_fundo: '#ffffff',
      cor_texto: '#192313',
      cor_card: '#f7f8f2',
      modo: 'light',
    },
    badge: 'bg-teal-600',
  },
  {
    nome: 'Obsidian Minimal (Escuro)',
    config: {
      cor_primaria: '#ffffff',
      cor_fundo: '#0c0c0e',
      cor_texto: '#f4f4f5',
      cor_card: '#18181b',
      modo: 'dark',
    },
    badge: 'bg-zinc-800 border border-zinc-700',
  },
  {
    nome: 'Rosé / Dermato (Claro)',
    config: {
      cor_primaria: '#be123c',
      cor_fundo: '#faf7f5',
      cor_texto: '#291816',
      cor_card: '#ffffff',
      modo: 'light',
    },
    badge: 'bg-rose-500',
  },
  {
    nome: 'Champagne Nude (Claro)',
    config: {
      cor_primaria: '#b45309',
      cor_fundo: '#fefce8',
      cor_texto: '#451a03',
      cor_card: '#ffffff',
      modo: 'light',
    },
    badge: 'bg-amber-600',
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
      label: tipo === 'thank_you' ? 'Muito obrigado!' : `Pergunta sobre ${info.label.toLowerCase()}`,
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
        <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-medium">
          <Spinner className="text-primary" />
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
    <div className="flex flex-col h-[calc(100vh-68px)] bg-background overflow-hidden font-sans">
      {/* Topo do Construtor */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2 h-8 w-8"
            title="Voltar para a lista"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-border" />
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="font-display font-bold text-sm text-foreground bg-transparent hover:bg-accent px-2 py-1 rounded-lg transition-ui border border-transparent hover:border-border focus:border-input focus:bg-card focus:outline-none"
            placeholder="Título do Formulário"
          />
        </div>

        {/* Alternador Desktop / Celular */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          <SegmentedItem
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            group="form-builder-342"
            active={previewDevice === 'desktop'}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </SegmentedItem>
          <SegmentedItem
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            group="form-builder-342"
            active={previewDevice === 'mobile'}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Celular</span>
          </SegmentedItem>
        </div>

        {/* Ações da Direita */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePublicado}
            className="cursor-pointer"
          >
            <Badge variant={form.publicado ? 'brand' : 'muted'} dot>
              {form.publicado ? 'Publicado' : 'Rascunho'}
            </Badge>
          </button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowShareModal(true)}
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            <span>Compartilhar</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saving}
            className="shadow-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            <span>Salvar</span>
          </Button>
        </div>
      </header>

      {/* Grid com 3 Colunas */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUNA 1: Lista Estruturada de Perguntas */}
        <aside className="w-68 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Etapas ({fields.length})
            </span>
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddMenu((v) => !v)}
                className="h-7 px-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Adicionar</span>
              </Button>

              {showAddMenu && (
                <div className="absolute left-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg p-1.5 z-50 grid gap-0.5 max-h-80 overflow-y-auto">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                    Tipo do Bloco
                  </span>
                  {(Object.keys(FIELD_TYPE_INFO) as FormFieldType[]).map((tipo) => {
                    const info = FIELD_TYPE_INFO[tipo];
                    const Icon = info.icon;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => handleAddField(tipo)}
                        className="w-full p-2 rounded-lg text-left hover:bg-accent flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="p-1.5 rounded-md bg-muted text-foreground">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground">{info.label}</span>
                          <span className="text-caption text-muted-foreground leading-tight">{info.description}</span>
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
                  className={`group p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-ui ${
                    isSelected
                      ? 'bg-secondary text-foreground font-semibold border-border-strong shadow-2xs'
                      : 'border-transparent hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-4 text-center">{idx + 1}</span>
                    <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
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
                      className="p-1 hover:text-foreground disabled:opacity-20 transition-colors"
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
                      className="p-1 hover:text-foreground disabled:opacity-20 transition-colors"
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
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
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

        {/* COLUNA 2: Canvas com Moldura macOS / Mobile */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden bg-background">
          {previewDevice === 'desktop' ? (
            /* Moldura Janela macOS */
            <div className="w-full max-w-4xl h-full flex flex-col rounded-2xl shadow-sm overflow-hidden border border-border bg-card transition-ui">
              <div className="h-9 bg-muted/50 border-b border-border px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
                  <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
                  <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
                </div>
                <div className="max-w-xs w-full h-5 rounded-md bg-card border border-border flex items-center justify-center px-3 gap-1.5 text-caption text-muted-foreground font-mono">
                  <span>🔒</span>
                  <span className="truncate">gensbot.com/f/{form.slug}</span>
                </div>
                <div className="w-8" />
              </div>
              <div className="flex-1 overflow-y-auto" style={{ backgroundColor: form.tema_config?.cor_fundo || '#ffffff' }}>
                <FormPlayer form={previewForm} isPreview={true} />
              </div>
            </div>
          ) : (
            /* Moldura Celular */
            <div className="w-[360px] max-h-[700px] h-full flex flex-col rounded-2xl p-2 bg-card shadow-sm border border-border shrink-0 transition-ui">
              <div className="h-6 flex items-center justify-center shrink-0">
                <div className="w-16 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <div
                className="flex-1 rounded-xl overflow-hidden flex flex-col border border-border"
                style={{ backgroundColor: form.tema_config?.cor_fundo || '#ffffff' }}
              >
                <FormPlayer form={previewForm} isPreview={true} />
              </div>
            </div>
          )}
        </main>

        {/* COLUNA 3: Inspetor de Propriedades */}
        <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
          <div className="h-12 border-b border-border flex items-center justify-around px-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('pergunta')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-ui cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'pergunta'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pergunta</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tema')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-ui cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'tema'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Tema</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ajustes')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-ui cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'ajustes'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Tipo do Bloco
                  </label>
                  <div className="p-2.5 rounded-xl border border-border bg-accent/40 flex items-center gap-2">
                    {React.createElement(FIELD_TYPE_INFO[selectedField.tipo]?.icon || Type, {
                      className: 'w-4 h-4 text-foreground',
                    })}
                    <span className="text-xs font-semibold text-foreground">
                      {FIELD_TYPE_INFO[selectedField.tipo]?.label || selectedField.tipo}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Título / Pergunta *
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.label}
                    onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                    className={fieldInputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Descrição ou Subtítulo (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.descricao || ''}
                    onChange={(e) => handleUpdateSelectedField({ descricao: e.target.value || null })}
                    placeholder="Instrução adicional de apoio ao respondente..."
                    className={fieldInputClass}
                  />
                </div>

                {['text', 'whatsapp', 'email', 'textarea'].includes(selectedField.tipo) && (
                  <div>
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Placeholder
                    </label>
                    <Input
                      type="text"
                      value={selectedField.placeholder || ''}
                      onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value || null })}
                      placeholder="Ex: Digite sua resposta..."
                    />
                  </div>
                )}

                {selectedField.tipo !== 'welcome' && selectedField.tipo !== 'thank_you' && (
                  <div className="pt-2 border-t border-border">
                    <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                      <Checkbox checked={selectedField.obrigatorio} onCheckedChange={(checked) => handleUpdateSelectedField({ obrigatorio: checked })} />
                      <span>Resposta obrigatória</span>
                    </label>
                  </div>
                )}

                {/* Opções de Múltipla Escolha */}
                {selectedField.tipo === 'choice' && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block">
                      Opções de Resposta
                    </label>
                    <div className="space-y-1.5">
                      {(selectedField.opcoes || []).map((opt, i) => (
                        <div key={opt.id} className="flex items-center gap-1.5">
                          <span className="w-5 text-xs font-mono font-bold text-muted-foreground text-center">
                            {LETRAS_OPCOES[i] || i + 1}
                          </span>
                          <Input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(selectedField.opcoes || [])];
                              newOpts[i] = { ...newOpts[i], label: e.target.value };
                              handleUpdateSelectedField({ opcoes: newOpts });
                            }}
                            className="flex-1 h-8 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = (selectedField.opcoes || []).filter((_, idx) => idx !== i);
                              handleUpdateSelectedField({ opcoes: newOpts });
                            }}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOpts = [
                          ...(selectedField.opcoes || []),
                          { id: crypto.randomUUID(), label: `Nova Opção` },
                        ];
                        handleUpdateSelectedField({ opcoes: newOpts });
                      }}
                      className="w-full mt-1 text-xs"
                    >
                      + Adicionar Opção
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: TEMA & PALETAS */}
            {activeTab === 'tema' && (
              <div className="space-y-5">
                {/* Seletor de Modo de Contraste */}
                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Modo de Exibição
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tema_config: { ...form.tema_config, modo: 'auto' },
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-ui cursor-pointer ${
                        !form.tema_config?.modo || form.tema_config.modo === 'auto'
                          ? 'bg-card text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tema_config: { ...form.tema_config, modo: 'light' },
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-ui cursor-pointer ${
                        form.tema_config?.modo === 'light'
                          ? 'bg-card text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      <span>Claro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tema_config: { ...form.tema_config, modo: 'dark' },
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-ui cursor-pointer ${
                        form.tema_config?.modo === 'dark'
                          ? 'bg-card text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      <span>Escuro</span>
                    </button>
                  </div>
                  <span className="text-caption text-muted-foreground mt-1 block">
                    {!form.tema_config?.modo || form.tema_config.modo === 'auto'
                      ? 'Calcula contraste WCAG automaticamente pela cor de fundo.'
                      : form.tema_config.modo === 'light'
                      ? 'Força interface clara para este formulário.'
                      : 'Força interface escura para este formulário.'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-2">
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
                        className="p-2.5 rounded-xl border border-border hover:border-border-strong hover:bg-accent/40 flex items-center justify-between cursor-pointer transition-ui"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3.5 h-3.5 rounded-full ${preset.badge}`} />
                          <span className="text-xs font-semibold text-foreground">
                            {preset.nome}
                          </span>
                        </div>
                        <span className="text-caption text-muted-foreground font-mono">{preset.config.cor_primaria}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-3">
                  <div>
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Cor Primária (Acento & Botão)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.tema_config?.cor_primaria || '#d8ff3c'}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_primaria: e.target.value },
                          })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                      />
                      <Input
                        type="text"
                        value={form.tema_config?.cor_primaria || '#d8ff3c'}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_primaria: e.target.value },
                          })
                        }
                        className="flex-1 h-8 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Cor de Fundo
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.tema_config?.cor_fundo || '#09090b'}
                        onChange={(e) => {
                          const newBg = e.target.value;
                          const autoTextColor = ensureAccessibleTextColor(form.tema_config?.cor_texto, newBg);
                          setForm({
                            ...form,
                            tema_config: {
                              ...form.tema_config,
                              cor_fundo: newBg,
                              cor_texto: autoTextColor,
                            },
                          });
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                      />
                      <Input
                        type="text"
                        value={form.tema_config?.cor_fundo || '#09090b'}
                        onChange={(e) => {
                          const newBg = e.target.value;
                          const autoTextColor = ensureAccessibleTextColor(form.tema_config?.cor_texto, newBg);
                          setForm({
                            ...form,
                            tema_config: {
                              ...form.tema_config,
                              cor_fundo: newBg,
                              cor_texto: autoTextColor,
                            },
                          });
                        }}
                        className="flex-1 h-8 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Cor do Texto Principal
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.tema_config?.cor_texto || (isColorDark(form.tema_config?.cor_fundo || '#09090b') ? '#f4f4f5' : '#192313')}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_texto: e.target.value },
                          })
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                      />
                      <Input
                        type="text"
                        value={form.tema_config?.cor_texto || (isColorDark(form.tema_config?.cor_fundo || '#09090b') ? '#f4f4f5' : '#192313')}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tema_config: { ...form.tema_config, cor_texto: e.target.value },
                          })
                        }
                        className="flex-1 h-8 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Logo do Cliente (URL)
                    </label>
                    <Input
                      type="url"
                      value={form.tema_config?.logo_url || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tema_config: { ...form.tema_config, logo_url: e.target.value },
                        })
                      }
                      placeholder="https://exemplo.com/logo.png"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: AJUSTES & NOTIFICAÇÕES */}
            {activeTab === 'ajustes' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Slug do Link
                  </label>
                  <div className="flex items-center gap-1 text-xs border border-input rounded-xl p-2 bg-card">
                    <span className="text-muted-foreground">/f/</span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      className="flex-1 bg-transparent font-medium text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Cliente Vinculado
                  </label>
                  <Select
                    value={form.cliente_id || ''}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value || null })}
                  >
                    <option value="">Nenhum (Uso Geral da Agência)</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    WhatsApp para Alerta de Novo Lead
                  </label>
                  <Input
                    type="tel"
                    value={form.notificacao_whatsapp_numero || ''}
                    onChange={(e) => setForm({ ...form, notificacao_whatsapp_numero: e.target.value })}
                    placeholder="11999999999 (com DDD)"
                  />
                  <span className="text-caption text-muted-foreground mt-1 block">
                    Número que receberá o botão de contato direto no final.
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal de Compartilhamento com DialogShell */}
      <DialogShell
        open={showShareModal}
        onRequestClose={() => setShowShareModal(false)}
        aria-label="Compartilhar Formulário"
        className="max-w-md w-full"
      >
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="font-display text-base font-bold text-foreground">Compartilhar Formulário</h3>
          <button
            type="button"
            onClick={() => setShowShareModal(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-label font-medium text-foreground block">Link Direto</label>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-muted border border-border">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 bg-transparent text-xs font-mono text-foreground focus:outline-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-brand-text mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="text-label font-medium text-foreground block">Incorporar em Site (Iframe)</label>
            <textarea
              readOnly
              rows={2}
              value={`<iframe src="${publicUrl}" width="100%" height="650" frameborder="0"></iframe>`}
              className="w-full text-caption font-mono p-2.5 rounded-xl bg-muted border border-border text-foreground resize-none focus:outline-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center shrink-0">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-foreground hover:underline flex items-center gap-1"
          >
            <span>Abrir formulário</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowShareModal(false)}
          >
            Concluir
          </Button>
        </div>
      </DialogShell>
    </div>
  );
}
