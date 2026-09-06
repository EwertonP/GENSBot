import type { FlowDefinition, FlowNode, FlowEdge, FlowNodeType } from '@/types/flow';
import type { Automation } from '@/types/automation';

export interface QualificationMessageStep {
  kind: 'message';
  text: string;
}

export interface QualificationQuestionStep {
  kind: 'question';
  text: string;
  /** 0 a 3 botões de resposta rápida. Vazio = pergunta aberta, o lead responde em texto livre. */
  buttons: string[];
  /** Minutos até mandar o lembrete único; depois disso a pergunta volta a esperar pra sempre. */
  timeoutMinutes: number;
  reminderText: string;
  /**
   * Se preenchido, a resposta do lead (normalizada) vira uma tag com esse prefixo
   * no contato (ex: prefixo "area_" + resposta "Marketing Digital" -> tag
   * "area_marketing_digital"). Funciona tanto pra pergunta aberta quanto com botões.
   */
  saveReplyAsTagPrefix?: string;
}

export type QualificationStep = QualificationMessageStep | QualificationQuestionStep;

const DEFAULT_REMINDER = 'Oi! Ainda estou por aqui, fico à disposição pra continuar quando você puder. 🙂';
const DEFAULT_TIMEOUT_MINUTES = 720;

function makeIdFactory() {
  let counter = 0;
  return (type: FlowNodeType) => {
    counter += 1;
    return `${type}-form-${counter}`;
  };
}

/** Monta o conjunto reutilizável de helpers (addNode/connect/attach) usado por qualquer compilador de flow_definition. */
function createFlowBuilder() {
  const nextId = makeIdFactory();
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const Y = 100;
  const X_STEP = 260;
  let x = 0;
  let pending: { source: string; handle: string | null }[] = [];

  function addNode(type: FlowNodeType, data: FlowNode['data']): string {
    const id = nextId(type);
    nodes.push({ id, type, position: { x, y: Y }, data });
    x += X_STEP;
    return id;
  }

  function connect(sourceId: string, targetId: string, sourceHandle: string | null) {
    edges.push({ id: `e-${sourceId}-${targetId}-${sourceHandle ?? 'default'}-${edges.length}`, source: sourceId, target: targetId, sourceHandle });
  }

  /** Conecta todos os nós pendentes ao alvo e o torna o novo pendente único. */
  function attach(targetId: string) {
    for (const p of pending) connect(p.source, targetId, p.handle);
    pending = [{ source: targetId, handle: null }];
  }

  function setPending(next: { source: string; handle: string | null }[]) {
    pending = next;
  }

  /**
   * Adiciona o micro-padrão de uma pergunta com botões: pergunta -> espera com timeout
   * -> (resposta: segue) / (timeout: 1 lembrete -> espera sem timeout -> segue). Os dois
   * "waitForReply" ficam pendentes — ambos se conectam ao próximo nó que for anexado.
   */
  function appendQuestionStep(step: QualificationQuestionStep) {
    const questionMsgId = addNode('sendMessage', { text: step.text, quick_reply_buttons: step.buttons.filter(Boolean).slice(0, 3) });
    attach(questionMsgId);

    const waitId = addNode('waitForReply', {
      timeoutMinutes: step.timeoutMinutes > 0 ? step.timeoutMinutes : DEFAULT_TIMEOUT_MINUTES,
      saveReplyAsTagPrefix: step.saveReplyAsTagPrefix?.trim() || null,
    });
    connect(questionMsgId, waitId, null);

    const reminderId = addNode('sendMessage', { text: step.reminderText?.trim() || DEFAULT_REMINDER });
    connect(waitId, reminderId, 'timeout');

    const waitForeverId = addNode('waitForReply', {
      timeoutMinutes: null,
      saveReplyAsTagPrefix: step.saveReplyAsTagPrefix?.trim() || null,
    });
    connect(reminderId, waitForeverId, null);

    setPending([
      { source: waitId, handle: null },
      { source: waitForeverId, handle: null },
    ]);
  }

  function appendQualificationStep(step: QualificationStep) {
    if (step.kind === 'message') {
      const id = addNode('sendMessage', { text: step.text });
      attach(id);
      return;
    }
    appendQuestionStep(step);
  }

  return { addNode, connect, attach, appendQualificationStep, getResult: (): FlowDefinition => ({ nodes, edges }) };
}

/**
 * Monta um FlowDefinition a partir do Formulário Avançado (`src/app/page.tsx`) + as perguntas
 * de qualificação do card novo. Só é chamado quando `questions.length > 0` — automações sem
 * perguntas continuam salvando pelo caminho legado (colunas soltas), sem passar por aqui.
 * Mapeia direto dos mesmos campos que os cards do form já usam (trigger/públicas/mensagem
 * inicial/link/sequência de follow-ups), na mesma ordem visual dos cards.
 */
export function buildFlowFromAdvancedForm(form: Automation, questions: QualificationStep[]): FlowDefinition {
  const b = createFlowBuilder();

  const triggerId = b.addNode('trigger', {
    triggerTypes: form.triggers as any,
    keywords: form.keywords,
    match_type: form.match_type,
    specific_post_id: form.specific_post_id ?? null,
    specific_story_id: form.specific_story_id ?? null,
    publicReplies: form.public_replies?.length ? form.public_replies : null,
  });
  b.attach(triggerId);

  const initialId = b.addNode('sendMessage', {
    text: form.welcome_dm,
    quick_reply_button: form.quick_reply_button ?? null,
  });
  b.attach(initialId);

  for (const step of questions) {
    b.appendQualificationStep(step);
  }

  const linkId = b.addNode('sendMessage', {
    text: form.link_text || 'Aqui está o seu link:',
    link_url: form.link_url ?? null,
    link_button_label: form.link_button_label ?? null,
  });
  b.attach(linkId);

  for (const followup of form.followups || []) {
    const delayId = b.addNode('delay', { delayMinutes: Math.max(0, followup.delay_minutes) });
    b.attach(delayId);

    const msgId = b.addNode('sendMessage', {
      text: followup.text,
      link_url: followup.link_url || null,
      link_button_label: followup.link_button_label || null,
    });
    b.attach(msgId);
  }

  return b.getResult();
}
