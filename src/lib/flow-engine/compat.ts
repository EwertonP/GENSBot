import type { Automation } from '@/types/automation';
import type { FlowDefinition, FlowNode, FlowEdge } from '@/types/flow';

/**
 * Traduz uma automação do modelo legado (form linear) para um FlowDefinition
 * equivalente, EM MEMÓRIA — usado só pelo canvas visual (Fase 3) pra
 * pré-popular a edição de uma automação ainda sem `flow_definition`.
 *
 * NÃO é usado no caminho de execução do webhook: automações legadas
 * continuam rodando pelo código original em
 * src/app/api/webhook/route.ts até o usuário abrir e salvar essa
 * automação pelo canvas (só aí `flow_definition` passa a existir de
 * verdade e o motor novo assume).
 *
 * Limitação conhecida: `ask_email`/`ask_phone` legados capturam a
 * PRÓXIMA mensagem livre do contato (máquina de estados em
 * `contacts.conversation_state`) — o nó `action`/`set_field` do MVP não
 * tem esse comportamento de "aguardar resposta". A tradução abaixo cria
 * o nó como um placeholder editável, não uma captura funcional; ajustar
 * manualmente a automação convertida antes de publicar pelo canvas.
 */
export function legacyAutomationToFlowDefinition(auto: Automation): FlowDefinition {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let y = 0;
  const stepY = 150;
  let previousId: string | null = null;

  const addNode = (node: FlowNode) => {
    nodes.push(node);
    if (previousId) edges.push({ id: `${previousId}->${node.id}`, source: previousId, target: node.id });
    previousId = node.id;
    y += stepY;
  };

  addNode({
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 0, y },
    data: {
      triggerTypes: ((auto.triggers as unknown) as ('dm' | 'story' | 'story_mention' | 'comment')[]) || ['dm'],
      keywords: auto.keywords || [],
      match_type: auto.match_type || 'contains',
      specific_post_id: auto.specific_post_id ?? null,
      specific_story_id: auto.specific_story_id ?? null,
    },
  });

  addNode({
    id: 'send-welcome',
    type: 'sendMessage',
    position: { x: 0, y },
    data: {
      text: auto.welcome_dm,
      quick_reply_button: auto.quick_reply_button ?? null,
    },
  });

  if (auto.ask_email) {
    addNode({
      id: 'action-ask-email',
      type: 'action',
      position: { x: 0, y },
      data: { actionType: 'set_field', field: 'email', value: '' },
    });
  }
  if (auto.ask_phone) {
    addNode({
      id: 'action-ask-phone',
      type: 'action',
      position: { x: 0, y },
      data: { actionType: 'set_field', field: 'phone', value: '' },
    });
  }

  if (auto.link_url || auto.link_text) {
    addNode({
      id: 'send-link',
      type: 'sendMessage',
      position: { x: 0, y },
      data: {
        text: auto.link_text || 'Aqui está o seu link:',
        link_url: auto.link_url ?? null,
        link_button_label: auto.link_button_label ?? null,
      },
    });
  }

  (auto.followups || []).forEach((f, i) => {
    addNode({
      id: `delay-${i}`,
      type: 'delay',
      position: { x: 0, y },
      data: { delayMinutes: f.delay_minutes || 1 },
    });
    addNode({
      id: `send-followup-${i}`,
      type: 'sendMessage',
      position: { x: 0, y },
      data: {
        text: f.text,
        link_url: f.link_url ?? null,
        link_button_label: f.link_button_label ?? null,
      },
    });
  });

  return { nodes, edges };
}
