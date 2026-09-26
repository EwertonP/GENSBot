'use client';

import { useEffect, useRef, useState } from 'react';
import type { Automation } from '@/types/automation';
import type { QualificationStep, WizardCondition, WizardTail } from '@/lib/flow-engine/wizardCompiler';
import { confirmDialog } from '@/components/ui/dialog';

/**
 * Estado do editor de automação (Formulário Avançado): formulário, perguntas
 * de qualificação, condição/bifurcação e o aviso de "sair sem salvar".
 *
 * Só o que é do editor mora aqui. Os dados carregados do servidor
 * (automations, mídias, links UTM) continuam na página, porque o Dashboard
 * também usa; salvar/abrir uma automação usa os setters devolvidos abaixo.
 */
export function useAutomationEditor() {
  // Fluxo/perguntas do Formulário Avançado
  const [qualificationSteps, setQualificationSteps] = useState<QualificationStep[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Preenchidos ao abrir uma automação existente pra edição — ver handleEditAutomation.
  // wizardIncompatibleReason != null quando o flow_definition usa recursos que só o
  // Canvas sabe editar (ramificação, múltiplas saídas, etc.); nesse caso o Formulário
  // Avançado não deixa salvar por cima, pra não substituir o fluxo real por um errado.
  const [wizardIncompatibleReason, setWizardIncompatibleReason] = useState<string | null>(null);
  const [hadFlowDefinition, setHadFlowDefinition] = useState(false);
  // Bifurcação única do Formulário Avançado (v1 — perguntas antes do split ficam em
  // `qualificationSteps`, cada ramo é independente). null = fluxo linear normal.
  const [wizardCondition, setWizardCondition] = useState<WizardCondition | null>(null);
  const [activeBranchTab, setActiveBranchTab] = useState<'true' | 'false'>('true');

  const [form, setForm] = useState<Automation>({
    name: '',
    active: true,
    triggers: ['comment'],
    keywords: [],
    match_type: 'contains',
    specific_post_id: null,
    specific_story_id: null,
    public_replies: [],
    welcome_dm: '',
    quick_reply_button: 'Quero!',
    link_text: '',
    link_button_label: 'Acessar Link',
    link_url: '',
    reminder_text: '',
    reminder_delay_minutes: 15,
    ask_email: false,
    ask_phone: false,
    webhook_url: '',
    followups: [],
  });
  
  
  // Estado para inputs auxiliares
  const [keywordInput, setKeywordInput] = useState('');
  const [publicReplyInput, setPublicReplyInput] = useState('');

  // Retrato do formulário de automação ao entrar na edição — sair (menu,
  // perfil, "Voltar") com mudanças pede confirmação em vez de descartar.
  const serializarAutomacao = () =>
    JSON.stringify([form, keywordInput, publicReplyInput, qualificationSteps, wizardCondition]);
  const retratoAutomacaoRef = useRef<string | null>(null);
  useEffect(() => {
    retratoAutomacaoRef.current = isEditing ? serializarAutomacao() : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  /** true = pode sair do editor (sem mudanças, ou o usuário confirmou descartar). */
  const podeSairDaEdicao = async () => {
    if (!isEditing || retratoAutomacaoRef.current === null) return true;
    if (serializarAutomacao() === retratoAutomacaoRef.current) return true;
    return confirmDialog({
      title: 'Sair sem salvar a automação?',
      description: 'As alterações neste fluxo ainda não foram salvas e serão perdidas.',
      confirmLabel: 'Sair sem salvar',
      cancelLabel: 'Continuar editando',
      tone: 'destructive',
    });
  };

  // Versão protegida do setter para quem está fora do fluxo de salvar.
  const setIsEditingProtegido = async (v: boolean) => {
    if (!v && !(await podeSairDaEdicao())) return;
    setIsEditing(v);
  };

  const resetForm = () => {
    setForm({
      name: '',
      active: true,
      triggers: ['comment'],
      keywords: [],
      match_type: 'contains',
      specific_post_id: null,
      specific_story_id: null,
      public_replies: [],
      welcome_dm: '',
      quick_reply_button: 'Quero!',
      link_text: '',
      link_button_label: 'Acessar Link',
      link_url: '',
      reminder_text: '',
      reminder_delay_minutes: 15,
      ask_email: false,
      ask_phone: false,
      webhook_url: '',
    });
    setIsEditing(false);
    setKeywordInput('');
    setPublicReplyInput('');
    setQualificationSteps([]);
    setWizardIncompatibleReason(null);
    setHadFlowDefinition(false);
    setWizardCondition(null);
    setActiveBranchTab('true');
  };

  // --- Bifurcação do Formulário Avançado (v1) ---------------------------
  // Sem condição, `qualificationSteps` + `form.link_*`/`followups` continuam
  // sendo a única cauda do fluxo (comportamento 100% igual a antes). Com
  // condição, essa cauda "legada" só existe até o ponto do split — o resto
  // vive em `wizardCondition.trueBranch`/`falseBranch`, independentes.
  const legacyTail: WizardTail = {
    questions: qualificationSteps,
    link_text: form.link_text || '',
    link_url: form.link_url ?? null,
    link_button_label: form.link_button_label ?? null,
    followups: form.followups || [],
  };

  const handleLegacyTailChange = (updater: (prev: WizardTail) => WizardTail) => {
    const next = updater(legacyTail);
    setQualificationSteps(next.questions);
    setForm(prev => ({ ...prev, link_text: next.link_text, link_url: next.link_url, link_button_label: next.link_button_label, followups: next.followups }));
  };

  const [pendingConditionSplitIndex, setPendingConditionSplitIndex] = useState(0);

  const addCondition = (splitIndex: number) => {
    const sharedTail: WizardTail = {
      questions: qualificationSteps.slice(splitIndex),
      link_text: form.link_text || '',
      link_url: form.link_url ?? null,
      link_button_label: form.link_button_label ?? null,
      followups: form.followups || [],
    };
    setQualificationSteps(qualificationSteps.slice(0, splitIndex));
    setWizardCondition({
      splitAfterIndex: splitIndex,
      condition: { conditionType: 'keyword', keywords: [], match_type: 'contains' },
      // clones independentes — editar um ramo não pode vazar pro outro.
      trueBranch: structuredClone(sharedTail),
      falseBranch: structuredClone(sharedTail),
    });
    setActiveBranchTab('true');
  };

  const removeCondition = async () => {
    if (!wizardCondition) return;
    if (!(await confirmDialog({title: "Remover a condição?",description: "O ramo \"Se falso\" (perguntas, link e follow-ups) será descartado, e o ramo \"Se verdadeiro\" vira o fluxo normal.",confirmLabel: "Remover condição",tone: "destructive"}))) return;;
    setQualificationSteps(prev => [...prev, ...wizardCondition.trueBranch.questions]);
    setForm(prev => ({
      ...prev,
      link_text: wizardCondition.trueBranch.link_text,
      link_url: wizardCondition.trueBranch.link_url,
      link_button_label: wizardCondition.trueBranch.link_button_label,
      followups: wizardCondition.trueBranch.followups,
    }));
    setWizardCondition(null);
  };

  const handleTriggerChange = (trigger: string) => {
    setForm(prev => {
      const triggers = prev.triggers.includes(trigger)
        ? prev.triggers.filter(t => t !== trigger)
        : [...prev.triggers, trigger];
      return { ...prev, triggers };
    });
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeywordInput(value);
    const keywords = value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    setForm(prev => ({ ...prev, keywords }));
  };

  const handleAddPublicReply = () => {
    if (!publicReplyInput.trim()) return;
    setForm(prev => ({
      ...prev,
      public_replies: [...prev.public_replies, publicReplyInput.trim()],
    }));
    setPublicReplyInput('');
  };

  const handleRemovePublicReply = (index: number) => {
    setForm(prev => ({
      ...prev,
      public_replies: prev.public_replies.filter((_, i) => i !== index),
    }));
  };

  return {
    isEditing,
    setIsEditing,
    form,
    setForm,
    keywordInput,
    setKeywordInput,
    publicReplyInput,
    setPublicReplyInput,
    qualificationSteps,
    setQualificationSteps,
    wizardCondition,
    setWizardCondition,
    activeBranchTab,
    setActiveBranchTab,
    wizardIncompatibleReason,
    setWizardIncompatibleReason,
    hadFlowDefinition,
    setHadFlowDefinition,
    pendingConditionSplitIndex,
    setPendingConditionSplitIndex,
    legacyTail,
    handleLegacyTailChange,
    addCondition,
    removeCondition,
    handleTriggerChange,
    handleKeywordsChange,
    handleAddPublicReply,
    handleRemovePublicReply,
    resetForm,
    podeSairDaEdicao,
    setIsEditingProtegido,
  };
}
