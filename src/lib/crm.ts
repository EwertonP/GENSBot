import { supabase } from '@/lib/supabase';
import type { CrmMetricasPipeline, CrmNegocio, CrmPipeline } from '@/types/crm';

/** Formata valor numérico em moeda brasileira (R$) */
export function formatarMoeda(valor: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor || 0);
}

/** Calcula quantos dias o negócio está sem contato registrado */
export function calcularDiasSemContato(ultimoContatoEm?: string | null): number {
  if (!ultimoContatoEm) return 0;
  const data = new Date(ultimoContatoEm).getTime();
  const agora = Date.now();
  const diffDias = Math.floor((agora - data) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDias);
}

/** Limpa e formata o número de telefone para o padrão do WhatsApp (com DDI 55) */
export function normalizarWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

/** Templates comerciais ágeis para WhatsApp */
export const TEMPLATES_WHATSAPP = [
  {
    id: 'primeiro_contato_inbound',
    titulo: 'Primeiro Contato (Lead Novo)',
    mensagem: 'Olá, {nome}! Tudo bem? Vi seu contato através do nosso canal. Como podemos te ajudar hoje?',
  },
  {
    id: 'followup_proposta',
    titulo: 'Follow-up de Proposta',
    mensagem: 'Oi, {nome}! Passando para saber se conseguiu dar uma olhada na proposta que conversamos. Ficou alguma dúvida?',
  },
  {
    id: 'agendamento_reuniao',
    titulo: 'Agendar Alinhamento / Reunião',
    mensagem: 'Olá, {nome}! Tudo certo? Gostaria de sugerir uma breve conversa de 15 minutos para alinharmos os próximos passos. Qual horário fica melhor para você amanhã?',
  },
  {
    id: 'retomada_estagnado',
    titulo: 'Retomada de Contato',
    mensagem: 'Oi, {nome}! Tudo bem por aí? Sei que a rotina é corrida. Ainda tem interesse em avançar com o projeto que alinhamos?',
  },
] as const;

/** Substitui variáveis como {nome} e {empresa} no template */
export function formatarMensagemWhatsApp(template: string, dados: { nome?: string; empresa?: string }): string {
  let msg = template;
  const primeiroNome = (dados.nome || '').trim().split(' ')[0] || 'amigo(a)';
  msg = msg.replace(/\{nome\}/g, primeiroNome);
  msg = msg.replace(/\{empresa\}/g, dados.empresa || 'sua empresa');
  return msg;
}

/** Gera o link direto de wa.me para abrir a conversa no WhatsApp em 1 clique */
export function gerarLinkWhatsApp(telefone: string, mensagem?: string): string {
  const ddiNum = normalizarWhatsApp(telefone);
  if (!ddiNum) return '';
  const url = `https://wa.me/${ddiNum}`;
  if (mensagem?.trim()) {
    return `${url}?text=${encodeURIComponent(mensagem.trim())}`;
  }
  return url;
}

/** Calcula as métricas principais do funil com base na lista de negócios */
export function calcularMetricasPipeline(negocios: CrmNegocio[]): CrmMetricasPipeline {
  const totalNegocios = negocios.length;
  let negociosAbertos = 0;
  let negociosGanhos = 0;
  let negociosPerdidos = 0;
  let valorTotalAberto = 0;
  let valorTotalGanho = 0;

  for (const n of negocios) {
    const val = Number(n.valor) || 0;
    if (n.status === 'aberto') {
      negociosAbertos++;
      valorTotalAberto += val;
    } else if (n.status === 'ganho') {
      negociosGanhos++;
      valorTotalGanho += val;
    } else if (n.status === 'perdido') {
      negociosPerdidos++;
    }
  }

  const finalizados = negociosGanhos + negociosPerdidos;
  const taxaConversao = finalizados > 0 ? Math.round((negociosGanhos / finalizados) * 100) : 0;
  const ticketMedio = negociosGanhos > 0 ? Math.round(valorTotalGanho / negociosGanhos) : 0;

  return {
    totalNegocios,
    negociosAbertos,
    negociosGanhos,
    negociosPerdidos,
    valorTotalAberto,
    valorTotalGanho,
    taxaConversao,
    ticketMedio,
  };
}

/**
 * Garante que a agência ou cliente tenha ao menos 1 pipeline padrão com seus estágios.
 * Se não existir nenhum pipeline ativo, cria automaticamente com as etapas recomendadas.
 */
export async function garantirPipelinePadrao(
  agenciaId: string,
  clienteId: string | null = null,
  nomeCliente?: string | null
): Promise<CrmPipeline | null> {
  // 1. Tenta buscar pipeline existente
  let query = supabase
    .from('crm_pipelines')
    .select('*, estagios:crm_estagios(*)')
    .eq('agencia_id', agenciaId)
    .eq('ativo', true);

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  } else {
    query = query.is('cliente_id', null);
  }

  const { data: pipelines, error } = await query.order('ordem', { ascending: true });
  if (!error && pipelines && pipelines.length > 0) {
    // Ordena os estágios
    const pipe = pipelines[0];
    if (pipe.estagios) {
      pipe.estagios.sort((a: any, b: any) => a.ordem - b.ordem);
    }
    return pipe as CrmPipeline;
  }

  // 2. Se não existir, cria o pipeline padrão
  const ehAgencia = !clienteId;
  const nomePipeline = ehAgencia
    ? 'Prospecção Agência'
    : `Vendas ${nomeCliente ? `(${nomeCliente})` : 'Cliente'}`;
  const descricao = ehAgencia
    ? 'Funil comercial de novos clientes da agência'
    : 'Funil de captação e fechamento de leads do cliente';

  const { data: novoPipe, error: pipeErr } = await supabase
    .from('crm_pipelines')
    .insert({
      agencia_id: agenciaId,
      cliente_id: clienteId || null,
      nome: nomePipeline,
      descricao,
      ordem: 0,
      padrao: true,
      ativo: true,
    })
    .select()
    .single();

  if (pipeErr || !novoPipe) {
    console.error('Erro ao provisionar pipeline padrão:', pipeErr);
    return null;
  }

  // 3. Cria as etapas do funil
  const estagiosPadrao = ehAgencia
    ? [
        { nome: 'Novo Prospect', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
        { nome: 'Primeiro Contato', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
        { nome: 'Diagnóstico / Reunião', cor: '#ec4899', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
        { nome: 'Proposta Enviada', cor: '#f59e0b', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
        { nome: 'Fechado / Ganho', cor: '#10b981', ordem: 4, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
        { nome: 'Perdido', cor: '#ef4444', ordem: 5, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
      ]
    : [
        { nome: 'Novo Lead', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
        { nome: 'Em Atendimento', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
        { nome: 'Qualificado / Agendado', cor: '#f59e0b', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
        { nome: 'Negociação', cor: '#6366f1', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
        { nome: 'Venda Realizada', cor: '#10b981', ordem: 4, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
        { nome: 'Perdido', cor: '#ef4444', ordem: 5, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
      ];

  const payloadEstagios = estagiosPadrao.map((e) => ({
    pipeline_id: novoPipe.id,
    ...e,
  }));

  const { data: estagiosCriados } = await supabase
    .from('crm_estagios')
    .insert(payloadEstagios)
    .select()
    .order('ordem', { ascending: true });

  return {
    ...novoPipe,
    estagios: estagiosCriados || [],
  };
}
