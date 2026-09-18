'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Automation } from '@/types/automation';
import type { QualificationStep, WizardTail } from '@/lib/flow-engine/wizardCompiler';
import type { UtmLinkPickerProps } from './tail-editor';

/**
 * Etapa 1 da reorganização do formulário guiado (ver plano tracejado na
 * conversa) — junta mensagem inicial + perguntas + link + follow-ups numa
 * ÚNICA linha do tempo numerada, em vez de quatro seções separadas (mensagem
 * inicial num card isolado em automations-tab.tsx; perguntas/link/follow-ups
 * em três caixas irmãs de tail-editor.tsx). Puramente visual: não toca em
 * wizardCompiler.ts nem no formato salvo — cada campo aqui já existia antes,
 * só reorganizado. Fica de fora por enquanto: automação com condição
 * (wizardCondition) continua no layout antigo até a Etapa 5 do plano.
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

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs border-2 border-background shadow-sm absolute left-[-26px] top-6.5 z-10 select-none">
      {n}
    </div>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative hover:border-border transition-colors text-foreground">
      <StepNumber n={n} />
      <h4 className="font-bold text-foreground text-sm">{title}</h4>
      {children}
    </div>
  );
}

export function StepTimeline({ form, setForm, tail, onChangeTail, showToast, utmLinkPicker, startNumber }: StepTimelineProps) {
  const setQuestions = (updater: (prev: QualificationStep[]) => QualificationStep[]) => {
    onChangeTail((prev) => ({ ...prev, questions: updater(prev.questions) }));
  };

  let n = startNumber;
  const welcomeN = n++;
  const questionNumbers = tail.questions.map(() => n++);
  const linkN = n++;
  const followupNumbers = tail.followups.map(() => n++);

  return (
    <>
      {/* Mensagem inicial — era um card isolado ("Passo 3"), agora o primeiro item da timeline. */}
      <StepCard n={welcomeN} title="Mensagem inicial (DM no Direct)">
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

        <div className="border-t border-border pt-4 mt-2 flex flex-col gap-3">
          <span className="text-xs font-bold text-foreground">Captura de Leads & Integração (Opcional)</span>
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
      </StepCard>

      {/* Perguntas de qualificação — cada uma é o seu próprio passo numerado agora, não mais um item dentro de uma caixa "Perguntas". */}
      {tail.questions.map((step, i) => (
        <StepCard
          key={i}
          n={questionNumbers[i]}
          title={step.kind === 'message' ? 'Mensagem simples' : step.buttons.length === 0 ? 'Pergunta aberta (resposta livre)' : 'Pergunta com botões'}
        >
          <button
            type="button"
            onClick={() => setQuestions((prev) => prev.filter((_, x) => x !== i))}
            className="absolute top-6 right-6 text-muted-foreground hover:text-destructive cursor-pointer p-1"
            aria-label="Remover passo"
          >
            <Trash2 className="w-4 h-4" />
          </button>

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], text: `{{primeiro_nome}}, ${next[i].text}` };
                    return next;
                  })
                }
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                + Inserir nome do lead no início
              </button>
            </div>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Salvar resposta como tag (opcional)</label>
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
                  <label className="text-xs font-bold text-muted-foreground">Salvar resposta num campo (opcional)</label>
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
                  <label className="text-xs font-bold text-muted-foreground">Texto do lembrete (opcional)</label>
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
            </>
          )}
        </StepCard>
      ))}

      {/* Botões de adicionar passo (pergunta) — ficam entre as perguntas e o link, como próximo passo natural da timeline. */}
      <div className="flex gap-2 -mt-2">
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, { kind: 'message', text: '' }])}
          className="flex-1 flex items-center justify-center gap-2 border border-dashed border-muted-foreground text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground hover:border-primary px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
        >
          <Plus className="w-4 h-4" />
          Mensagem Simples
        </button>
        <button
          type="button"
          onClick={() =>
            setQuestions((prev) => [...prev, { kind: 'question', text: '', buttons: [''], timeoutMinutes: 720, reminderText: '', saveReplyAsTagPrefix: '', saveReplyToField: '' }])
          }
          className="flex-1 flex items-center justify-center gap-2 border border-dashed border-primary text-primary bg-transparent hover:bg-primary/10 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
        >
          <Plus className="w-4 h-4" />
          Pergunta com Botões
        </button>
        <button
          type="button"
          onClick={() =>
            setQuestions((prev) => [...prev, { kind: 'question', text: '', buttons: [], timeoutMinutes: 720, reminderText: '', saveReplyAsTagPrefix: '', saveReplyToField: '' }])
          }
          className="flex-1 flex items-center justify-center gap-2 border border-dashed border-primary text-primary bg-transparent hover:bg-primary/10 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
        >
          <Plus className="w-4 h-4" />
          Pergunta Aberta
        </button>
      </div>

      {/* Envio do link — antes era sempre a última seção fixa; continua no fim por enquanto (Etapa 4 solta essa amarra). */}
      <StepCard n={linkN} title="Envio do link">
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
            {utmLinkPicker && (
              <>
                <button
                  type="button"
                  onClick={utmLinkPicker.onGenerateTrackedLink}
                  disabled={utmLinkPicker.generatingTrackedLink}
                  className="self-start text-[9px] font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
                >
                  {utmLinkPicker.generatingTrackedLink ? 'Gerando...' : '+ Gerar link com rastreamento de clique'}
                </button>
                {utmLinkPicker.utmLinks.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-[9px] font-bold text-muted-foreground">Ou use um link UTM já criado</label>
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
              </>
            )}
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
      </StepCard>

      {/* Follow-ups — cada mensagem da sequência é o seu próprio passo numerado. */}
      {tail.followups.map((followup, index) => (
        <StepCard key={followup.id} n={followupNumbers[index]} title={`Follow-up (espera ${followup.delay_minutes} min)`}>
          <button
            type="button"
            onClick={() => onChangeTail((prev) => ({ ...prev, followups: prev.followups.filter((_, i) => i !== index) }))}
            className="absolute top-6 right-6 text-muted-foreground hover:text-destructive cursor-pointer p-1"
            aria-label="Remover follow-up"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex flex-col gap-1.5 pr-8">
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
      ))}

      <button
        type="button"
        onClick={() => {
          const totalMinutes = tail.followups.reduce((acc, f) => acc + f.delay_minutes, 0);
          if (totalMinutes >= 1440) {
            showToast('A sequência não pode ultrapassar 24h (1440 min).', 'error');
            return;
          }
          onChangeTail((prev) => ({
            ...prev,
            followups: [...prev.followups, { id: Math.random().toString(36).substr(2, 9), delay_minutes: 15, text: '', link_url: '' }],
          }));
        }}
        className="flex items-center justify-center gap-2 border border-dashed border-muted-foreground text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground hover:border-primary px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
      >
        <Plus className="w-4 h-4" />
        Adicionar Follow-up
      </button>
    </>
  );
}
