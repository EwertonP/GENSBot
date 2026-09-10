import type { Followup } from './automation';

/** Os tipos de nó do canvas visual. `aiResponse` fica fora por decisão de escopo. */
export type FlowNodeType = 'trigger' | 'sendMessage' | 'condition' | 'delay' | 'action' | 'waitForReply';

export interface TriggerNodeConfig {
  triggerTypes: ('dm' | 'story' | 'story_mention' | 'comment')[];
  keywords: string[];
  match_type: 'contains' | 'exact' | 'any';
  specific_post_id?: string | null;
  specific_story_id?: string | null;
  /** Respostas públicas no comentário (sorteia uma) quando o trigger 'comment' bate. Só se aplica a esse tipo de gatilho. */
  publicReplies?: string[] | null;
}

export interface SendMessageNodeConfig {
  text: string;
  /** @deprecated use `quick_reply_buttons` — mantido só como fallback de leitura pra automações já salvas com esse campo. */
  quick_reply_button?: string | null;
  /** Até 3 botões de resposta rápida. Quando presente, tem prioridade sobre `quick_reply_button`. */
  quick_reply_buttons?: string[] | null;
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

export interface WaitForReplyNodeConfig {
  /** Minutos até desistir de esperar e seguir pelo ramo "sem resposta"; null/0 = espera para sempre (sem esse ramo). */
  timeoutMinutes?: number | null;
  /** Grava a resposta livre como tag do contato (prefixo opcional), pra aparecer no CRM/listagem mesmo sem branching. */
  saveReplyAsTagPrefix?: string | null;
  /** Grava a resposta livre num campo do contato. 'email'/'phone'/'name' vão pras colunas reais;
   * qualquer outro nome (ex: "regiao", "idade") vira uma chave dentro de `contacts.flow_state`
   * (jsonb) — não precisa de coluna nova no banco pra cada pergunta de qualificação nova. */
  saveReplyToField?: string | null;
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
  | { type: 'action'; data: ActionNodeConfig }
  | { type: 'waitForReply'; data: WaitForReplyNodeConfig };

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
