export type FormFieldType =
  | 'welcome'
  | 'text'
  | 'textarea'
  | 'whatsapp'
  | 'email'
  | 'choice'
  | 'rating'
  | 'nps'
  | 'date'
  | 'file'
  | 'terms'
  | 'thank_you';

export interface FormOption {
  id: string;
  label: string;
  pular_para?: string | null; // ID do campo para o qual pular
}

export interface FormLogicRule {
  id: string;
  campo_id: string;
  operador: 'equals' | 'not_equals' | 'contains' | 'is_filled';
  valor: string;
  pular_para: string; // ID do campo destino
}

export interface FormField {
  id: string;
  form_id: string;
  tipo: FormFieldType;
  label: string;
  descricao?: string | null;
  placeholder?: string | null;
  obrigatorio: boolean;
  ordem: number;
  opcoes?: FormOption[];
  multipla_escolha?: boolean; // Para campo 'choice'
  logica_pulo?: FormLogicRule[];
  validacoes?: {
    min?: number;
    max?: number;
    regex?: string;
  };
  created_at?: string;
}

export interface FormTemaConfig {
  cor_primaria: string;
  cor_fundo: string;
  cor_texto: string;
  cor_card: string;
  modo?: 'auto' | 'light' | 'dark';
  logo_url?: string | null;
  fonte?: 'inter' | 'jakarta' | 'playfair' | 'outfit';
  bg_imagem_url?: string | null;
  arredondamento?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export interface Form {
  id: string;
  user_id?: string | null;
  cliente_id?: string | null;
  slug: string;
  titulo: string;
  descricao?: string | null;
  publicado: boolean;
  tema_config: FormTemaConfig;
  notificacao_whatsapp_numero?: string | null;
  notificacao_email?: string | null;
  redirect_url?: string | null;
  tags_padrao?: string[];
  created_at: string;
  updated_at: string;
  fields?: FormField[];
  total_respostas?: number;
  cliente_nome?: string | null;
}

export interface FormResponse {
  id: string;
  form_id: string;
  cliente_id?: string | null;
  lead_id?: string | null;
  respostas: Record<string, any>;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  ip_hash?: string | null;
  tempo_preenchimento_segundos?: number;
  created_at: string;
}
