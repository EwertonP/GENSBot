import type { FlowDefinition, FlowNode, FlowEdge, FlowNodeType, TriggerNodeConfig } from '@/types/flow';

export interface WizardMessageStep {
  kind: 'message';
  text: string;
}

export interface WizardQuestionStep {
  kind: 'question';
  text: string;
  /** 1 a 3 botões de resposta rápida. */
  buttons: string[];
  /** Minutos até mandar o lembrete único; depois disso a pergunta volta a esperar pra sempre. */
  timeoutMinutes: number;
  reminderText: string;
}

export type WizardStep = WizardMessageStep | WizardQuestionStep;

export interface WizardState {
  trigger: {
    triggerTypes: TriggerNodeConfig['triggerTypes'];
    keywords: string[];
    match_type: TriggerNodeConfig['match_type'];
    specific_post_id?: string | null;
    specific_story_id?: string | null;
  };
  /** Só usado quando 'comment' está entre os tipos de gatilho. */
  publicReplies: string[];
  initialMessage: string;
  steps: WizardStep[];
  link: { url: string; text: string; buttonLabel: string };
  followup: { enabled: boolean; delayMinutes: number; text: string } | null;
}

const DEFAULT_REMINDER = 'Oi! Ainda estou por aqui, fico à disposição pra continuar quando você puder. 🙂';
const DEFAULT_TIMEOUT_MINUTES = 720;

function makeIdFactory() {
  let counter = 0;
  return (type: FlowNodeType) => {
    counter += 1;
    return `${type}-wizard-${counter}`;
  };
}

/**
 * Monta um FlowDefinition completo a partir das respostas do assistente guiado.
 * Reaproveita só os nós que já existem no motor (trigger/sendMessage/waitForReply/delay) —
 * nenhum node type novo. Uma pergunta com botões vira o micro-padrão descrito no plano:
 * pergunta -> espera com timeout -> (resposta: segue) / (timeout: 1 lembrete -> espera sem timeout -> segue).
 */
export function buildFlowFromWizard(state: WizardState): FlowDefinition {
  const nextId = makeIdFactory();
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const X = 250;
  const Y_STEP = 140;
  let y = 0;

  function addNode(node: Omit<FlowNode, 'position'>): string {
    nodes.push({ ...node, position: { x: X, y } });
    y += Y_STEP;
    return node.id;
  }

  function connect(sourceId: string, targetId: string, sourceHandle: string | null) {
    edges.push({ id: `e-${sourceId}-${targetId}-${sourceHandle ?? 'default'}-${edges.length}`, source: sourceId, target: targetId, sourceHandle });
  }

  // Nós que ainda precisam de um destino — todos são conectados ao próximo nó criado.
  // Uma pergunta com botões deixa DOIS pendentes (o caminho de resposta direta e o de
  // pós-lembrete), já que ambos devem seguir pro mesmo próximo passo do fluxo.
  let pending: { source: string; handle: string | null }[] = [];

  function attach(targetId: string) {
    for (const p of pending) connect(p.source, targetId, p.handle);
    pending = [{ source: targetId, handle: null }];
  }

  // 1. Trigger
  const triggerId = nextId('trigger');
  addNode({
    id: triggerId,
    type: 'trigger',
    data: {
      triggerTypes: state.trigger.triggerTypes,
      keywords: state.trigger.keywords,
      match_type: state.trigger.match_type,
      specific_post_id: state.trigger.specific_post_id ?? null,
      specific_story_id: state.trigger.specific_story_id ?? null,
      publicReplies: state.trigger.triggerTypes.includes('comment') && state.publicReplies.length ? state.publicReplies : null,
    },
  });
  pending = [{ source: triggerId, handle: null }];

  // 2. Mensagem inicial (sempre presente)
  const initialId = nextId('sendMessage');
  addNode({ id: initialId, type: 'sendMessage', data: { text: state.initialMessage } });
  attach(initialId);

  // 3. Passos (mensagens simples ou perguntas com botões)
  for (const step of state.steps) {
    if (step.kind === 'message') {
      const id = nextId('sendMessage');
      addNode({ id, type: 'sendMessage', data: { text: step.text } });
      attach(id);
      continue;
    }

    const questionMsgId = nextId('sendMessage');
    addNode({ id: questionMsgId, type: 'sendMessage', data: { text: step.text, quick_reply_buttons: step.buttons.slice(0, 3) } });
    attach(questionMsgId);

    const waitId = nextId('waitForReply');
    addNode({ id: waitId, type: 'waitForReply', data: { timeoutMinutes: step.timeoutMinutes > 0 ? step.timeoutMinutes : DEFAULT_TIMEOUT_MINUTES } });
    connect(questionMsgId, waitId, null);

    const reminderId = nextId('sendMessage');
    addNode({ id: reminderId, type: 'sendMessage', data: { text: step.reminderText?.trim() || DEFAULT_REMINDER } });
    connect(waitId, reminderId, 'timeout');

    const waitForeverId = nextId('waitForReply');
    addNode({ id: waitForeverId, type: 'waitForReply', data: { timeoutMinutes: null } });
    connect(reminderId, waitForeverId, null);

    pending = [
      { source: waitId, handle: null },
      { source: waitForeverId, handle: null },
    ];
  }

  // 4. Link final
  const linkId = nextId('sendMessage');
  addNode({
    id: linkId,
    type: 'sendMessage',
    data: { text: state.link.text || 'Aqui está o seu link:', link_url: state.link.url, link_button_label: state.link.buttonLabel },
  });
  attach(linkId);

  // 5. Follow-up opcional
  if (state.followup?.enabled) {
    const delayId = nextId('delay');
    addNode({ id: delayId, type: 'delay', data: { delayMinutes: Math.max(0, state.followup.delayMinutes) } });
    attach(delayId);

    const followupMsgId = nextId('sendMessage');
    addNode({ id: followupMsgId, type: 'sendMessage', data: { text: state.followup.text } });
    attach(followupMsgId);
  }

  return { nodes, edges };
}
