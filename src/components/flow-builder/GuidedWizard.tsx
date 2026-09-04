'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight, MessageCircle, Send, Camera, AtSign } from 'lucide-react';
import type { Automation } from '@/types/automation';
import type { TriggerNodeConfig } from '@/types/flow';
import { buildFlowFromWizard, type WizardState, type WizardStep } from '@/lib/flow-engine/wizardCompiler';
import { validateFlow, type FlowValidationIssue } from './flowValidation';
import { fieldInputClass as inputCls, fieldLabelClass as labelCls } from '@/lib/form-styles';

interface GuidedWizardProps {
  onClose: () => void;
  onSaved: (automation: Automation) => void;
}

const STEP_LABELS = ['Gatilho', 'Resposta no post', 'Mensagem inicial', 'Perguntas e mensagens', 'Follow-up'];

const TRIGGER_OPTIONS: { id: TriggerNodeConfig['triggerTypes'][number]; label: string; icon: React.ElementType }[] = [
  { id: 'comment', label: 'Comentários em Posts', icon: MessageCircle },
  { id: 'dm', label: 'Mensagens Diretas', icon: Send },
  { id: 'story', label: 'Respostas aos Stories', icon: Camera },
  { id: 'story_mention', label: 'Menção nos Stories', icon: AtSign },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
              i === current
                ? 'bg-primary border-primary text-primary-foreground'
                : i < current
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-card border-border text-muted-foreground'
            }`}
          >
            {i + 1}
          </div>
          {i < STEP_LABELS.length - 1 && <div className="w-6 h-[2px] bg-border" />}
        </div>
      ))}
    </div>
  );
}

export default function GuidedWizard({ onClose, onSaved }: GuidedWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [state, setState] = useState<WizardState>({
    trigger: { triggerTypes: ['comment'], keywords: [], match_type: 'contains' },
    publicReplies: [],
    initialMessage: '',
    steps: [],
    link: { url: '', text: '', buttonLabel: '' },
    followup: null,
  });
  const [issues, setIssues] = useState<FlowValidationIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [publicReplyInput, setPublicReplyInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const isCommentTrigger = state.trigger.triggerTypes.includes('comment');

  const canAdvance =
    stepIndex === 0 ? name.trim().length > 0 && state.trigger.triggerTypes.length > 0 : stepIndex === 2 ? state.initialMessage.trim().length > 0 : true;

  const addStep = (step: WizardStep) => setState((prev) => ({ ...prev, steps: [...prev.steps, step] }));
  const removeStep = (index: number) => setState((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  const updateStep = (index: number, next: WizardStep) =>
    setState((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === index ? next : s)) }));

  const handleSave = async () => {
    const flow = buildFlowFromWizard(state);
    const problems = validateFlow(flow);
    setIssues(problems);
    if (problems.length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          active: true,
          triggers: state.trigger.triggerTypes,
          keywords: state.trigger.keywords,
          match_type: state.trigger.match_type,
          welcome_dm: state.initialMessage,
          flow_definition: flow,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar a automação.');
      onSaved(data);
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao criar a automação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">Assistente Guiado</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Passo {stepIndex + 1} de {STEP_LABELS.length} — {STEP_LABELS[stepIndex]}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <StepDots current={stepIndex} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {stepIndex === 0 && (
            <>
              <Field label="Nome da automação">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Qualificação Dra. Lais" />
              </Field>
              <Field label="Fontes do gatilho (selecione uma ou mais)">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TRIGGER_OPTIONS.map(({ id, label, icon: Icon }) => {
                    const active = state.trigger.triggerTypes.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setState((prev) => {
                            const next = active ? prev.trigger.triggerTypes.filter((t) => t !== id) : [...prev.trigger.triggerTypes, id];
                            return next.length ? { ...prev, trigger: { ...prev.trigger, triggerTypes: next } } : prev;
                          })
                        }
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 text-center transition-all cursor-pointer ${
                          active ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px] font-bold leading-tight">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Palavras-chave (separadas por vírgula)">
                <input
                  className={inputCls}
                  value={keywordInput}
                  onChange={(e) => {
                    setKeywordInput(e.target.value);
                    setState((prev) => ({
                      ...prev,
                      trigger: { ...prev.trigger, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                    }));
                  }}
                  placeholder="ex: quero, cupom, info"
                />
              </Field>
              <Field label="Tipo de correspondência">
                <select
                  className={inputCls}
                  value={state.trigger.match_type}
                  onChange={(e) => setState((prev) => ({ ...prev, trigger: { ...prev.trigger, match_type: e.target.value as any } }))}
                >
                  <option value="contains">Contém a palavra-chave</option>
                  <option value="exact">Exato</option>
                  <option value="any">Qualquer mensagem (ignora palavra-chave)</option>
                </select>
              </Field>
            </>
          )}

          {stepIndex === 1 &&
            (isCommentTrigger ? (
              <>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Quando alguém comentar, o Instagram sorteia uma dessas respostas pra publicar no próprio comentário (opcional).
                </p>
                <Field label="Adicionar resposta pública">
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      value={publicReplyInput}
                      onChange={(e) => setPublicReplyInput(e.target.value)}
                      placeholder="ex: Já te chamei no privado! 📩"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!publicReplyInput.trim()) return;
                        setState((prev) => ({ ...prev, publicReplies: [...prev.publicReplies, publicReplyInput.trim()] }));
                        setPublicReplyInput('');
                      }}
                      className="px-3 rounded-xl bg-primary text-primary-foreground cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </Field>
                {state.publicReplies.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {state.publicReplies.map((reply, i) => (
                      <div key={i} className="flex items-center justify-between bg-accent border border-border rounded-lg px-3 py-2 text-xs">
                        <span className="text-foreground">{reply}</span>
                        <button
                          type="button"
                          onClick={() => setState((prev) => ({ ...prev, publicReplies: prev.publicReplies.filter((_, x) => x !== i) }))}
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Esse passo só se aplica a gatilhos por comentário — como "Comentários em Posts" não está selecionado, pode avançar.
              </p>
            ))}

          {stepIndex === 2 && (
            <Field label="Mensagem inicial no privado (sempre enviada)">
              <textarea
                rows={5}
                className={inputCls}
                value={state.initialMessage}
                onChange={(e) => setState((prev) => ({ ...prev, initialMessage: e.target.value }))}
                placeholder="ex: Oi! Que bom que você se interessou..."
              />
            </Field>
          )}

          {stepIndex === 3 && (
            <>
              <div className="flex items-center justify-between">
                <span className={labelCls}>Mensagens e perguntas (nessa ordem)</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addStep({ kind: 'message', text: '' })}
                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent cursor-pointer"
                  >
                    + Mensagem simples
                  </button>
                  <button
                    type="button"
                    onClick={() => addStep({ kind: 'question', text: '', buttons: [''], timeoutMinutes: 720, reminderText: '' })}
                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    + Pergunta com botões
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {state.steps.map((step, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {i + 1}. {step.kind === 'message' ? 'Mensagem simples' : 'Pergunta com botões'}
                      </span>
                      <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={step.text}
                      onChange={(e) => updateStep(i, { ...step, text: e.target.value } as WizardStep)}
                      placeholder="Texto da mensagem"
                    />
                    {step.kind === 'question' && (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground">Botões (até 3)</span>
                          {step.buttons.map((btn, bi) => (
                            <div key={bi} className="flex gap-2">
                              <input
                                className={inputCls}
                                value={btn}
                                onChange={(e) => {
                                  const buttons = step.buttons.map((b, x) => (x === bi ? e.target.value : b));
                                  updateStep(i, { ...step, buttons });
                                }}
                                placeholder={`ex: ${bi === 0 ? 'Sim' : bi === 1 ? 'Às vezes' : 'Não'}`}
                              />
                              {step.buttons.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => updateStep(i, { ...step, buttons: step.buttons.filter((_, x) => x !== bi) })}
                                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {step.buttons.length < 3 && (
                            <button
                              type="button"
                              onClick={() => updateStep(i, { ...step, buttons: [...step.buttons, ''] })}
                              className="self-start text-[10px] font-bold text-primary cursor-pointer"
                            >
                              + Adicionar botão
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Minutos até o lembrete">
                            <input
                              type="number"
                              min={1}
                              className={inputCls}
                              value={step.timeoutMinutes}
                              onChange={(e) => updateStep(i, { ...step, timeoutMinutes: Number(e.target.value) })}
                            />
                          </Field>
                          <Field label="Texto do lembrete (opcional)">
                            <input
                              className={inputCls}
                              value={step.reminderText}
                              onChange={(e) => updateStep(i, { ...step, reminderText: e.target.value })}
                              placeholder="Padrão automático se vazio"
                            />
                          </Field>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 flex flex-col gap-3">
                <span className={labelCls}>Link final</span>
                <Field label="Texto que acompanha o link">
                  <input
                    className={inputCls}
                    value={state.link.text}
                    onChange={(e) => setState((prev) => ({ ...prev, link: { ...prev.link, text: e.target.value } }))}
                    placeholder="ex: Aqui está o seu link:"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="URL do link">
                    <input
                      className={inputCls}
                      value={state.link.url}
                      onChange={(e) => setState((prev) => ({ ...prev, link: { ...prev.link, url: e.target.value } }))}
                      placeholder="https://wa.me/..."
                    />
                  </Field>
                  <Field label="Texto do botão">
                    <input
                      className={inputCls}
                      value={state.link.buttonLabel}
                      onChange={(e) => setState((prev) => ({ ...prev, link: { ...prev.link, buttonLabel: e.target.value } }))}
                      placeholder="Acessar Link"
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          {stepIndex === 4 && (
            <>
              <Field label="Mandar mensagem de follow-up depois do link?">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, followup: { enabled: true, delayMinutes: 1440, text: prev.followup?.text || '' } }))}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                      state.followup?.enabled ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, followup: null }))}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                      !state.followup?.enabled ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </Field>
              {state.followup?.enabled && (
                <>
                  <Field label="Minutos de atraso">
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={state.followup.delayMinutes}
                      onChange={(e) => setState((prev) => ({ ...prev, followup: { ...prev.followup!, delayMinutes: Number(e.target.value) } }))}
                    />
                  </Field>
                  <Field label="Texto do follow-up">
                    <textarea
                      rows={3}
                      className={inputCls}
                      value={state.followup.text}
                      onChange={(e) => setState((prev) => ({ ...prev, followup: { ...prev.followup!, text: e.target.value } }))}
                    />
                  </Field>
                </>
              )}
              {issues.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex flex-col gap-1">
                  {issues.map((issue, i) => (
                    <p key={i} className="text-[10px] text-destructive">
                      {issue.message}
                    </p>
                  ))}
                </div>
              )}
              {saveError && <p className="text-[10px] text-destructive">{saveError}</p>}
            </>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border">
          <button
            type="button"
            onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
            disabled={stepIndex === 0}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          {stepIndex < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIndex((s) => Math.min(STEP_LABELS.length - 1, s + 1))}
              disabled={!canAdvance}
              className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-4 py-2.5 rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Avançar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold bg-primary text-primary-foreground px-4 py-2.5 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Criando...' : 'Criar automação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
