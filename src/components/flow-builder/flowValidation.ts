import type { FlowDefinition } from '@/types/flow';

export interface FlowValidationIssue {
  nodeId?: string;
  message: string;
}

/** Validações antes de salvar um flow_definition pelo canvas — não bloqueia o motor de execução, só a UI. */
export function validateFlow(flow: FlowDefinition): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];

  const triggerNodes = flow.nodes.filter((n) => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    issues.push({ message: 'O fluxo precisa de um nó de gatilho (trigger).' });
  } else if (triggerNodes.length > 1) {
    issues.push({ message: 'Só é permitido um nó de gatilho por automação.' });
  }

  for (const node of flow.nodes) {
    const outgoing = flow.edges.filter((e) => e.source === node.id);

    if (node.type === 'condition') {
      const hasTrue = outgoing.some((e) => (e.sourceHandle ?? null) === 'true');
      const hasFalse = outgoing.some((e) => (e.sourceHandle ?? null) === 'false');
      if (!hasTrue || !hasFalse) {
        issues.push({ nodeId: node.id, message: 'Nó de condição precisa ter os dois ramos (verdadeiro e falso) conectados.' });
      }
    }

    if (node.type === 'delay') {
      const minutes = (node.data as { delayMinutes?: number }).delayMinutes;
      if (minutes === undefined || minutes < 0) {
        issues.push({ nodeId: node.id, message: 'Nó de espera precisa de um tempo de atraso válido (>= 0 minutos).' });
      }
    }

    if (node.type === 'sendMessage' && !(node.data as { text?: string }).text?.trim()) {
      issues.push({ nodeId: node.id, message: 'Nó de mensagem precisa de um texto.' });
    }
  }

  const reachable = new Set<string>();
  if (triggerNodes[0]) {
    const stack = [triggerNodes[0].id];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      flow.edges.filter((e) => e.source === id).forEach((e) => stack.push(e.target));
    }
  }
  for (const node of flow.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({ nodeId: node.id, message: `Nó "${node.id}" está desconectado do gatilho — nunca vai ser executado.` });
    }
  }

  return issues;
}
