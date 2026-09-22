/**
 * Módulo de tipos e funções de apoio para a Esteira de Conteúdo e Aprovação Interativa.
 */

export type TipoConteudo = 'post' | 'reel' | 'story' | 'avulso';

export type StatusConteudo =
  | 'planejamento'
  | 'copy'
  | 'criacao_arte'
  | 'revisao_arte'
  | 'em_gravacao'
  | 'em_edicao'
  | 'revisao_interna'
  | 'revisao_cliente'
  | 'agendamento'
  | 'revisao_agendamento'
  | 'pronto_publicar'
  | 'publicado'
  | 'travado';

export interface ArquivoConteudo {
  id: string;
  url: string;
  tipo: 'imagem' | 'video';
  ordem: number;
  nome?: string;
}

export interface ComentarioRevisao {
  id: string;
  autor: string;
  tipo: 'cliente' | 'equipe';
  slide_index?: number | null;
  timestamp_seconds?: number | null;
  texto: string;
  criado_em: string;
  resolvido?: boolean;
}

export interface EventoAtividade {
  id: string;
  tipo: 'status' | 'comentario';
  autor_nome: string;
  autor_id?: string | null;
  de_status?: StatusConteudo | null;
  para_status?: StatusConteudo | null;
  texto: string;
  criado_em: string;
}

export interface PrefillAgendamento {
  conteudoId: string;
  clienteNome: string;
  instagramAccountId?: string | null;
  instagramUserId?: string | null;
  kind: 'post' | 'reels' | 'story';
  mediaUrls: string[];
  caption: string;
  scheduledAt?: string | null;
  titulo: string;
  automationConfig?: import('./publish-automation').PublishAutomationConfig | null;
}

export interface ConteudoItem {
  id: string;
  agencia_id: string;
  cliente_id: string;
  tipo: TipoConteudo;
  status: StatusConteudo;
  titulo: string | null;
  legenda: string | null;
  briefing?: string | null;
  mes_referencia: string; // YYYY-MM-01
  ordem: number;
  data_programada: string | null;
  prazo?: string | null;
  publicado_em: string | null;
  responsavel_id: string | null;
  editor_id: string | null;
  scheduled_post_id: string | null;
  arquivos: ArquivoConteudo[];
  token_aprovacao: string;
  comentarios_revisao: ComentarioRevisao[];
  historico_atividades?: EventoAtividade[];
  automacao_config?: import('./publish-automation').PublishAutomationConfig | null;
  criado_em: string;
  atualizado_em: string;
  responsavel?: {
    id: string;
    nome: string;
    email: string;
    papel: string;
    cargo?: string | null;
  } | null;
  editor?: {
    id: string;
    nome: string;
    email: string;
    papel: string;
    cargo?: string | null;
  } | null;
  cliente?: {
    id: string;
    nome: string;
    cor: string | null;
    nicho: string | null;
    foto_url: string | null;
    instagram_accounts?: {
      instagram_username: string | null;
      profile_picture_url: string | null;
    } | null;
    contatos?: Array<{
      id: string;
      nome: string;
      cargo?: string | null;
      telefone?: string | null;
      email?: string | null;
      e_grupo_whatsapp: boolean;
    }>;
  };
}

export const STATUS_LABELS: Record<StatusConteudo, { label: string; tag: string; variant: 'muted' | 'info' | 'warning' | 'destructive' | 'success' }> = {
  planejamento: { label: 'Planejamento', tag: '01', variant: 'muted' },
  copy: { label: 'Criação', tag: '02', variant: 'info' },
  criacao_arte: { label: 'Criação', tag: '02', variant: 'info' },
  em_gravacao: { label: 'Criação', tag: '02', variant: 'info' },
  em_edicao: { label: 'Criação', tag: '02', variant: 'info' },
  revisao_arte: { label: 'Revisão', tag: '03', variant: 'warning' },
  revisao_interna: { label: 'Revisão', tag: '03', variant: 'warning' },
  travado: { label: 'Revisão (Ajuste)', tag: '03', variant: 'destructive' },
  revisao_cliente: { label: 'Aprovação', tag: '04', variant: 'warning' },
  agendamento: { label: 'Agendado', tag: '05', variant: 'success' },
  revisao_agendamento: { label: 'Agendado', tag: '05', variant: 'success' },
  pronto_publicar: { label: 'Agendado', tag: '05', variant: 'success' },
  publicado: { label: 'Publicado', tag: '06', variant: 'success' },
};

/**
 * As 6 colunas oficiais e padronizadas do Kanban de Demandas da Agência:
 * 1. Planejamento
 * 2. Criação
 * 3. Revisão
 * 4. Aprovação
 * 5. Agendado
 * 6. Publicado
 */
export const COLUNAS_KANBAN: StatusConteudo[] = [
  'planejamento',
  'criacao_arte',
  'revisao_interna',
  'revisao_cliente',
  'agendamento',
  'publicado',
];

/**
 * Mapeia qualquer status legado ou intermediário para a sua coluna Kanban correspondente.
 */
export function mapearStatusParaColunaKanban(status: StatusConteudo): StatusConteudo {
  switch (status) {
    case 'planejamento':
      return 'planejamento';
    case 'copy':
    case 'criacao_arte':
    case 'em_gravacao':
    case 'em_edicao':
      return 'criacao_arte';
    case 'revisao_arte':
    case 'revisao_interna':
    case 'travado':
      return 'revisao_interna';
    case 'revisao_cliente':
      return 'revisao_cliente';
    case 'agendamento':
    case 'revisao_agendamento':
    case 'pronto_publicar':
      return 'agendamento';
    case 'publicado':
      return 'publicado';
    default:
      return 'planejamento';
  }
}

/**
 * Status a partir dos quais o cliente pode abrir o link público.
 */
export const STATUS_VISIVEIS_AO_CLIENTE: StatusConteudo[] = [
  'revisao_cliente',
  'revisao_interna',
  'agendamento',
  'revisao_agendamento',
  'pronto_publicar',
  'publicado',
  'travado',
];

export function clientePodeVer(status: StatusConteudo): boolean {
  return STATUS_VISIVEIS_AO_CLIENTE.includes(status);
}

/**
 * Aprovar ou pedir ajuste só vale quando o item está de fato aguardando o
 * cliente (status == 'revisao_cliente').
 */
export function clientePodeAgir(status: StatusConteudo): boolean {
  return status === 'revisao_cliente';
}

/** Explica ao cliente por que ele não pode agir no momento. */
export function motivoBloqueioCliente(status: StatusConteudo): string {
  if (status === 'revisao_interna' || status === 'travado') {
    return 'Seu pedido de ajuste já foi registrado. A equipe está cuidando disso e você receberá a nova versão em breve!';
  }
  if (clientePodeVer(status)) {
    return 'Esta publicação já foi aprovada e está agendada/publicada.';
  }
  return 'Esta publicação ainda está em produção. Você receberá o link assim que ela estiver pronta para aprovação.';
}

/** Formata segundos em minutos:segundos (ex: 27 -> "00:27") */
export function formatarTimecode(segundos: number): string {
  const mins = Math.floor(segundos / 60);
  const secs = Math.floor(segundos % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Gera a mensagem de aprovação e o magic link */
export function gerarMensagemAprovacao(params: {
  nomeCliente: string;
  tituloPost: string;
  token: string;
  urlOrigem?: string;
}): { texto: string; linkAprovacao: string } {
  const base = params.urlOrigem || (typeof window !== 'undefined' ? window.location.origin : 'https://allingens.vercel.app');
  const linkAprovacao = `${base}/aprovacao/${params.token}`;
  const texto =
    `Olá! 👋 Aqui é da Agência GENS.\n\n` +
    `Preparamos a nova publicação *"${params.tituloPost || 'Conteúdo do Mês'}"* para a sua aprovação:\n\n` +
    `👉 *Acesse e aprove com 1 clique:*\n${linkAprovacao}\n\n` +
    `Você pode navegar pelos slides, assistir ao vídeo e sugerir ajustes direto no link! 🚀`;
  return { texto, linkAprovacao };
}

/** Gera link do WhatsApp com mensagem pré-formatada para aprovação do cliente */
export function gerarLinkWhatsAppAprovacao(params: {
  telefone?: string | null;
  nomeCliente: string;
  tituloPost: string;
  token: string;
  urlOrigem?: string;
  preferWeb?: boolean;
}): string {
  const { texto } = gerarMensagemAprovacao(params);
  const clean = (params.telefone || '').replace(/\D/g, '');
  const phone = clean.length >= 10 && !clean.startsWith('55') ? `55${clean}` : clean;

  if (params.preferWeb) {
    const paramPhone = phone ? `phone=${phone}&` : '';
    return `https://web.whatsapp.com/send?${paramPhone}text=${encodeURIComponent(texto)}`;
  }

  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
