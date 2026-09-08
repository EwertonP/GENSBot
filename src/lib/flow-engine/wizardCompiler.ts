import type { FlowDefinition, FlowNode, FlowEdge, FlowNodeType, TriggerNodeConfig, SendMessageNodeConfig, WaitForReplyNodeConfig, DelayNodeConfig } from '@/types/flow';
import type { Automation, Followup } from '@/types/automation';

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

interface WaitConfig {
  timeoutMinutes?: number | null;
  reminderText?: string;
  saveReplyAsTagPrefix?: string;
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
   * Envia uma mensagem e, se `wait` for informado, pausa esperando resposta —
   * com lembrete + segunda espera sem prazo quando `wait.timeoutMinutes` é
   * um número positivo, ou só uma espera sem prazo (sem lembrete) quando é
   * null/0. Sem `wait`, a mensagem só segue direto pro próximo nó anexado.
   * Usado tanto pela mensagem inicial (Passo 3) quanto pelas perguntas de
   * qualificação (Passo 4) — mesma forma, decompilada de volta por
   * `decompileFlow` abaixo.
   */
  function appendMessageStep(text: string, buttons: string[], wait?: WaitConfig | null) {
    const msgId = addNode('sendMessage', { text, quick_reply_buttons: buttons.filter(Boolean).slice(0, 3) });
    attach(msgId);
    if (!wait) return;

    const hasTimeout = !!(wait.timeoutMinutes && wait.timeoutMinutes > 0);
    const waitId = addNode('waitForReply', {
      timeoutMinutes: hasTimeout ? wait.timeoutMinutes : null,
      saveReplyAsTagPrefix: wait.saveReplyAsTagPrefix?.trim() || null,
    });
    connect(msgId, waitId, null);

    if (!hasTimeout) {
      setPending([{ source: waitId, handle: null }]);
      return;
    }

    const reminderId = addNode('sendMessage', { text: wait.reminderText?.trim() || DEFAULT_REMINDER });
    connect(waitId, reminderId, 'timeout');

    const waitForeverId = addNode('waitForReply', {
      timeoutMinutes: null,
      saveReplyAsTagPrefix: wait.saveReplyAsTagPrefix?.trim() || null,
    });
    connect(reminderId, waitForeverId, null);

    setPending([
      { source: waitId, handle: null },
      { source: waitForeverId, handle: null },
    ]);
  }

  function appendQualificationStep(step: QualificationStep) {
    if (step.kind === 'message') {
      appendMessageStep(step.text, []);
      return;
    }
    appendMessageStep(step.text, step.buttons, {
      timeoutMinutes: step.timeoutMinutes > 0 ? step.timeoutMinutes : DEFAULT_TIMEOUT_MINUTES,
      reminderText: step.reminderText,
      saveReplyAsTagPrefix: step.saveReplyAsTagPrefix,
    });
  }

  return { addNode, connect, attach, appendMessageStep, appendQualificationStep, getResult: (): FlowDefinition => ({ nodes, edges }) };
}

/**
 * Monta um FlowDefinition a partir do Formulário Avançado (`src/app/page.tsx`) + as perguntas
 * de qualificação do card novo. Só é chamado quando `questions.length > 0` (ou quando a
 * automação já era baseada em flow antes da edição — ver `handleSaveAutomation`) — automações
 * novas sem perguntas continuam salvando pelo caminho legado (colunas soltas), sem passar por
 * aqui. Mapeia direto dos mesmos campos que os cards do form já usam (trigger/públicas/mensagem
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

  b.appendMessageStep(
    form.welcome_dm,
    form.quick_reply_button ? [form.quick_reply_button] : [],
    form.quick_reply_button
      ? { timeoutMinutes: form.welcome_dm_timeout_minutes ?? null, reminderText: form.welcome_dm_reminder_text ?? undefined }
      : null,
  );

  for (const step of questions) {
    b.appendQualificationStep(step);
  }

  b.appendMessageStep(form.link_text || 'Aqui está o seu link:', [], null);
  // appendMessageStep não aceita link_url/link_button_label (são exclusivos do nó de link) —
  // preenche direto no nó que acabou de ser criado.
  const linkNode = b.getResult().nodes.at(-1)!;
  (linkNode.data as SendMessageNodeConfig).link_url = form.link_url ?? null;
  (linkNode.data as SendMessageNodeConfig).link_button_label = form.link_button_label ?? null;

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

// ---------------------------------------------------------------------------
// Decompilador: caminho inverso, de flow_definition pra Formulário Avançado.
// ---------------------------------------------------------------------------

export interface DecompiledForm {
  triggers: string[];
  keywords: string[];
  match_type: 'contains' | 'exact' | 'any';
  specific_post_id: string | null;
  specific_story_id: string | null;
  public_replies: string[];
  welcome_dm: string;
  quick_reply_button: string | null;
  welcome_dm_timeout_minutes: number | null;
  welcome_dm_reminder_text: string | null;
  link_text: string | null;
  link_url: string | null;
  link_button_label: string | null;
  followups: Followup[];
}

export type DecompileResult =
  | { compatible: true; form: DecompiledForm; questions: QualificationStep[] }
  | { compatible: false; reason: string };

function incompatible(reason: string): DecompileResult {
  return { compatible: false, reason };
}

/**
 * Tenta reconstruir os campos do Formulário Avançado + a lista de perguntas de
 * qualificação a partir de um `flow_definition` já salvo — o caminho inverso de
 * `buildFlowFromAdvancedForm`. Só funciona pra fluxos "lineares" (exatamente a
 * forma que o próprio formulário produz: gatilho -> mensagem inicial (+espera
 * opcional) -> perguntas (+espera) -> link -> follow-ups). Um fluxo com
 * ramificação condicional, múltiplos gatilhos, ou qualquer coisa fora desse
 * formato retorna `compatible: false` — essas automações só dá pra editar
 * pelo Canvas, que suporta o grafo completo.
 */
export function decompileFlow(flow: FlowDefinition): DecompileResult {
  const findNode = (id: string | null | undefined): FlowNode | undefined => (id ? flow.nodes.find((n) => n.id === id) : undefined);
  const outgoingAll = (nodeId: string) => flow.edges.filter((e) => e.source === nodeId);

  const trigger = flow.nodes.find((n) => n.type === 'trigger');
  if (!trigger) return incompatible('Fluxo sem nó de gatilho.');
  const triggerOuts = outgoingAll(trigger.id);
  if (triggerOuts.length !== 1) return incompatible('O gatilho tem mais de uma saída — isso só é editável pelo Canvas.');

  const triggerData = trigger.data as TriggerNodeConfig;

  // Lê um nó de mensagem a partir de `nodeId` e, se ele tiver uma espera (com ou
  // sem lembrete de timeout) logo em seguida, consome a cadeia inteira também.
  function readMessageStep(nodeId: string): { node: FlowNode; wait: WaitConfig | null; nextId: string | null } | { error: string } {
    const node = findNode(nodeId);
    if (!node || node.type !== 'sendMessage') return { error: `Esperava um nó de mensagem em "${nodeId}".` };
    const outs = outgoingAll(node.id);
    if (outs.length === 0) return { node, wait: null, nextId: null };
    if (outs.length > 1) return { error: `A mensagem "${node.id}" tem mais de uma saída — isso só é editável pelo Canvas.` };

    const next = findNode(outs[0].target);
    if (next?.type !== 'waitForReply') {
      return { node, wait: null, nextId: outs[0].target };
    }

    const waitNode = next;
    const waitData = waitNode.data as WaitForReplyNodeConfig;
    const replyEdge = flow.edges.find((e) => e.source === waitNode.id && (e.sourceHandle ?? null) !== 'timeout');
    const timeoutEdge = flow.edges.find((e) => e.source === waitNode.id && e.sourceHandle === 'timeout');
    if (!replyEdge) return { error: `O nó de espera "${waitNode.id}" não tem saída de resposta.` };

    if (!timeoutEdge) {
      return {
        node,
        wait: { timeoutMinutes: null, saveReplyAsTagPrefix: waitData.saveReplyAsTagPrefix || undefined },
        nextId: replyEdge.target,
      };
    }

    const reminderNode = findNode(timeoutEdge.target);
    if (reminderNode?.type !== 'sendMessage') return { error: `O timeout de "${waitNode.id}" não leva a uma mensagem de lembrete.` };
    const reminderOuts = outgoingAll(reminderNode.id);
    if (reminderOuts.length !== 1) return { error: `A mensagem de lembrete "${reminderNode.id}" tem saídas inesperadas.` };
    const waitForeverNode = findNode(reminderOuts[0].target);
    if (waitForeverNode?.type !== 'waitForReply') return { error: `O lembrete "${reminderNode.id}" não leva a uma segunda espera.` };
    const waitForeverReplyEdge = flow.edges.find((e) => e.source === waitForeverNode.id && (e.sourceHandle ?? null) !== 'timeout');
    if (!waitForeverReplyEdge) return { error: `A segunda espera "${waitForeverNode.id}" não tem saída de resposta.` };
    if (waitForeverReplyEdge.target !== replyEdge.target) {
      return { error: `As duas esperas depois de "${node.id}" levam a lugares diferentes — isso só é editável pelo Canvas.` };
    }

    return {
      node,
      wait: {
        timeoutMinutes: waitData.timeoutMinutes ?? null,
        reminderText: (reminderNode.data as SendMessageNodeConfig).text,
        saveReplyAsTagPrefix: waitData.saveReplyAsTagPrefix || undefined,
      },
      nextId: replyEdge.target,
    };
  }

  // 1. Mensagem inicial (+ espera opcional).
  const welcomeResult = readMessageStep(triggerOuts[0].target);
  if ('error' in welcomeResult) return incompatible(welcomeResult.error);
  const welcomeData = welcomeResult.node.data as SendMessageNodeConfig;
  const welcomeButtons = welcomeData.quick_reply_buttons?.length ? welcomeData.quick_reply_buttons : welcomeData.quick_reply_button ? [welcomeData.quick_reply_button] : [];
  if (welcomeButtons.length > 1) return incompatible('A mensagem inicial tem mais de um botão — o Formulário Avançado só suporta um. Edite pelo Canvas.');
  if (welcomeResult.nextId === null) return incompatible('O fluxo termina na mensagem inicial, sem link — isso só é editável pelo Canvas.');

  // 2. Perguntas de qualificação, até achar o nó de link (uma mensagem sem
  // espera que termina o fluxo ou é seguida por um follow-up).
  const questions: QualificationStep[] = [];
  let cursorId: string | null = welcomeResult.nextId;
  let linkNode: FlowNode | null = null;
  let afterLinkId: string | null = null;

  while (cursorId) {
    const node = findNode(cursorId);
    if (!node) return incompatible(`Fluxo quebrado: nó "${cursorId}" não existe.`);
    if (node.type !== 'sendMessage') return incompatible(`Nó do tipo "${node.type}" fora de lugar — isso só é editável pelo Canvas.`);

    const result = readMessageStep(cursorId);
    if ('error' in result) return incompatible(result.error);

    const isLink = !result.wait && (result.nextId === null || findNode(result.nextId)?.type === 'delay');
    if (isLink) {
      linkNode = result.node;
      afterLinkId = result.nextId;
      break;
    }

    if (result.wait) {
      const data = result.node.data as SendMessageNodeConfig;
      questions.push({
        kind: 'question',
        text: data.text,
        buttons: data.quick_reply_buttons || [],
        timeoutMinutes: result.wait.timeoutMinutes ?? 0,
        reminderText: result.wait.reminderText || '',
        saveReplyAsTagPrefix: result.wait.saveReplyAsTagPrefix,
      });
    } else {
      questions.push({ kind: 'message', text: (result.node.data as SendMessageNodeConfig).text });
    }

    if (result.nextId === null) return incompatible('O fluxo termina antes de chegar a um nó de link.');
    cursorId = result.nextId;
  }

  if (!linkNode) return incompatible('Não encontrei o nó de link do fluxo.');
  const linkData = linkNode.data as SendMessageNodeConfig;

  // 3. Follow-ups: pares delay -> mensagem (sem espera) até acabar o fluxo.
  const followups: Followup[] = [];
  let followupCursor = afterLinkId;
  while (followupCursor) {
    const delayNode = findNode(followupCursor);
    if (!delayNode) return incompatible(`Fluxo quebrado: nó "${followupCursor}" não existe.`);
    if (delayNode.type !== 'delay') return incompatible(`Esperava um nó de espera fixa (delay) em "${followupCursor}" — isso só é editável pelo Canvas.`);
    const delayOuts = outgoingAll(delayNode.id);
    if (delayOuts.length !== 1) return incompatible(`O delay "${delayNode.id}" tem saídas inesperadas.`);
    const msgNode = findNode(delayOuts[0].target);
    if (msgNode?.type !== 'sendMessage') return incompatible(`O delay "${delayNode.id}" não leva a uma mensagem.`);
    const msgOuts = outgoingAll(msgNode.id);
    if (msgOuts.length > 1) return incompatible(`O follow-up "${msgNode.id}" tem saídas inesperadas.`);

    const msgData = msgNode.data as SendMessageNodeConfig;
    followups.push({
      id: msgNode.id,
      delay_minutes: (delayNode.data as DelayNodeConfig).delayMinutes ?? 0,
      text: msgData.text,
      link_url: msgData.link_url ?? null,
      link_button_label: msgData.link_button_label ?? null,
    });
    followupCursor = msgOuts[0]?.target ?? null;
  }

  return {
    compatible: true,
    form: {
      triggers: triggerData.triggerTypes,
      keywords: triggerData.keywords,
      match_type: triggerData.match_type,
      specific_post_id: triggerData.specific_post_id ?? null,
      specific_story_id: triggerData.specific_story_id ?? null,
      public_replies: triggerData.publicReplies || [],
      welcome_dm: welcomeData.text,
      quick_reply_button: welcomeButtons[0] ?? null,
      welcome_dm_timeout_minutes: welcomeResult.wait?.timeoutMinutes ?? null,
      welcome_dm_reminder_text: welcomeResult.wait?.reminderText ?? null,
      link_text: linkData.text,
      link_url: linkData.link_url ?? null,
      link_button_label: linkData.link_button_label ?? null,
      followups,
    },
    questions,
  };
}
