'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, MessageSquare, HelpCircle, Link2, Clock, Settings2, GripVertical } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Automation } from '@/types/automation';
import type { QualificationStep, WizardTail } from '@/lib/flow-engine/wizardCompiler';
import type { UtmLinkPickerProps } from './tail-editor';

/** Move um item de `from` para a posição `to` (índice no array ANTES da remoção). */
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to > from ? to - 1 : to, 0, item);
  return copy;
}

/**
 * Etapa 1+2 da reorganização do formulário guiado (ver plano tracejado na
 * conversa) — junta mensagem inicial + perguntas + link + follow-ups numa
 * ÚNICA linha do tempo numerada (Etapa 1), com cada passo recolhido num
 * resumo de uma linha que expande ao clicar, campos secundários dentro de
 * "Opções avançadas" fechado por padrão, e um único botão de adicionar com
 * menu de tipos (Etapa 2) — em vez da parede de ~30 campos sempre abertos e
 * dos três botões separados que existiam antes. Puramente visual: não toca
 * em wizardCompiler.ts nem no formato salvo. Fica de fora por enquanto:
 * automação com condição (wizardCondition) continua no layout antigo até
 * uma etapa futura do plano.
 *
 * Renderiza como filhos diretos do container numerado que já existe em
 * automations-tab.tsx (a div com `before:` que desenha a linha vertical) —
 * por isso cada item usa o mesmo padrão visual dos passos 1/2 (círculo
 * numerado absoluto) em vez de ter seu próprio wrapper com linha.
 */

interface StepTimelineProps {
  form: Automation;
  setForm: React.Dispatch<React.SetStateAction<Automation>>;
  tail: WizardTail;
  onChangeTail: (updater: (prev: WizardTail) => WizardTail) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  utmLinkPicker?: UtmLinkPickerProps;
  /** Número do primeiro passo desta timeline — os anteriores (gatilho, respostas públicas) já usam 1 e 2. */
  startNumber: number;
}

function truncate(text: string, max = 60): string {
  const clean = (text || '').trim();
  if (!clean) return '(vazio)';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Card recolhível — cabeçalho (ícone + tipo + resumo de 1 linha) sempre visível, corpo só quando expandido. */
function StepCard({
  n,
  icon,
  kind,
  summary,
  expanded,
  onToggle,
  onDelete,
  dragHandle,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  kind: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  /** Alça de arrastar (ícone + listeners do dnd-kit) — só as perguntas/mensagens são reordenáveis. */
  dragHandle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-accent rounded-2xl shadow-xs relative hover:border-border transition-colors text-foreground">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-4 z-10 select-none">
        {n}
      </div>
      {dragHandle}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-6 py-4 text-left cursor-pointer ${dragHandle ? 'pl-11' : ''}`}
      >
        <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{kind}</span>
          <p className="text-sm font-semibold text-foreground truncate">{summary}</p>
        </div>
        {onDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-muted-foreground hover:text-destructive cursor-pointer p-1 flex-shrink-0"
            aria-label="Remover passo"
          >
            <Trash2 className="w-4 h-4" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && <div className="flex flex-col gap-4 px-6 pb-6 -mt-1 animate-fade-in">{children}</div>}
    </div>
  );
}

/** Disclosure secundária dentro de um passo expandido — tag/campo/timeout/lembrete, fechado por padrão. */
function AdvancedOptions({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-3 -mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Opções avançadas
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="flex flex-col gap-3 mt-3">{children}</div>}
    </div>
  );
}

/** Alça de arrastar — só ela recebe os listeners do dnd-kit, pra não conflitar com o clique de expandir/recolher o card. */
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      className="absolute left-2 top-4 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 z-10 touch-none"
      aria-label="Arrastar pra reordenar"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}

/** Zona entre dois passos — alvo de drop pra reordenar, e um "+" pra inserir um passo novo ali mesmo. */
function InsertSlot({ id, onInsert }: { id: string; onInsert: (template: QualificationStep) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div ref={setNodeRef} className={`relative flex items-center h-4 -my-2 transition-colors ${isOver ? 'bg-primary/10 rounded-lg' : ''}`}>
      <div className="flex-1 border-t border-dashed border-transparent" />
      <div className="absolute left-1/2 -translate-x-1/2">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={`w-5 h-5 rounded-full border border-dashed border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary cursor-pointer transition-opacity ${isOver ? 'opacity-100 border-primary text-primary' : 'opacity-0 hover:opacity-100'}`}
          aria-label="Inserir passo aqui"
        >
          <Plus className="w-3 h-3" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <button type="button" onClick={() => { onInsert(NEW_MESSAGE); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Mensagem simples</span>
              </button>
              <button type="button" onClick={() => { onInsert(NEW_QUESTION); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Pergunta com botões</span>
              </button>
              <button type="button" onClick={() => { onInsert(NEW_OPEN_QUESTION); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Pergunta aberta</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const NEW_QUESTION: QualificationStep = { kind: 'question', text: '', buttons: [''], timeoutMinutes: 720, reminderText: '', saveReplyAsTagPrefix: '', saveReplyToField: '' };
const NEW_OPEN_QUESTION: QualificationStep = { kind: 'question', text: '', buttons: [], timeoutMinutes: 720, reminderText: '', saveReplyAsTagPrefix: '', saveReplyToField: '' };
const NEW_MESSAGE: QualificationStep = { kind: 'message', text: '' };

export function StepTimeline({ form, setForm, tail, onChangeTail, showToast, utmLinkPicker, startNumber }: StepTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ welcome: true });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const setQuestions = (updater: (prev: QualificationStep[]) => QualificationStep[]) => {
    onChangeTail((prev) => ({ ...prev, questions: updater(prev.questions) }));
  };

  const addQuestion = (template: QualificationStep) => {
    const key = `q-${tail.questions.length}`;
    setQuestions((prev) => [...prev, { ...template }]);
    setExpanded((prev) => ({ ...prev, [key]: true }));
    setAddMenuOpen(false);
  };

  const insertQuestionAt = (index: number, template: QualificationStep) => {
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(index, 0, { ...template });
      return next;
    });
    setExpanded((prev) => ({ ...prev, [`q-${index}`]: true }));
  };

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const handleQuestionDragEnd = (event: DragEndEvent) => {
    setDraggingIndex(null);
    const { active, over } = event;
    if (!over) return;
    const from = parseInt(String(active.id).replace('drag-q-', ''), 10);
    const to = parseInt(String(over.id).replace('slot-', ''), 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
    // Não faz sentido soltar exatamente no slot imediatamente antes/depois de onde já estava.
    if (to === from + 1) return;
    setQuestions((prev) => moveItem(prev, from, to));
  };

  let n = startNumber;
  const welcomeN = n++;
  const questionNumbers = tail.questions.map(() => n++);
  const linkN = n++;
  const followupNumbers = tail.followups.map(() => n++);

  return (
    <>
      {/* Mensagem inicial — primeiro item da timeline. */}
      <StepCard
        n={welcomeN}
        icon={<MessageSquare className="w-4 h-4" />}
        kind="Mensagem inicial"
        summary={truncate(form.welcome_dm)}
        expanded={!!expanded.welcome}
        onToggle={() => toggle('welcome')}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground">Conteúdo do primeiro Direct</label>
          <textarea
            required
            placeholder="Olá! Vi seu interesse no post. Para receber o seu link de acesso, clique no botão de resposta rápida abaixo:"
            value={form.welcome_dm}
            onChange={(e) => setForm((prev) => ({ ...prev, welcome_dm: e.target.value }))}
            rows={3}
            className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, welcome_dm: `{{primeiro_nome}}, ${prev.welcome_dm}` }))}
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
            onChange={(e) => setForm((prev) => ({ ...prev, quick_reply_button: e.target.value || null }))}
            className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all font-semibold"
          />
        </div>

        <AdvancedOptions>
          {form.quick_reply_button && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Esperar clique por (min, opcional)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Sem prazo, sem lembrete"
                  value={form.welcome_dm_timeout_minutes ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, welcome_dm_timeout_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                  className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Lembrete se não clicar (opcional)</label>
                <input
                  type="text"
                  placeholder="Padrão automático se vazio"
                  value={form.welcome_dm_reminder_text || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, welcome_dm_reminder_text: e.target.value || null }))}
                  className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                />
              </div>
              <p className="text-[9px] text-muted-foreground col-span-2 -mt-1">
                Deixe o tempo em branco pra esperar o clique sem prazo (sem mandar lembrete).
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-foreground">Captura de Leads & Integração</span>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.ask_email || false}
                  onChange={(e) => setForm((prev) => ({ ...prev, ask_email: e.target.checked }))}
                  className="rounded border-border bg-accent text-primary focus:ring-primary/20 w-4 h-4"
                />
                <span className="text-xs text-muted-foreground font-semibold">Solicitar E-mail</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.ask_phone || false}
                  onChange={(e) => setForm((prev) => ({ ...prev, ask_phone: e.target.checked }))}
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
                  onChange={(e) => setForm((prev) => ({ ...prev, webhook_url: e.target.value }))}
                  className="bg-accent border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-4 py-2 text-xs focus:outline-none text-foreground placeholder-muted-foreground font-mono"
                />
              </div>
            )}
          </div>
        </AdvancedOptions>
      </StepCard>

      {/* Perguntas de qualificação — cada uma é o seu próprio passo numerado, recolhido por padrão.
          Arrastável (alça à esquerda) e com um "+" entre cada par pra inserir um passo novo
          bem naquele ponto, em vez de só no fim da lista. */}
      <DndContext sensors={dragSensors} onDragStart={(e) => setDraggingIndex(parseInt(String(e.active.id).replace('drag-q-', ''), 10))} onDragEnd={handleQuestionDragEnd}>
        <InsertSlot id="slot-0" onInsert={(t) => insertQuestionAt(0, t)} />
        {tail.questions.map((step, i) => {
        const key = `q-${i}`;
        const kindLabel = step.kind === 'message' ? 'Mensagem simples' : step.buttons.length === 0 ? 'Pergunta aberta' : 'Pergunta com botões';
        const summary = step.kind === 'question' && step.buttons.length > 0
          ? `${truncate(step.text, 44)} · ${step.buttons.length} botão${step.buttons.length > 1 ? 'ões' : ''}`
          : truncate(step.text);
        return (
          <React.Fragment key={i}>
          <StepCard
            n={questionNumbers[i]}
            icon={step.kind === 'question' ? <HelpCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            kind={kindLabel}
            summary={summary}
            expanded={!!expanded[key]}
            onToggle={() => toggle(key)}
            onDelete={() => setQuestions((prev) => prev.filter((_, x) => x !== i))}
            dragHandle={<DragHandle id={`drag-q-${i}`} />}
          >
            <div className="flex flex-col gap-1.5">
              <textarea
                placeholder="Texto da mensagem"
                value={step.text}
                onChange={(e) =>
                  setQuestions((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], text: e.target.value };
                    return next;
                  })
                }
                rows={2}
                className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground resize-none"
              />
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], text: `{{primeiro_nome}}, ${next[i].text}` };
                    return next;
                  })
                }
                className="self-start text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                + Inserir nome do lead no início
              </button>
            </div>

            {step.kind === 'question' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Botões (até 3, opcional)</span>
                    {step.buttons.length === 0 && (
                      <span className="text-[9px] text-muted-foreground italic">Sem botões = o lead responde em texto livre</span>
                    )}
                  </div>
                  {step.buttons.map((btn, bi) => (
                    <div key={bi} className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <input
                          className={`flex-1 bg-accent border rounded-xl px-3 py-2 text-sm focus:outline-none text-foreground placeholder-muted-foreground ${
                            btn.length > 20 ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'
                          }`}
                          value={btn}
                          onChange={(e) =>
                            setQuestions((prev) => {
                              const next = [...prev];
                              const s = next[i] as typeof step;
                              s.buttons = s.buttons.map((b, x) => (x === bi ? e.target.value : b));
                              return next;
                            })
                          }
                          placeholder={`ex: ${bi === 0 ? 'Sim' : bi === 1 ? 'Às vezes' : 'Não'}`}
                        />
                        {step.buttons.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuestions((prev) => {
                                const next = [...prev];
                                const s = next[i] as typeof step;
                                s.buttons = s.buttons.filter((_, x) => x !== bi);
                                return next;
                              })
                            }
                            className="text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold ${btn.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {btn.length}/20 caracteres (limite do Instagram){btn.length > 20 ? ', vai ser cortado!' : ''}
                      </span>
                    </div>
                  ))}
                  {step.buttons.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((prev) => {
                          const next = [...prev];
                          const s = next[i] as typeof step;
                          s.buttons = [...s.buttons, ''];
                          return next;
                        })
                      }
                      className="self-start text-[10px] font-bold text-primary cursor-pointer"
                    >
                      + Adicionar botão
                    </button>
                  )}
                </div>

                <AdvancedOptions>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground">Salvar resposta como tag</label>
                      <input
                        type="text"
                        value={step.saveReplyAsTagPrefix || ''}
                        onChange={(e) =>
                          setQuestions((prev) => {
                            const next = [...prev];
                            (next[i] as typeof step).saveReplyAsTagPrefix = e.target.value;
                            return next;
                          })
                        }
                        placeholder='ex: "area_"'
                        className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground">Salvar resposta num campo</label>
                      <input
                        type="text"
                        value={step.saveReplyToField || ''}
                        onChange={(e) =>
                          setQuestions((prev) => {
                            const next = [...prev];
                            (next[i] as typeof step).saveReplyToField = e.target.value;
                            return next;
                          })
                        }
                        placeholder='ex: "email", "cidade"'
                        className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground">Minutos até o lembrete</label>
                      <input
                        type="number"
                        min={1}
                        value={step.timeoutMinutes}
                        onChange={(e) =>
                          setQuestions((prev) => {
                            const next = [...prev];
                            (next[i] as typeof step).timeoutMinutes = parseInt(e.target.value) || 1;
                            return next;
                          })
                        }
                        className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground">Texto do lembrete</label>
                      <input
                        type="text"
                        value={step.reminderText}
                        onChange={(e) =>
                          setQuestions((prev) => {
                            const next = [...prev];
                            (next[i] as typeof step).reminderText = e.target.value;
                            return next;
                          })
                        }
                        placeholder="Padrão automático se vazio"
                        className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                      />
                    </div>
                  </div>
                </AdvancedOptions>
              </>
            )}
          </StepCard>
          <InsertSlot id={`slot-${i + 1}`} onInsert={(t) => insertQuestionAt(i + 1, t)} />
          </React.Fragment>
        );
        })}
        <DragOverlay>
          {draggingIndex !== null && tail.questions[draggingIndex] ? (
            <div className="bg-card border border-primary rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3 opacity-90">
              {tail.questions[draggingIndex].kind === 'question' ? <HelpCircle className="w-4 h-4 text-muted-foreground" /> : <MessageSquare className="w-4 h-4 text-muted-foreground" />}
              <p className="text-sm font-semibold text-foreground truncate">{truncate(tail.questions[draggingIndex].text)}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Botão único de adicionar passo, com menu de tipos — antes eram 3 botões sempre visíveis. */}
      <div className="relative -mt-2">
        <button
          type="button"
          onClick={() => setAddMenuOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-primary text-primary bg-transparent hover:bg-primary/10 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
        >
          <Plus className="w-4 h-4" />
          Adicionar passo
        </button>
        {addMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <button type="button" onClick={() => addQuestion(NEW_MESSAGE)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Mensagem simples</span>
              </button>
              <button type="button" onClick={() => addQuestion(NEW_QUESTION)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Pergunta com botões</span>
              </button>
              <button type="button" onClick={() => addQuestion(NEW_OPEN_QUESTION)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Pergunta aberta</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Envio do link — antes era sempre a última seção fixa; continua no fim por enquanto (etapa futura solta essa amarra). */}
      <StepCard
        n={linkN}
        icon={<Link2 className="w-4 h-4" />}
        kind="Envio do link"
        summary={tail.link_button_label || truncate(tail.link_text || '', 44)}
        expanded={!!expanded.link}
        onToggle={() => toggle('link')}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground">Texto de apoio (mensagem com o link)</label>
          <textarea
            placeholder="Perfeito! Aqui está o seu link exclusivo para acessar o conteúdo completo:"
            value={tail.link_text || ''}
            onChange={(e) => onChangeTail((prev) => ({ ...prev, link_text: e.target.value }))}
            rows={2}
            className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all resize-none font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">URL do link</label>
            <input
              type="url"
              placeholder="https://sualandingpage.com"
              value={tail.link_url || ''}
              onChange={(e) => onChangeTail((prev) => ({ ...prev, link_url: e.target.value || null }))}
              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground font-mono font-bold"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">Texto do botão</label>
            <input
              type="text"
              placeholder="Acessar Link"
              maxLength={20}
              value={tail.link_button_label || ''}
              onChange={(e) => onChangeTail((prev) => ({ ...prev, link_button_label: e.target.value || null }))}
              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground font-bold"
            />
          </div>
        </div>

        {utmLinkPicker && (
          <AdvancedOptions>
            <button
              type="button"
              onClick={utmLinkPicker.onGenerateTrackedLink}
              disabled={utmLinkPicker.generatingTrackedLink}
              className="self-start text-[11px] font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
            >
              {utmLinkPicker.generatingTrackedLink ? 'Gerando...' : '+ Gerar link com rastreamento de clique'}
            </button>
            {utmLinkPicker.utmLinks.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[10px] font-bold text-muted-foreground">Ou use um link UTM já criado</label>
                <select
                  value={utmLinkPicker.selectedUtmLinkId || utmLinkPicker.utmLinks.find((l) => l.short_url === tail.link_url || l.generated_url === tail.link_url)?.id || ''}
                  onChange={(e) => utmLinkPicker.onSelectUtmLink(e.target.value)}
                  className="bg-accent border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-primary text-foreground"
                >
                  <option value="">Selecionar...</option>
                  {utmLinkPicker.utmLinks.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || l.base_url}{l.automation_id && l.automation_id !== utmLinkPicker.automationId ? ' (já vinculado a outra automação)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </AdvancedOptions>
        )}
      </StepCard>

      {/* Follow-ups — cada mensagem da sequência é o seu próprio passo numerado. */}
      {tail.followups.map((followup, index) => {
        const key = `f-${followup.id}`;
        return (
          <StepCard
            key={followup.id}
            n={followupNumbers[index]}
            icon={<Clock className="w-4 h-4" />}
            kind={`Follow-up · espera ${followup.delay_minutes} min`}
            summary={truncate(followup.text)}
            expanded={!!expanded[key]}
            onToggle={() => toggle(key)}
            onDelete={() => onChangeTail((prev) => ({ ...prev, followups: prev.followups.filter((_, i) => i !== index) }))}
          >
            <div className="flex flex-col gap-1.5">
              <textarea
                placeholder="Digite a mensagem..."
                value={followup.text}
                onChange={(e) =>
                  onChangeTail((prev) => {
                    const next = [...prev.followups];
                    next[index] = { ...next[index], text: e.target.value };
                    return { ...prev, followups: next };
                  })
                }
                rows={2}
                className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground resize-none"
              />
              <p className="text-[9px] text-muted-foreground">
                Use <code className="bg-accent px-1 rounded">{'{{primeiro_nome}}'}</code> pra personalizar com o nome do lead
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Aguardar (minutos)</label>
                <input
                  type="number"
                  min={1}
                  value={followup.delay_minutes}
                  onChange={(e) =>
                    onChangeTail((prev) => {
                      const next = [...prev.followups];
                      next[index] = { ...next[index], delay_minutes: parseInt(e.target.value) || 1 };
                      return { ...prev, followups: next };
                    })
                  }
                  className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">URL (opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={followup.link_url || ''}
                  onChange={(e) =>
                    onChangeTail((prev) => {
                      const next = [...prev.followups];
                      next[index] = { ...next[index], link_url: e.target.value };
                      return { ...prev, followups: next };
                    })
                  }
                  className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Texto do botão</label>
                <input
                  type="text"
                  placeholder="Acessar"
                  maxLength={20}
                  value={followup.link_button_label || ''}
                  onChange={(e) =>
                    onChangeTail((prev) => {
                      const next = [...prev.followups];
                      next[index] = { ...next[index], link_button_label: e.target.value };
                      return { ...prev, followups: next };
                    })
                  }
                  className="bg-accent border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                />
              </div>
            </div>
          </StepCard>
        );
      })}

      <button
        type="button"
        onClick={() => {
          const totalMinutes = tail.followups.reduce((acc, f) => acc + f.delay_minutes, 0);
          if (totalMinutes >= 1440) {
            showToast('A sequência não pode ultrapassar 24h (1440 min).', 'error');
            return;
          }
          const newId = Math.random().toString(36).substr(2, 9);
          onChangeTail((prev) => ({
            ...prev,
            followups: [...prev.followups, { id: newId, delay_minutes: 15, text: '', link_url: '' }],
          }));
          setExpanded((prev) => ({ ...prev, [`f-${newId}`]: true }));
        }}
        className="flex items-center justify-center gap-2 border border-dashed border-muted-foreground text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground hover:border-primary px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
      >
        <Plus className="w-4 h-4" />
        Adicionar Follow-up
      </button>
    </>
  );
}
