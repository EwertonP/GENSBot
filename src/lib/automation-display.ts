import type { Automation } from '@/types/automation';
import type { TriggerNodeConfig } from '@/types/flow';

export interface EffectiveTrigger {
  triggers: string[];
  specific_post_id: string | null;
  specific_story_id: string | null;
}

/**
 * Resolve o gatilho "de verdade" de uma automação. Automações editadas pelo
 * canvas visual guardam a config real dentro do nó `trigger` do
 * flow_definition — as colunas de topo (triggers/specific_post_id) não são
 * sincronizadas quando se salva por lá. Sem flow_definition, os campos de
 * topo (modelo legado) são a fonte da verdade.
 */
export function getEffectiveTrigger(auto: Automation): EffectiveTrigger {
  const triggerNode = auto.flow_definition?.nodes.find((n) => n.type === 'trigger');
  if (triggerNode) {
    const data = triggerNode.data as TriggerNodeConfig;
    return {
      triggers: data.triggerTypes,
      specific_post_id: data.specific_post_id ?? null,
      specific_story_id: data.specific_story_id ?? null,
    };
  }
  return {
    triggers: auto.triggers,
    specific_post_id: auto.specific_post_id ?? null,
    specific_story_id: auto.specific_story_id ?? null,
  };
}
