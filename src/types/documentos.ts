export type TipoDocumento = 'proposta' | 'contrato';

export type CategoriaDocumento =
  | 'social_media'
  | 'trafego_pago'
  | 'combo'
  | 'marketing_360'
  | 'conteudo'
  | 'audiovisual'
  | 'branding'
  | 'sites'
  | 'consultoria';

export type StatusProposta = 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'vencida';

export type StatusContrato =
  | 'rascunho'
  | 'aguardando_assinatura'
  | 'assinado_cliente'
  | 'assinado'
  | 'cancelado';

export interface VariavelDocumento {
  chave: string;
  label: string;
  exemplo: string;
}

export interface ItemDocumento {
  id: string;
  descricao: string;
  quantidade?: number;
  valor_unitario?: number;
  total?: number;
}

export interface ModeloDocumento {
  id: string;
  agencia_id?: string | null;
  tipo: TipoDocumento;
  categoria: CategoriaDocumento;
  titulo: string;
  descricao?: string | null;
  conteudo_html: string;
  variaveis: VariavelDocumento[];
  padrao: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Proposta {
  id: string;
  agencia_id: string;
  modelo_id?: string | null;
  cliente_id?: string | null;
  lead_id?: string | null;
  titulo: string;
  status: StatusProposta;
  valor_mensal: number;
  valor_setup: number;
  validade?: string | null;
  conteudo_html: string;
  conteudo_final_html?: string | null;
  hash_documento?: string | null;
  enviado_em?: string | null;
  expira_em?: string | null;
  token_publico: string;
  itens?: ItemDocumento[];
  visualizada_em?: string | null;
  aceita_em?: string | null;
  recusada_em?: string | null;
  motivo_recusa?: string | null;
  contrato_gerado_id?: string | null;
  criado_por?: string | null;
  criado_em: string;
  atualizado_em: string;
  // Joins
  cliente?: {
    id: string;
    nome: string;
    cnpj_cpf?: string | null;
    responsavel_legal?: string | null;
    endereco?: string | null;
    cor?: string | null;
  } | null;
  lead?: {
    id: string;
    titulo: string;
    nome_contato: string;
    empresa?: string | null;
    telefone?: string | null;
    email?: string | null;
  } | null;
}

export interface Contrato {
  id: string;
  agencia_id: string;
  proposta_id?: string | null;
  modelo_id?: string | null;
  cliente_id?: string | null;
  lead_id?: string | null;
  titulo: string;
  numero?: string | null;
  status: StatusContrato;
  valor_mensal: number;
  dia_vencimento?: number | null;
  data_inicio?: string | null;
  data_termino?: string | null;
  renovacao_automatica: boolean;
  conteudo_html: string;
  conteudo_final_html?: string | null;
  hash_documento?: string | null;
  enviado_em?: string | null;
  visualizado_em?: string | null;
  expira_em?: string | null;
  revogado_em?: string | null;
  token_publico: string;
  itens?: ItemDocumento[];
  assinatura_cliente_nome?: string | null;
  assinatura_cliente_doc?: string | null;
  assinatura_cliente_email?: string | null;
  assinatura_cliente_ip?: string | null;
  assinatura_cliente_data?: string | null;
  assinatura_cliente_imagem?: string | null;
  assinatura_agencia_nome?: string | null;
  assinatura_agencia_data?: string | null;
  assinatura_agencia_membro_id?: string | null;
  assinatura_agencia_ip?: string | null;
  pdf_url?: string | null;
  pdf_hash?: string | null;
  criado_por?: string | null;
  criado_em: string;
  atualizado_em: string;
  // Joins
  cliente?: {
    id: string;
    nome: string;
    cnpj_cpf?: string | null;
    responsavel_legal?: string | null;
    endereco?: string | null;
    cor?: string | null;
  } | null;
  lead?: {
    id: string;
    titulo: string;
    nome_contato: string;
    empresa?: string | null;
    telefone?: string | null;
    email?: string | null;
  } | null;
}

export interface DadosAgenciaContratada {
  id?: string;
  nome: string;
  razao_social?: string | null;
  cnpj_cpf?: string | null;
  endereco?: string | null;
  cidade_estado?: string | null;
  chave_pix?: string | null;
  telefone_contato?: string | null;
  email_contato?: string | null;
  whatsapp_envio_automatico?: boolean;
}
