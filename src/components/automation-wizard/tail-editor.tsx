'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { QualificationStep, WizardTail } from '@/lib/flow-engine/wizardCompiler';

/**
 * Cauda do fluxo (perguntas de qualificação + mensagem de link + follow-ups),
 * extraída de `page.tsx` pra ser reutilizável — sem condição no fluxo, é
 * renderizada uma vez; com condição, é renderizada duas vezes (uma por ramo),
 * cada instância totalmente independente (ver PLANO "Suporte a condição no
 * formulário guiado"). A conveniência de "gerar link com rastreamento"/"usar
 * link UTM já criado" só existe no ramo principal (quando `utmLinkPicker` é
 * passado) — os dois ramos de uma condição usam URL manual, já que essas
 * features hoje são hardcoded no link final único da automação.
 */
export interface UtmLinkPickerProps {
  utmLinks: any[];
  selectedUtmLinkId: string;
  onSelectUtmLink: (utmLinkId: string) => void;
  onGenerateTrackedLink: () => void;
  generatingTrackedLink: boolean;
  automationId?: string;
}

export type TailSection = 'questions' | 'link' | 'followups';

export interface TailEditorProps {
  tail: WizardTail;
  onChange: (updater: (prev: WizardTail) => WizardTail) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  utmLinkPicker?: UtmLinkPickerProps;
  /** Título opcional pra diferenciar visualmente os dois ramos de uma condição. */
  title?: string;
  /** Quais dos 3 cards mostrar — default todos. A parte pré-condição só mostra 'questions'. */
  sections?: TailSection[];
}

const ALL_SECTIONS: TailSection[] = ['questions', 'link', 'followups'];

export function TailEditor({ tail, onChange, showToast, utmLinkPicker, title, sections = ALL_SECTIONS }: TailEditorProps) {
  const setQuestions = (updater: (prev: QualificationStep[]) => QualificationStep[]) => {
    onChange((prev) => ({ ...prev, questions: updater(prev.questions) }));
  };

  return (
    <div className="flex flex-col gap-6">
      {title && <p className="text-xs font-bold text-primary uppercase tracking-wider -mb-2">{title}</p>}

      {/* Perguntas de Qualificação */}
      {sections.includes('questions') && (
      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 text-foreground">
        <h4 className="font-bold text-foreground text-sm">Perguntas de Qualificação (Opcional)</h4>
        <p className="text-muted-foreground text-xs font-semibold -mt-2">
          Faça perguntas com botões antes do link — o fluxo pausa esperando a resposta, manda um lembrete se demorar, e continua esperando depois disso.
        </p>

        <div className="flex flex-col gap-3">
          {tail.questions.map((step, i) => (
            <div key={i} className="border border-border bg-accent p-4 rounded-xl flex flex-col gap-3 relative animate-fade-in">
              <button
                type="button"
                onClick={() => setQuestions((prev) => prev.filter((_, x) => x !== i))}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive cursor-pointer p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex flex-col gap-1.5 pr-8">
                <label className="text-xs font-bold text-muted-foreground">
                  {i + 1}. {step.kind === 'message' ? 'Mensagem simples' : step.buttons.length === 0 ? 'Pergunta aberta (resposta livre)' : 'Pergunta com botões'}
                </label>
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
                  className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground resize-none"
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
                    className="text-[9px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    + Inserir nome do lead no início
                  </button>
                  <p className="text-[9px] text-muted-foreground">
                    (<code className="bg-accent px-1 rounded">{'{{primeiro_nome}}'}</code> funciona em qualquer parte do texto)
                  </p>
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
                            className={`flex-1 bg-card border rounded-xl px-3 py-2 text-sm focus:outline-none text-foreground placeholder-muted-foreground ${
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
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Salvar resposta como tag no lead (opcional)</label>
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
                      placeholder='ex: "area_" grava a resposta como tag area_marketing_digital'
                      className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                    />
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
                        className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
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
                        className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2">
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
                setQuestions((prev) => [...prev, { kind: 'question', text: '', buttons: [''], timeoutMinutes: 720, reminderText: '', saveReplyAsTagPrefix: '' }])
              }
              className="flex-1 flex items-center justify-center gap-2 border border-dashed border-primary text-primary bg-transparent hover:bg-primary/10 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
            >
              <Plus className="w-4 h-4" />
              Pergunta com Botões
            </button>
            <button
              type="button"
              onClick={() =>
                setQuestions((prev) => [...prev, { kind: 'question', text: '', buttons: [], timeoutMinutes: 720, reminderText: '', saveReplyAsTagPrefix: '' }])
              }
              className="flex-1 flex items-center justify-center gap-2 border border-dashed border-primary text-primary bg-transparent hover:bg-primary/10 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
            >
              <Plus className="w-4 h-4" />
              Pergunta Aberta
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Envio do Link */}
      {sections.includes('link') && (
      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 text-foreground">
        <h4 className="font-bold text-foreground text-sm">Envio do Link (Mensagem de Texto)</h4>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">Texto de Apoio (Mensagem com o Link)</label>
            <textarea
              placeholder="Perfeito! Aqui está o seu link exclusivo para acessar o conteúdo completo:"
              value={tail.link_text || ''}
              onChange={(e) => onChange((prev) => ({ ...prev, link_text: e.target.value }))}
              rows={2}
              className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground transition-all resize-none font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">URL do Link</label>
              <input
                type="url"
                placeholder="https://sualandingpage.com"
                value={tail.link_url || ''}
                onChange={(e) => onChange((prev) => ({ ...prev, link_url: e.target.value || null }))}
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
                      <p className="text-[9px] text-muted-foreground">
                        Editar esse link depois na tela de Links UTM atualiza o destino aqui automaticamente.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Texto do Botão</label>
              <input
                type="text"
                placeholder="Acessar Link"
                maxLength={20}
                value={tail.link_button_label || ''}
                onChange={(e) => onChange((prev) => ({ ...prev, link_button_label: e.target.value || null }))}
                className="bg-accent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder-muted-foreground font-bold"
              />
            </div>
          </div>

          <div className="border border-border rounded-xl p-4 bg-accent/50 flex flex-col gap-2.5 max-w-sm">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Visualização do Envio</span>
            <div className="bg-card border border-accent rounded-2xl p-3.5 text-xs text-foreground max-w-xs break-words leading-relaxed font-medium flex flex-col gap-3">
              <p>{tail.link_text || 'Aqui está o seu link:'}</p>
              {tail.link_url && (
                <div className="mt-1 w-full flex justify-center border-t border-border pt-3">
                  <span className="text-primary font-bold text-center block w-full">{tail.link_button_label || 'Acessar Link'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Follow-ups */}
      {sections.includes('followups') && (
      <div className="bg-card border border-accent rounded-2xl p-6 shadow-xs flex flex-col gap-4 text-foreground">
        <h4 className="font-bold text-foreground text-sm">Sequência de Follow-ups (Opcional)</h4>
        <p className="text-muted-foreground text-xs font-semibold mb-2">
          Crie uma sequência de mensagens para serem enviadas automaticamente. O tempo total acumulado não pode ultrapassar 24 horas.
        </p>

        <div className="flex flex-col gap-4">
          {tail.followups.map((followup, index) => (
            <div key={followup.id} className="border border-border bg-accent p-4 rounded-xl flex flex-col gap-3 relative animate-fade-in">
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, followups: prev.followups.filter((_, i) => i !== index) }))}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive cursor-pointer p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex flex-col gap-1.5 pr-8">
                <label className="text-xs font-bold text-muted-foreground">Mensagem {index + 1}</label>
                <textarea
                  placeholder="Digite a mensagem..."
                  value={followup.text}
                  onChange={(e) =>
                    onChange((prev) => {
                      const next = [...prev.followups];
                      next[index] = { ...next[index], text: e.target.value };
                      return { ...prev, followups: next };
                    })
                  }
                  rows={2}
                  className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground resize-none"
                />
                <p className="text-[9px] text-muted-foreground">
                  Use <code className="bg-accent px-1 rounded">{'{{primeiro_nome}}'}</code> pra personalizar com o nome do lead
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Aguardar (Minutos)</label>
                  <input
                    type="number"
                    min={1}
                    value={followup.delay_minutes}
                    onChange={(e) =>
                      onChange((prev) => {
                        const next = [...prev.followups];
                        next[index] = { ...next[index], delay_minutes: parseInt(e.target.value) || 1 };
                        return { ...prev, followups: next };
                      })
                    }
                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground">URL (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={followup.link_url || ''}
                    onChange={(e) =>
                      onChange((prev) => {
                        const next = [...prev.followups];
                        next[index] = { ...next[index], link_url: e.target.value };
                        return { ...prev, followups: next };
                      })
                    }
                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Texto do Botão</label>
                  <input
                    type="text"
                    placeholder="Acessar"
                    maxLength={20}
                    value={followup.link_button_label || ''}
                    onChange={(e) =>
                      onChange((prev) => {
                        const next = [...prev.followups];
                        next[index] = { ...next[index], link_button_label: e.target.value };
                        return { ...prev, followups: next };
                      })
                    }
                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              const totalMinutes = tail.followups.reduce((acc, f) => acc + f.delay_minutes, 0);
              if (totalMinutes >= 1440) {
                showToast('A sequência não pode ultrapassar 24h (1440 min).', 'error');
                return;
              }
              onChange((prev) => ({
                ...prev,
                followups: [...prev.followups, { id: Math.random().toString(36).substr(2, 9), delay_minutes: 15, text: '', link_url: '' }],
              }));
            }}
            className="flex items-center justify-center gap-2 border border-dashed border-muted-foreground text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground hover:border-primary px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            Adicionar Mensagem à Sequência
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
