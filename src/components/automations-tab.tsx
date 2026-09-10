'use client';

import React from 'react';
import nextDynamicImport from 'next/dynamic';
import {
  Plus,
  ExternalLink,
  MessageCircle,
  Send,
  Camera,
  AtSign,
  ChevronLeft,
  Users,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import AutomationTable from '@/components/automation-table';
import { TailEditor } from '@/components/automation-wizard/tail-editor';
import { ConditionPanel } from '@/components/flow-builder/panels';
import type { ConditionNodeConfig } from '@/types/flow';
import type { Automation } from '@/types/automation';
import type { QualificationStep, WizardCondition, WizardTail } from '@/lib/flow-engine/wizardCompiler';
import { Instagram } from '@/components/instagram-icon';
import type { IgMedia, IgStory } from '@/types/instagram-media';

const FlowBuilder = nextDynamicImport(() => import('@/components/flow-builder/FlowBuilder'), { ssr: false });

interface AutomationsTabProps {
  isAggregateView: boolean;
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  resetForm: () => void;
  handleEditAutomation: (a: Automation) => void;
  handleDeleteAutomation: (id: string) => void;
  flowBuilderAutomation: Automation | null;
  setFlowBuilderAutomation: React.Dispatch<React.SetStateAction<Automation | null>>;
  form: Automation;
  setForm: React.Dispatch<React.SetStateAction<Automation>>;
  handleSaveAutomation: (e: React.FormEvent) => void;
  wizardIncompatibleReason: string | null;
  keywordInput: string;
  handleKeywordsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLoadMedia: () => void;
  mediaList: IgMedia[];
  handleLoadStories: () => void;
  loadingStories: boolean;
  storyList: IgStory[];
  publicReplyInput: string;
  setPublicReplyInput: (v: string) => void;
  handleAddPublicReply: () => void;
  handleRemovePublicReply: (index: number) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  qualificationSteps: QualificationStep[];
  setQualificationSteps: React.Dispatch<React.SetStateAction<QualificationStep[]>>;
  pendingConditionSplitIndex: number;
  setPendingConditionSplitIndex: (v: number) => void;
  addCondition: (splitIndex: number) => void;
  removeCondition: () => void;
  wizardCondition: WizardCondition | null;
  setWizardCondition: React.Dispatch<React.SetStateAction<WizardCondition | null>>;
  activeBranchTab: 'true' | 'false';
  setActiveBranchTab: (v: 'true' | 'false') => void;
  legacyTail: WizardTail;
  handleLegacyTailChange: (updater: (prev: WizardTail) => WizardTail) => void;
  utmLinks: any[];
  selectedUtmLinkId: string;
  handleSelectUtmLink: (id: string) => void;
  handleGenerateTrackedLink: () => void;
  generatingTrackedLink: boolean;
  config: any;
  showMediaModal: boolean;
  setShowMediaModal: (v: boolean) => void;
  mediaFilter: 'all' | 'video' | 'carousel' | 'image';
  setMediaFilter: React.Dispatch<React.SetStateAction<'all' | 'video' | 'carousel' | 'image'>>;
  showStoryModal: boolean;
  setShowStoryModal: (v: boolean) => void;
}

/** Aba "Automações" — extraída de src/app/page.tsx (passo 3, o mais arriscado,
 * da quebra do monólito em componentes por aba, ver DESIGN.md §6). Corta-e-cola
 * literal (lista + wizard do Formulário Avançado + preview do Direct + modais
 * de seleção de post/story), sem mudança de comportamento — toda a lógica de
 * estado/salvamento continua em src/app/page.tsx, passada aqui via prop. */
export default function AutomationsTab(props: AutomationsTabProps) {
  const {
    isAggregateView, automations, setAutomations, isEditing, setIsEditing, resetForm,
    handleEditAutomation, handleDeleteAutomation, flowBuilderAutomation, setFlowBuilderAutomation,
    form, setForm, handleSaveAutomation, wizardIncompatibleReason, keywordInput, handleKeywordsChange,
    handleLoadMedia, mediaList, handleLoadStories, loadingStories, storyList, publicReplyInput,
    setPublicReplyInput, handleAddPublicReply, handleRemovePublicReply, showToast, qualificationSteps,
    setQualificationSteps, pendingConditionSplitIndex, setPendingConditionSplitIndex, addCondition,
    removeCondition, wizardCondition, setWizardCondition, activeBranchTab, setActiveBranchTab,
    legacyTail, handleLegacyTailChange, utmLinks, selectedUtmLinkId, handleSelectUtmLink,
    handleGenerateTrackedLink, generatingTrackedLink, config, showMediaModal, setShowMediaModal,
    mediaFilter, setMediaFilter, showStoryModal, setShowStoryModal,
  } = props;

  return (
    <>
          {isAggregateView ? (
            <Card padding="lg" className="rounded-2xl p-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-bold text-foreground">Selecione uma conta específica</p>
              <p className="text-xs text-muted-foreground mt-1">Automações são criadas e editadas por conta. Escolha uma no seletor da sidebar pra gerenciar.</p>
            </Card>
          ) : (
            <div className="w-full">
              {!isEditing ? (
                /* Screen 1: List of Automations (Full Width) */
                <div className="flex flex-col gap-6 max-w-6xl mx-auto animate-fade-in">
                  <div className="flex items-center justify-between border-b border-accent pb-5">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Minhas Automações</h3>
                      <p className="text-xs text-muted-foreground mt-1">Gerencie, crie e ative seus fluxos de resposta direta e reativa.</p>
                    </div>
                    <Button
                      onClick={() => {
                        resetForm();
                        setIsEditing(true);
                      }}
                      className="rounded-full shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      Criar Novo Fluxo
                    </Button>
                  </div>

                  <AutomationTable
                    automations={automations}
                    onEdit={handleEditAutomation}
                    onDelete={handleDeleteAutomation}
                    onCreate={() => {
                      resetForm();
                      setIsEditing(true);
                    }}
                    onOpenFlowBuilder={setFlowBuilderAutomation}
                  />

                  {flowBuilderAutomation && (
                    <FlowBuilder
                      automation={flowBuilderAutomation}
                      onClose={() => setFlowBuilderAutomation(null)}
                      onSaved={(updated) => {
                        setAutomations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                        setFlowBuilderAutomation(null);
                      }}
                    />
                  )}

                </div>
              ) : (
                /* Screen 2: Visual Flow Editor Screen (Full Width with iPhone Preview Mockup) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in max-w-7xl mx-auto">
                  
                  {/* Left Column: Flow Builder Editor Form */}
                  <div className="lg:col-span-8">
                    <form onSubmit={handleSaveAutomation} className="flex flex-col gap-6">

                      {wizardIncompatibleReason && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex flex-col gap-2">
                          <p className="text-xs font-bold text-destructive">Esta automação só pode ser editada pelo Canvas</p>
                          <p className="text-[11px] text-muted-foreground">
                            {wizardIncompatibleReason} Os campos abaixo mostram o estado anterior à edição e não refletem o fluxo real — salvar por aqui está bloqueado pra não substituir o que já existe por uma versão simplificada.
                          </p>
                          {form.id && (
                            <button
                              type="button"
                              onClick={() => setFlowBuilderAutomation(form)}
                              className="self-start flex items-center gap-1.5 bg-destructive/90 hover:bg-destructive text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Abrir no editor visual (Canvas)
                            </button>
                          )}
                        </div>
                      )}

                      {/* Header of Flow Editor */}
                      <div className="bg-card border border-accent rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nome do Fluxo (ex: Capturar Leads)"
                            className="font-extrabold text-foreground text-lg focus:outline-none border-b border-border focus:border-primary pb-1 w-full max-w-sm transition-all bg-transparent"
                          />
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1.5">Configuração do Sequenciamento</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 flex-shrink-0 w-full md:w-auto">
                          {/* Active toggle */}
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.active}
                              onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-foreground after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-foreground after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
                            <span className="text-xs font-bold text-muted-foreground">{form.active ? 'Ativo' : 'Pausado'}</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full hover:bg-accent border border-border transition-all cursor-pointer animate-fade-in"
                          >
                            Voltar
                          </button>

                          <button
                            type="submit"
                            disabled={!!wizardIncompatibleReason}
                            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Salvar Fluxo
                          </button>
                        </div>
                      </div>


                    {/* VERTICAL FLOW STEP CARDS CONTAINER */}
                    <div className="flex flex-col gap-6 relative pl-9 before:content-[''] before:absolute before:left-[17px] before:top-4 before:bottom-4 before:w-[2px] before:bg-border">
                      {/* Step 1: Gatilho / Trigger Card */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          1
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Configuração de Gatilhos de Entrada</h4>
                        </div>

                        {/* Fontes do Gatilho */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-muted-foreground">Fontes do Gatilho (Selecione um ou mais)</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { id: 'comment', label: 'Comentários em Posts', icon: MessageCircle },
                              { id: 'dm', label: 'Mensagens Diretas', icon: Send },
                              { id: 'story', label: 'Respostas aos Stories', icon: Camera },
                              { id: 'story_mention', label: 'Menção nos Stories', icon: AtSign },
                            ].map(trigger => {
                              const active = form.triggers.includes(trigger.id);
                              const Icon = trigger.icon;
                              return (
                                <button
                                  type="button"
                                  key={trigger.id}
                                  onClick={() => {
                                    const nextTriggers = form.triggers.includes(trigger.id)
                                      ? form.triggers.filter(t => t !== trigger.id)
                                      : [...form.triggers, trigger.id];
                                    if (nextTriggers.length > 0) {
                                      setForm(prev => ({ ...prev, triggers: nextTriggers }));
                                    }
                                    // Ao ativar "Respostas aos Stories", já abre o seletor de
                                    // stories ativos pra vincular a automação a um específico
                                    // (diferente de "Menção", que é story de outra pessoa —
                                    // não existe "qual story meu" nesse caso).
                                    if (trigger.id === 'story' && !active) {
                                      handleLoadStories();
                                    }
                                  }}
                                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                                    active
                                      ? 'bg-primary/10 border-primary text-primary'
                                      : 'bg-card border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <Icon className="w-5 h-5" />
                                  <span className="text-xs font-bold leading-tight">{trigger.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Palavras-chave (Separadas por vírgula)</label>
                            <input
                              type="text"
                              required
                              placeholder="ex: quero, cupom, info"
                              value={keywordInput}
                              onChange={handleKeywordsChange}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Tipo de Correspondência (Match Type)</label>
                            <select
                              value={form.match_type}
                              onChange={e => setForm(prev => ({ ...prev, match_type: e.target.value as any }))}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground font-semibold cursor-pointer transition-all"
                            >
                              <option value="contains">Contém a palavra-chave</option>
                              <option value="exact">Exato (Palavra-chave exata)</option>
                              <option value="any">Qualquer comentário (Ignora palavra-chave)</option>
                            </select>
                          </div>
                        </div>

                        {/* Post target selector */}
                        <div className="flex flex-col gap-1.5 pt-1">
                          <label className="text-xs font-bold text-muted-foreground">Publicação Alvo (Opcional)</label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleLoadMedia}
                              className="px-4 py-2.5 rounded-xl border border-border bg-accent hover:bg-muted text-foreground text-xs font-bold cursor-pointer transition-all flex items-center gap-2"
                            >
                              {form.specific_post_id ? 'Trocar Publicação Selecionada' : 'Selecionar Post Específico'}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            {form.specific_post_id && (() => {
                              const selectedMedia = mediaList.find(m => m.id === form.specific_post_id);
                              return (
                                <div className="flex items-center gap-3 bg-accent border border-border rounded-xl p-2 animate-fade-in text-foreground">
                                  {selectedMedia && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden relative border border-border flex-shrink-0">
                                      <img
                                        src={selectedMedia.thumbnail_url || selectedMedia.media_url}
                                        alt="Selected Post"
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold text-muted-foreground font-mono truncate max-w-[150px]">
                                      ID: {form.specific_post_id}
                                    </span>
                                    {selectedMedia?.caption && (
                                      <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">
                                        {selectedMedia.caption}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, specific_post_id: null }))}
                                    className="text-xs text-muted-foreground hover:text-destructive font-bold ml-2 cursor-pointer"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Story target selector — só faz sentido pro gatilho "Respostas
                            aos Stories", já que aí existe um story SEU específico pra
                            restringir. Ao contrário de posts, a API só devolve stories
                            ativas nas últimas 24h. */}
                        {form.triggers.includes('story') && (
                          <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-xs font-bold text-muted-foreground">Story Alvo</label>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, specific_story_id: null }))}
                                className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                  !form.specific_story_id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-accent text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                Todos os Stories
                              </button>
                              <button
                                type="button"
                                onClick={handleLoadStories}
                                disabled={loadingStories}
                                className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-wait ${
                                  form.specific_story_id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-accent text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                {loadingStories ? 'Carregando...' : 'Story Específico'}
                              </button>
                            </div>

                            {form.specific_story_id && (() => {
                              const selectedStory = storyList.find(s => s.id === form.specific_story_id);
                              return (
                                <div className="flex items-center gap-3 bg-accent border border-border rounded-xl p-2 animate-fade-in text-foreground">
                                  {selectedStory && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden relative border border-border flex-shrink-0">
                                      <img
                                        src={selectedStory.thumbnail_url || selectedStory.media_url}
                                        alt="Story selecionado"
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <span className="text-[10px] font-bold text-muted-foreground font-mono truncate max-w-[150px]">
                                    ID: {form.specific_story_id}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleLoadStories}
                                    className="text-xs text-primary hover:text-primary/90 font-bold ml-auto cursor-pointer"
                                  >
                                    Trocar
                                  </button>
                                </div>
                              );
                            })()}

                            <p className="text-[10px] text-muted-foreground">
                              {form.specific_story_id
                                ? 'A API só lista pra escolher as stories publicadas nas últimas 24h.'
                                : 'Responde a respostas de qualquer story seu — hoje e nos próximos dias, sem precisar trocar a seleção a cada story novo.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Resposta Pública Card */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          2
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Resposta Automática no Post (Comentário público)</h4>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-muted-foreground">Escreva uma frase de resposta e clique em Adicionar</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="ex: Te chamei no direct! Dá uma olhada lá."
                              value={publicReplyInput}
                              onChange={e => setPublicReplyInput(e.target.value)}
                              className="flex-1 bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground"
                            />
                            <button
                              type="button"
                              onClick={handleAddPublicReply}
                              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
                            >
                              Adicionar
                            </button>
                          </div>
                          {/* Sugestões de Respostas Rápidas */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[
                              "Te chamei no direct! Dá uma olhada lá.",
                              "Link enviado na sua DM! 🚀",
                              "Acabei de enviar no seu direct, confere lá!",
                              "Oi! Dá uma olhadinha nas suas mensagens.",
                              "Já mandei no seu privado! 😉"
                            ].map((preset, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (!form.public_replies.includes(preset)) {
                                    setForm(prev => ({ ...prev, public_replies: [...prev.public_replies, preset] }));
                                    showToast('Resposta rápida adicionada!', 'success');
                                  } else {
                                    showToast('Essa resposta já foi adicionada!', 'error');
                                  }
                                }}
                                className="text-[10px] bg-accent text-muted-foreground hover:bg-border hover:text-foreground px-3 py-1.5 rounded-full border border-border transition-colors cursor-pointer select-none"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* List of responses */}
                        {form.public_replies.length > 0 && (
                          <div className="flex flex-col gap-2 bg-accent/50 p-3.5 rounded-xl border border-border max-h-[160px] overflow-y-auto">
                            {form.public_replies.map((reply, index) => (
                              <div key={index} className="flex items-center justify-between gap-3 text-xs bg-accent py-2 px-3.5 rounded-xl border border-border shadow-xs animate-fade-in text-foreground">
                                <span className="truncate font-semibold">{reply}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePublicReply(index)}
                                  className="text-muted-foreground hover:text-destructive font-bold flex-shrink-0 cursor-pointer text-[10px]"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Step 3: Mensagem DM com Quick Reply Card */}
                      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
                          3
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground text-sm">Mensagem Privada Inicial (DM no Direct)</h4>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Conteúdo do primeiro Direct</label>
                            <textarea
                              required
                              placeholder="Olá! Vi seu interesse no post. Para receber o seu link de acesso, clique no botão de resposta rápida abaixo:"
                              value={form.welcome_dm}
                              onChange={e => setForm(prev => ({ ...prev, welcome_dm: e.target.value }))}
                              rows={3}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, welcome_dm: `{{primeiro_nome}}, ${prev.welcome_dm}` }))}
                                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                              >
                                + Inserir nome do lead no início
                              </button>
                              <p className="text-[10px] text-muted-foreground">
                                (<code className="bg-accent px-1 rounded">{'{{primeiro_nome}}'}</code> funciona em qualquer parte do texto)
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground">Texto do Botão de Resposta Rápida (Máx 20 caracteres)</label>
                            <input
                              type="text"
                              maxLength={20}
                              placeholder="Ex: Sim, quero!"
                              value={form.quick_reply_button || ''}
                              onChange={e => setForm(prev => ({ ...prev, quick_reply_button: e.target.value || null }))}
                              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all font-semibold"
                            />
                          </div>

                          {form.quick_reply_button && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-muted-foreground">Esperar clique por (min, opcional)</label>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="Sem prazo, sem lembrete"
                                  value={form.welcome_dm_timeout_minutes ?? ''}
                                  onChange={e => setForm(prev => ({ ...prev, welcome_dm_timeout_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                                  className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-muted-foreground">Lembrete se não clicar (opcional)</label>
                                <input
                                  type="text"
                                  placeholder="Padrão automático se vazio"
                                  value={form.welcome_dm_reminder_text || ''}
                                  onChange={e => setForm(prev => ({ ...prev, welcome_dm_reminder_text: e.target.value || null }))}
                                  className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                                />
                              </div>
                              <p className="text-[9px] text-muted-foreground col-span-2 -mt-1">
                                Deixe o tempo em branco pra esperar o clique sem prazo (sem mandar lembrete).
                              </p>
                            </div>
                          )}

                          {/* Lead Capture Options */}
                          <div className="border-t border-border pt-4 mt-2 flex flex-col gap-3">
                            <span className="text-xs font-bold text-foreground">Captura de Leads & Integração (Opcional)</span>
                            <div className="grid grid-cols-2 gap-4">
                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.ask_email || false}
                                  onChange={e => setForm(prev => ({ ...prev, ask_email: e.target.checked }))}
                                  className="rounded border-border bg-accent text-primary focus:ring-primary/20 w-4 h-4"
                                />
                                <span className="text-xs text-muted-foreground font-semibold">Solicitar E-mail</span>
                              </label>

                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={form.ask_phone || false}
                                  onChange={e => setForm(prev => ({ ...prev, ask_phone: e.target.checked }))}
                                  className="rounded border-border bg-accent text-primary focus:ring-primary/20 w-4 h-4"
                                />
                                <span className="text-xs text-muted-foreground font-semibold">Solicitar Telefone</span>
                              </label>
                            </div>

                            {(form.ask_email || form.ask_phone) && (
                              <div className="flex flex-col gap-1.5 animate-fade-in mt-1">
                                <label className="text-[11px] font-bold text-muted-foreground">URL do Webhook Externo (POST para Make/Zapier)</label>
                                <input
                                  type="url"
                                  placeholder="https://hook.us1.make.com/..."
                                  value={form.webhook_url || ''}
                                  onChange={e => setForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                                  className="bg-accent border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-4 py-2 text-xs focus:outline-none text-foreground placeholder-muted-foreground font-mono"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Conditional Connector Dotted Line */}
                      <div className="relative my-1.5 z-10 pointer-events-none select-none">
                        <span className="text-[9px] font-extrabold text-primary bg-accent border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-wider shadow-2xs absolute left-[-26px] translate-x-[-12%] top-[-8px] whitespace-nowrap animate-fade-in">
                          Click
                        </span>
                      </div>

                      {/* Steps 4-6: Perguntas + Link + Follow-ups — sem condição é uma única
                          cauda (TailEditor); com condição, as perguntas antes do split ficam
                          aqui e o resto vira dois ramos independentes logo abaixo. */}
                      {!wizardCondition ? (
                        <>
                          <div className="bg-card border border-dashed border-primary/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <span className="text-xs font-bold text-foreground flex-1">
                              Quer ramificar o fluxo aqui (se/senão)? Escolha depois de qual pergunta a condição entra.
                            </span>
                            <select
                              value={Math.min(pendingConditionSplitIndex, qualificationSteps.length)}
                              onChange={e => setPendingConditionSplitIndex(parseInt(e.target.value))}
                              className="bg-accent border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground"
                            >
                              <option value={0}>Logo no início (antes de qualquer pergunta)</option>
                              {qualificationSteps.map((_, i) => (
                                <option key={i} value={i + 1}>Depois da pergunta {i + 1}</option>
                              ))}
                            </select>
                            <Button type="button" variant="secondary" onClick={() => addCondition(Math.min(pendingConditionSplitIndex, qualificationSteps.length))}>
                              Adicionar condição
                            </Button>
                          </div>
                          <TailEditor
                            tail={legacyTail}
                            onChange={handleLegacyTailChange}
                            showToast={showToast}
                            utmLinkPicker={{
                              utmLinks,
                              selectedUtmLinkId,
                              onSelectUtmLink: handleSelectUtmLink,
                              onGenerateTrackedLink: handleGenerateTrackedLink,
                              generatingTrackedLink,
                              automationId: form.id,
                            }}
                          />
                        </>
                      ) : (
                        <>
                          {qualificationSteps.length > 0 && (
                            <TailEditor
                              tail={{ questions: qualificationSteps, link_text: '', link_url: null, link_button_label: null, followups: [] }}
                              onChange={updater => setQualificationSteps(updater({ questions: qualificationSteps, link_text: '', link_url: null, link_button_label: null, followups: [] }).questions)}
                              showToast={showToast}
                              sections={['questions']}
                              title="Antes da condição"
                            />
                          )}

                          <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 text-foreground">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-foreground text-sm">Condição (Se / Senão)</h4>
                              <button type="button" onClick={removeCondition} className="text-xs font-bold text-destructive hover:underline cursor-pointer">
                                Remover condição
                              </button>
                            </div>
                            <ConditionPanel
                              data={wizardCondition.condition}
                              onChange={(d: ConditionNodeConfig) => setWizardCondition(prev => prev && { ...prev, condition: d })}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button type="button" variant={activeBranchTab === 'true' ? 'primary' : 'secondary'} onClick={() => setActiveBranchTab('true')}>
                              Se verdadeiro
                            </Button>
                            <Button type="button" variant={activeBranchTab === 'false' ? 'primary' : 'secondary'} onClick={() => setActiveBranchTab('false')}>
                              Se falso
                            </Button>
                          </div>

                          {activeBranchTab === 'true' ? (
                            <TailEditor
                              tail={wizardCondition.trueBranch}
                              onChange={updater => setWizardCondition(prev => prev && { ...prev, trueBranch: updater(prev.trueBranch) })}
                              showToast={showToast}
                              title="Ramo Verdadeiro"
                            />
                          ) : (
                            <TailEditor
                              tail={wizardCondition.falseBranch}
                              onChange={updater => setWizardCondition(prev => prev && { ...prev, falseBranch: updater(prev.falseBranch) })}
                              showToast={showToast}
                              title="Ramo Falso"
                            />
                          )}
                        </>
                      )}
                    </div>
                    </form>
                  </div>

                  {/* Right Column: Phone Simulator Mockup */}
                  <div className="lg:col-span-4 sticky top-6 flex flex-col items-center gap-3">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest bg-card border border-accent px-3 py-1.5 rounded-full shadow-xs">
                      Visualização em Tempo Real (Direct)
                    </span>

                    <div className="w-[300px] h-[600px] border-[10px] border-border rounded-[48px] bg-black shadow-2xl relative flex flex-col overflow-hidden select-none">
                      {/* iPhone top notch */}
                      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-border rounded-full z-20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-card ml-8 border border-accent"></div>
                      </div>

                      {/* Status Bar */}
                      <div className="flex justify-between items-center px-6 pt-3.5 pb-1 text-[9px] font-bold text-[#262626] bg-white z-10">
                        <span>09:41</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[7px]">5G</span>
                          <div className="w-4 h-2 border border-[#262626]/60 rounded-[3px] p-[1px] flex items-center">
                            <div className="w-full h-full bg-[#262626] rounded-[1px]"></div>
                          </div>
                        </div>
                      </div>

                      {/* A partir daqui simula o Direct de verdade — cores fixas
                          (não os tokens de tema do GENSBot), porque o objetivo é
                          fidelidade ao Instagram, não à identidade visual do app. */}

                      {/* Direct Chat Header */}
                      <div className="flex items-center gap-2 border-b border-[#dbdbdb] bg-white px-3 py-2.5">
                        <ChevronLeft className="w-5 h-5 text-[#262626] flex-shrink-0" />
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[1.5px] flex-shrink-0">
                          <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                            <Instagram className="w-4 h-4 text-[#262626]" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[11px] font-bold text-[#262626] leading-none truncate">
                            {config?.instagram_username || 'seu_perfil'}
                          </p>
                          <p className="text-[9px] text-[#8e8e8e] mt-1 leading-none">Ativo agora</p>
                        </div>
                        <Camera className="w-4.5 h-4.5 text-[#262626] flex-shrink-0" />
                      </div>

                      {/* Chat Message Thread Body */}
                      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col bg-white scrollbar-none">
                        <span className="text-[9px] text-[#8e8e8e] text-center font-semibold mb-2">Hoje 14:41</span>

                        {/* 1. Contexto de gatilho (post) — como o Instagram mostra
                            "respondeu ao seu post/story" antes da mensagem em si */}
                        {form.specific_post_id && (
                          <>
                            <div className="self-start max-w-[75%] bg-[#efefef] rounded-2xl rounded-bl-md overflow-hidden flex items-center gap-2 p-1.5 pr-3 mb-0.5">
                              <div className="w-7 h-7 rounded-lg bg-[#dbdbdb] flex-shrink-0"></div>
                              <span className="text-[9px] text-[#262626] font-medium">Respondeu ao seu post</span>
                            </div>
                            <div className="self-start max-w-[75%] bg-[#efefef] text-[#262626] text-[12px] px-3 py-2 rounded-2xl rounded-bl-md leading-snug mb-2">
                              {keywordInput.split(',')[0]?.trim() || 'quero'}
                            </div>
                          </>
                        )}

                        {/* 2. Resposta automática — sai da conta (direita, gradiente) */}
                        {form.welcome_dm && (
                          <>
                            <div className="self-end flex gap-1 items-center bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] rounded-2xl rounded-br-md px-3 py-2.5 mb-0.5 w-fit opacity-70">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <div className="self-end max-w-[75%] bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md leading-snug mb-2">
                              {form.welcome_dm}
                            </div>
                          </>
                        )}

                        {/* 3. Captura de e-mail/telefone */}
                        {form.ask_email && (
                          <>
                            <div className="self-end max-w-[75%] bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md leading-snug mb-2">
                              Por favor, digite seu e-mail para receber o acesso:
                            </div>
                            <div className="self-start max-w-[75%] bg-[#efefef] text-[#262626] text-[12px] px-3 py-2 rounded-2xl rounded-bl-md leading-snug mb-2">
                              exemplo@email.com
                            </div>
                          </>
                        )}
                        {form.ask_phone && (
                          <>
                            <div className="self-end max-w-[75%] bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md leading-snug mb-2">
                              Por favor, informe seu WhatsApp com DDD:
                            </div>
                            <div className="self-start max-w-[75%] bg-[#efefef] text-[#262626] text-[12px] px-3 py-2 rounded-2xl rounded-bl-md leading-snug mb-2">
                              (11) 99999-9999
                            </div>
                          </>
                        )}

                        {/* 4. Envio de link */}
                        {form.link_text && (
                          <div className="self-end max-w-[75%] bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md leading-snug mb-2 flex flex-col gap-2">
                            <p>{form.link_text}</p>
                            {form.link_url && (
                              <div className="border-t border-white/25 pt-2 text-center font-bold">
                                {form.link_button_label || 'Acessar Link'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sequência (follow-ups agendados) */}
                        {form.followups && form.followups.map(f => (
                          <div key={f.id} className="self-end max-w-[75%] bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md leading-snug mb-2 flex flex-col gap-2">
                            <p>{f.text}</p>
                            {f.link_url && (
                              <div className="border-t border-white/25 pt-2 text-center font-bold">
                                {f.link_button_label || 'Acessar Link'}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Lembrete */}
                        {form.reminder_text && (
                          <div className="self-end max-w-[75%] bg-gradient-to-br from-[#4f5bd5] to-[#a3348e] text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md leading-snug italic mb-2">
                            {form.reminder_text}
                          </div>
                        )}
                      </div>

                      {/* Quick reply — fixo acima do campo de digitação, como no
                          Instagram real (não solto no meio da conversa) */}
                      {form.quick_reply_button && (
                        <div className="border-t border-[#dbdbdb] bg-white px-3 py-2 flex">
                          <span className="border border-[#dbdbdb] text-[#262626] text-[11px] font-semibold px-3 py-1.5 rounded-full">
                            {form.quick_reply_button}
                          </span>
                        </div>
                      )}

                      {/* Barra de digitação */}
                      <div className="border-t border-[#dbdbdb] bg-white px-3 py-2 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-[#262626] flex-shrink-0" />
                        <div className="flex-1 bg-white border border-[#dbdbdb] rounded-full px-3 py-1.5 text-[11px] text-[#8e8e8e]">
                          Mensagem...
                        </div>
                        <Send className="w-4.5 h-4.5 text-[#3797f0] flex-shrink-0" />
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}


      {/* Visual Post Selector Modal */}
      <Sheet
        open={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        aria-label="Selecionar Post ou Reels"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
            {/* Modal Header */}
            <div className="p-5 border-b border-accent flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-base">Selecionar Post ou Reels</h4>
                <p className="text-xs text-muted-foreground">Escolha a publicação para esta automação.</p>
              </div>
              <button
                onClick={() => setShowMediaModal(false)}
                aria-label="Fechar seleção de publicação"
                className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Tabs */}
            <div className="flex border-b border-accent bg-card px-5 py-3 gap-2 overflow-x-auto select-none scrollbar-none">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'video', label: 'Reels' },
                { id: 'carousel', label: 'Carrossel' },
                { id: 'image', label: 'Post Estático' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMediaFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    mediaFilter === tab.id
                      ? 'bg-accent border border-primary/25 text-primary font-bold'
                      : 'bg-card border border-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal List (Lista 1 por linha com miniatura grande ao lado) */}
            <div className="p-5 overflow-y-auto flex-1 bg-background flex flex-col gap-4">
              {mediaList
                .filter(media => {
                  if (mediaFilter === 'all') return true;
                  if (mediaFilter === 'video') return media.media_type === 'VIDEO';
                  if (mediaFilter === 'carousel') return media.media_type === 'CAROUSEL_ALBUM';
                  if (mediaFilter === 'image') return media.media_type === 'IMAGE';
                  return true;
                })
                .map(media => {
                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        setForm(prev => ({ ...prev, specific_post_id: media.id }));
                        setShowMediaModal(false);
                        showToast('Post selecionado com sucesso!', 'success');
                      }}
                      className="bg-card border border-accent hover:border-primary rounded-2xl p-4 cursor-pointer group transition-all flex flex-row gap-5 items-start shadow-sm hover:shadow-md text-foreground"
                    >
                      {/* Esquerda: Imagem Grande (Capa) */}
                      <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-xl bg-accent relative overflow-hidden flex-shrink-0 border border-border">
                        <img
                          src={media.thumbnail_url || media.media_url}
                          alt="Instagram thumbnail"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute top-2 right-2 bg-background/70 backdrop-blur-md border border-foreground/10 px-2 py-0.5 rounded-lg">
                          <span className="text-[9px] text-primary font-extrabold uppercase tracking-widest">
                            {media.media_type === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : media.media_type === 'VIDEO' ? 'REELS' : 'FOTO'}
                          </span>
                        </div>
                      </div>

                      {/* Direita: Detalhes e Legenda */}
                      <div className="flex-1 flex flex-col gap-2 min-w-0 py-1">
                        <span className="text-[10px] text-muted-foreground font-mono">ID: {media.id}</span>
                        <p className="text-sm text-foreground/90 line-clamp-4 sm:line-clamp-5 leading-relaxed">
                          {media.caption || 'Sem legenda'}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
      </Sheet>

      <Sheet
        open={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        aria-label="Selecionar Story Ativo"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
            {/* Modal Header */}
            <div className="p-5 border-b border-accent flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-base">Selecionar Story Ativo</h4>
                <p className="text-xs text-muted-foreground">Só aparecem stories publicadas nas últimas 24h.</p>
              </div>
              <button
                onClick={() => setShowStoryModal(false)}
                aria-label="Fechar seleção de story"
                className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Grid */}
            <div className="p-5 overflow-y-auto flex-1 bg-background">
              {storyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Nenhuma story ativa agora</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Publique uma story no Instagram e volte aqui — ela some da lista 24h depois de postada.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {storyList.map(story => (
                    <div
                      key={story.id}
                      onClick={() => {
                        setForm(prev => ({ ...prev, specific_story_id: story.id }));
                        setShowStoryModal(false);
                        showToast('Story selecionada com sucesso!', 'success');
                      }}
                      className="bg-card border border-accent hover:border-primary rounded-2xl overflow-hidden cursor-pointer group transition-all shadow-sm hover:shadow-md text-foreground"
                    >
                      <div className="aspect-[9/16] bg-accent relative overflow-hidden border-b border-border">
                        <img
                          src={story.thumbnail_url || story.media_url}
                          alt="Story do Instagram"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                      </div>
                      <div className="px-2.5 py-2">
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(story.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
      </Sheet>

    </>
  );
}
