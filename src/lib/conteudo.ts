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
  copy: { label: 'Redação / Copy', tag: '02', variant: 'info' },
  criacao_arte: { label: 'Criação de Arte', tag: '03', variant: 'info' },
  revisao_arte: { label: 'Revisão de Arte', tag: '04', variant: 'warning' },
  em_gravacao: { label: 'Em Gravação', tag: '05', variant: 'info' },
  em_edicao: { label: 'Em Edição', tag: '06', variant: 'info' },
  revisao_interna: { label: 'Revisão Interna', tag: '07', variant: 'warning' },
  revisao_cliente: { label: 'Aprovação Cliente', tag: '08', variant: 'warning' },
  agendamento: { label: 'Agendamento', tag: '09', variant: 'info' },
  revisao_agendamento: { label: 'Revisão Agendamento', tag: '10', variant: 'warning' },
  pronto_publicar: { label: 'Pronto p/ Publicar', tag: '11', variant: 'success' },
  publicado: { label: 'Publicado', tag: '12', variant: 'success' },
  travado: { label: 'Travado / Ajuste', tag: '!', variant: 'destructive' },
};

export const COLUNAS_KANBAN: StatusConteudo[] = [
  'planejamento',
  'copy',
  'criacao_arte',
  'em_edicao',
  'revisao_interna',
  'revisao_cliente',
  'pronto_publicar',
  'publicado',
  'travado',
];

/**
 * Status a partir dos quais o cliente pode abrir o link público.
 *
 * Antes de `revisao_cliente` o material ainda está em produção — arte pela
 * metade, copy em rascunho. Quem tem o link não deve ver isso: o token é fixo e
 * nasce junto com o item, então sem esta checagem um link enviado uma vez expõe
 * todo o histórico daquele item para sempre.
 */
export const STATUS_VISIVEIS_AO_CLIENTE: StatusConteudo[] = [
  'revisao_cliente',
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
 * cliente. Sem isso, um item em planejamento saltaria direto para agendamento,
 * e um duplo clique em "aprovar" reprocessaria a ação.
 */
export function clientePodeAgir(status: StatusConteudo): boolean {
  return status === 'revisao_cliente';
}

/** Explica ao cliente, sem jargão interno, por que ele não pode agir agora. */
export function motivoBloqueioCliente(status: StatusConteudo): string {
  if (status === 'travado') {
    return 'Seu pedido de ajuste já foi registrado. A equipe está cuidando disso e você recebe a nova versão em seguida.';
  }
  if (clientePodeVer(status)) {
    return 'Esta publicação já foi aprovada.';
  }
  return 'Esta publicação ainda está em produção. Você recebe o link assim que ela estiver pronta para aprovação.';
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
  const base = params.urlOrigem || (typeof window !== 'undefined' ? window.location.origin : 'https://manychat-caseiro.vercel.app');
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
