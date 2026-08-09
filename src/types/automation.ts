export interface Followup {
  id: string;
  delay_minutes: number;
  text: string;
  link_url?: string | null;
  link_text?: string | null;
  link_button_label?: string | null;
}

export interface Automation {
  id?: string;
  name: string;
  active: boolean;
  triggers: string[];
  keywords: string[];
  match_type: 'contains' | 'exact' | 'any';
  specific_post_id?: string | null;
  /** Story próprio ao qual o gatilho "Respostas aos Stories" fica restrito. */
  specific_story_id?: string | null;
  public_replies: string[];
  welcome_dm: string;
  quick_reply_button?: string | null;
  link_text?: string | null;
  link_button_label?: string | null;
  link_url?: string | null;
  reminder_text?: string | null;
  reminder_delay_minutes?: number | null;
  ask_email?: boolean;
  ask_phone?: boolean;
  webhook_url?: string | null;
  followups?: Followup[];
  created_at?: string;
  /** Só é preenchido depois da primeira edição — pode vir nulo. */
  updated_at?: string | null;
  /** Presente = automação já migrada para o canvas visual (ver src/types/flow.ts). Null/ausente = modelo legado (campos acima). */
  flow_definition?: import('./flow').FlowDefinition | null;
  flow_version?: number;
}
