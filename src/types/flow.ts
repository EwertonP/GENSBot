import type { Followup } from './automation';

/** Os 5 tipos de nó do MVP do canvas visual. `aiResponse` fica fora por decisão de escopo. */
export type FlowNodeType = 'trigger' | 'sendMessage' | 'condition' | 'delay' | 'action';

export interface TriggerNodeConfig {
  triggerTypes: ('dm' | 'story' | 'story_mention' | 'comment')[];
  keywords: string[];
  match_type: 'contains' | 'exact' | 'any';
  specific_post_id?: string | null;
  specific_story_id?: string | null;
}

export interface SendMessageNodeConfig {
  text: string;
  quick_reply_button?: string | null;
  link_url?: string | null;
  link_button_label?: string | null;
  /** Quando presente, ao alcançar este nó os passos da sequência referenciada também são agendados. */
  sequence_id?: string | null;
}

export interface ConditionNodeConfig {
  conditionType: 'keyword' | 'tag' | 'contact_field';
  // conditionType === 'keyword'
  keywords?: string[];
  match_type?: 'contains' | 'exact' | 'any';
  // conditionType === 'tag'
  tag?: string;
  tagPresence?: 'has' | 'not_has';
  // conditionType === 'contact_field'
  field?: 'email' | 'phone' | 'name' | 'username';
  operator?: 'equals' | 'not_empty' | 'is_empty';
  value?: string;
}

export interface DelayNodeConfig {
  delayMinutes: number;
}

export interface ActionNodeConfig {
  actionType: 'add_tag' | 'remove_tag' | 'set_field';
  tag?: string;
  field?: 'email' | 'phone' | 'name';
  value?: string;
}

export type FlowNodeConfig =
  | { type: 'trigger'; data: TriggerNodeConfig }
  | { type: 'sendMessage'; data: SendMessageNodeConfig }
  | { type: 'condition'; data: ConditionNodeConfig }
  | { type: 'delay'; data: DelayNodeConfig }
  | { type: 'action'; data: ActionNodeConfig };

/** Nó persistido em automations.flow_definition — espelha a shape de Node do @xyflow/react sem acoplar ao pacote. */
export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeConfig['data'];
}

/** Aresta persistida — sourceHandle 'true'/'false' identifica os ramos de um nó `condition`. */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type { Followup };
