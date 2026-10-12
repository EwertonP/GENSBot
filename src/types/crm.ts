export type CrmStatusNegocio = 'aberto' | 'ganho' | 'perdido';
export type CrmStatus = CrmStatusNegocio;

export type CrmPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export type CrmOrigem =
  | 'manual'
  | 'instagram'
  | 'formulario'
  | 'webhook_ads'
  | 'indicacao'
  | 'presencial'
  | 'ligacao'
  | 'google'
  | 'site'
  | 'whatsapp'
  | 'outros';

export type CrmTipoAtividade =
  | 'nota'
  | 'whatsapp'
  | 'ligacao'
  | 'reuniao'
  | 'mudanca_estagio'
  | 'criacao'
  | 'ganho'
  | 'perda'
  | 'tarefa';

export type CrmTipoTarefa = 'whatsapp' | 'ligacao' | 'email' | 'reuniao' | 'outros';

export interface CrmEstagio {
  id: string;
  pipeline_id: string;
  nome: string;
  cor: string;
  ordem: number;
  tipo_conclusao: 'aberto' | 'ganho' | 'perdido';
  tipo?: 'aberto' | 'ganho' | 'perdido';
  dias_limite_estagnado: number | null;
  criado_em: string;
}

export interface CrmPipeline {
  id: string;
  agencia_id: string;
  cliente_id: string | null;
  nome: string;
  descricao: string | null;
  ordem: number;
  padrao: boolean;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  estagios?: CrmEstagio[];
}

export interface CrmNegocio {
  id: string;
  agencia_id: string;
  cliente_id: string | null;
  pipeline_id: string;
  estagio_id: string;
  titulo: string;
  valor: number;
  moeda: string;
  status: CrmStatusNegocio;
  motivo_perda: string | null;
  data_conclusao: string | null;
  previsao_fechamento: string | null;
  probabilidade: number | null;

  // Contato
  nome_contato: string;
  telefone: string | null;
  email: string | null;
  instagram_username: string | null;
  empresa: string | null;
  cargo: string | null;

  // Vínculos
  contact_id: string | null;
  form_response_id: string | null;
  origem: CrmOrigem;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;

  // Gestão
  responsavel_id: string | null;
  prioridade: CrmPrioridade;
  tags: string[];
  ordem_no_estagio: number;
  ultimo_contato_em: string | null;
  criado_em: string;
  atualizado_em: string;

  // Relações em joins
  responsavel?: { id: string; nome: string; email: string; cargo: string | null } | null;
  estagio?: CrmEstagio | null;
  cliente?: { id: string; nome: string; cor: string | null } | null;
}

export interface CrmAtividade {
  id: string;
  negocio_id: string;
  agencia_id: string;
  membro_id: string | null;
  tipo: CrmTipoAtividade;
  descricao: string;
  dados_extras: Record<string, any> | null;
  criado_em: string;
  membro?: { id: string; nome: string } | null;
}

export interface CrmTarefa {
  id: string;
  negocio_id: string;
  agencia_id: string;
  responsavel_id: string | null;
  titulo: string;
  tipo: CrmTipoTarefa;
  prazo: string;
  concluida: boolean;
  concluida_em: string | null;
  criado_em: string;
  responsavel?: { id: string; nome: string } | null;
}

export interface CrmMetricasPipeline {
  totalNegocios: number;
  negociosAbertos: number;
  negociosGanhos: number;
  negociosPerdidos: number;
  valorTotalAberto: number;
  valorTotalGanho: number;
  taxaConversao: number; // Porcentagem de 0 a 100
  ticketMedio: number;
}

export type CrmMetricas = CrmMetricasPipeline;
