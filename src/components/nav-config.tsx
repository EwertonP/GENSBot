import {
  BarChart3,
  CheckSquare,
  Briefcase,
  Layers,
  CalendarDays,
  Send,
  TrendingUp,
  Workflow,
  Users,
  MessageCircle,
  Link2,
  Users2,
} from 'lucide-react';

/**
 * Fonte única das telas do app: rótulo do menu, título/subtítulo do
 * cabeçalho, ícone e grupo. Menu lateral, cabeçalho, barra do celular e a
 * busca rápida (Ctrl+K) leem daqui — antes eram 3 listas que discordavam
 * ("Contatos & Leads" no menu, "Leads & Público" no título).
 */

export const TELAS = {
  dashboard: {
    label: 'Dashboard',
    titulo: 'Dashboard',
    subtitulo: 'Visão unificada das métricas, da fila e das automações.',
    icon: BarChart3,
    grupo: 'agencia',
  },
  rotina: {
    label: 'Rotina',
    titulo: 'Rotina da agência',
    subtitulo: 'Tarefas internas e pendências do dia a dia.',
    icon: CheckSquare,
    grupo: 'agencia',
  },
  clientes: {
    label: 'Clientes',
    titulo: 'Clientes',
    subtitulo: 'Dossiê, contratos e contatos de cada cliente.',
    icon: Briefcase,
    grupo: 'agencia',
  },
  esteira: {
    label: 'Demandas & Aprovação',
    titulo: 'Demandas & Aprovação',
    subtitulo: 'Produção de posts e reels, com aprovação do cliente pelo WhatsApp.',
    icon: Layers,
    grupo: 'agencia',
  },
  calendario_geral: {
    label: 'Calendário',
    titulo: 'Calendário de postagens',
    subtitulo: 'Todos os posts de todos os clientes, com conflitos de horário em destaque.',
    icon: CalendarDays,
    grupo: 'agencia',
  },
  publish: {
    label: 'Agendamentos',
    titulo: 'Agendamentos',
    subtitulo: 'Publique ou agende posts, reels e stories na conta selecionada.',
    icon: Send,
    grupo: 'instagram',
  },
  metrics: {
    label: 'Métricas',
    titulo: 'Métricas',
    subtitulo: 'Alcance, seguidores e desempenho do conteúdo, direto da Meta.',
    icon: TrendingUp,
    grupo: 'instagram',
  },
  automations: {
    label: 'Automações',
    titulo: 'Automações',
    subtitulo: 'Respostas automáticas no Direct a partir de comentários e mensagens.',
    icon: Workflow,
    grupo: 'instagram',
  },
  contacts: {
    label: 'Contatos & Leads',
    titulo: 'Contatos & Leads',
    subtitulo: 'Pessoas captadas e qualificadas pelas automações.',
    icon: Users,
    grupo: 'instagram',
  },
  inbox: {
    label: 'Inbox',
    titulo: 'Inbox',
    subtitulo: 'Conversas do Direct.',
    icon: MessageCircle,
    grupo: 'instagram',
  },
  utm: {
    label: 'Links UTM',
    titulo: 'Links UTM',
    subtitulo: 'Links rastreáveis ligados a campanhas e automações.',
    icon: Link2,
    grupo: 'instagram',
  },
  equipe: {
    label: 'Equipe & Sócios',
    titulo: 'Equipe & Sócios',
    subtitulo: 'Membros, sócios, papéis e permissões da agência.',
    icon: Users2,
    // Administração — fica no menu do perfil, não no menu do dia a dia.
    grupo: 'admin',
  },
} as const;

export type AbaId = keyof typeof TELAS;

export const ABAS = Object.keys(TELAS) as AbaId[];

export function isAbaId(v: string | null | undefined): v is AbaId {
  return !!v && v in TELAS;
}

export const GRUPOS_MENU: { id: 'agencia' | 'instagram'; label: string }[] = [
  { id: 'agencia', label: 'Agência' },
  { id: 'instagram', label: 'Instagram' },
];
