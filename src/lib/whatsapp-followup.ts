import { supabase as serviceSupabase } from '@/lib/supabase';
import { TEMPLATES_WHATSAPP, formatarMensagemWhatsApp } from '@/lib/crm';

interface AgendarFollowupParams {
  agenciaId: string;
  clienteId?: string | null;
  telefone: string;
  nomeContato?: string | null;
}

/**
 * Cria a régua de follow-up de 3 etapas para um lead que não respondeu:
 * - Etapa 1: 3 horas após o último contato
 * - Etapa 2: 8 horas (5h após a etapa 1)
 * - Etapa 3: 48 horas (2 dias após a etapa 1 - resgate)
 */
export async function agendarReguaFollowUp({
  agenciaId,
  clienteId,
  telefone,
  nomeContato,
}: AgendarFollowupParams): Promise<void> {
  const telLimpo = telefone.replace(/\D/g, '');
  if (!telLimpo) return;

  const agora = Date.now();
  const primeiroNome = (nomeContato || '').trim().split(' ')[0] || 'Tudo bem';

  // 1. Cancela follow-ups pendentes anteriores para este telefone
  await serviceSupabase
    .from('whatsapp_followups')
    .update({ status: 'cancelado' })
    .eq('agencia_id', agenciaId)
    .eq('telefone', telLimpo)
    .eq('status', 'pendente');

  // Mensagens humanizadas por etapa
  const followups = [
    {
      agencia_id: agenciaId,
      cliente_id: clienteId || null,
      telefone: telLimpo,
      nome_contato: nomeContato || null,
      etapa: 1,
      mensagem: `Oi, ${primeiroNome}! Tudo bem? Conseguiu dar uma olhada na mensagem anterior? Só para saber se ainda tem interesse nessa semana 😊`,
      agendado_para: new Date(agora + 3 * 60 * 60 * 1000).toISOString(), // +3h
      status: 'pendente',
    },
    {
      agencia_id: agenciaId,
      cliente_id: clienteId || null,
      telefone: telLimpo,
      nome_contato: nomeContato || null,
      etapa: 2,
      mensagem: `${primeiroNome}, estou organizando a agenda dos próximos dias com a equipe. Gostaria de verificar uma opção de horário que fique boa para você?`,
      agendado_para: new Date(agora + 8 * 60 * 60 * 1000).toISOString(), // +8h
      status: 'pendente',
    },
    {
      agencia_id: agenciaId,
      cliente_id: clienteId || null,
      telefone: telLimpo,
      nome_contato: nomeContato || null,
      etapa: 3,
      mensagem: `Olá, ${primeiroNome}! Imagino que sua rotina esteja corrida por aí. Caso queira retomar seu atendimento no futuro, é só me chamar por aqui. Tenha uma ótima semana!`,
      agendado_para: new Date(agora + 48 * 60 * 60 * 1000).toISOString(), // +48h (2 dias)
      status: 'pendente',
    },
  ];

  await serviceSupabase.from('whatsapp_followups').insert(followups);
}

/**
 * Cancela imediatamente todos os follow-ups pendentes de um telefone.
 * Chamado assim que o lead envia qualquer mensagem (regra de ouro anti-spam).
 */
export async function cancelarFollowUpsDoLead(agenciaId: string, telefone: string): Promise<number> {
  const telLimpo = telefone.replace(/\D/g, '');
  if (!telLimpo) return 0;

  const { data, error } = await serviceSupabase
    .from('whatsapp_followups')
    .update({ status: 'cancelado' })
    .eq('agencia_id', agenciaId)
    .eq('telefone', telLimpo)
    .eq('status', 'pendente')
    .select('id');

  if (error) {
    console.error('Erro ao cancelar follow-ups do lead:', error);
    return 0;
  }

  return (data || []).length;
}

/**
 * Dispara notificação formatada no grupo de WhatsApp da clínica informando novo agendamento
 */
export async function notificarGrupoAgendamento({
  agenciaId,
  clienteId,
  nomePaciente,
  telefonePaciente,
  procedimento,
  horario,
  origem,
}: {
  agenciaId: string;
  clienteId: string;
  nomePaciente: string;
  telefonePaciente?: string | null;
  procedimento?: string | null;
  horario?: string | null;
  origem?: string | null;
}): Promise<boolean> {
  try {
    const { data: cliente } = await serviceSupabase
      .from('clientes')
      .select('nome, whatsapp_grupo_id, whatsapp_notificar_agendamento')
      .eq('id', clienteId)
      .maybeSingle();

    if (!cliente || !cliente.whatsapp_grupo_id || cliente.whatsapp_notificar_agendamento === false) {
      return false;
    }

    const grupoJid = cliente.whatsapp_grupo_id.trim();
    const openwaUrl = process.env.OPENWA_API_URL?.trim().replace(/\/$/, '');
    const openwaKey = process.env.OPENWA_API_KEY || process.env.API_MASTER_KEY;

    if (!openwaUrl) return false;

    const textoNotificacao = [
      `📅 *NOVO AGENDAMENTO CONFIRMADO!*`,
      ``,
      `👤 *Paciente:* ${nomePaciente}`,
      procedimento ? `💉 *Procedimento:* ${procedimento}` : null,
      horario ? `🗓️ *Horário:* ${horario}` : null,
      telefonePaciente ? `📱 *Contato:* +${telefonePaciente.replace(/\D/g, '')}` : null,
      origem ? `📍 *Origem:* ${origem}` : null,
      ``,
      `_Atualizado automaticamente pelo GENSBot CRM._`,
    ]
      .filter(Boolean)
      .join('\n');

    const sessionName = `cliente-${clienteId}`;
    const { enviarMensagemOpenWA } = await import('@/lib/openwa-client');

    const resultado = await enviarMensagemOpenWA({
      sessionName,
      para: grupoJid,
      texto: textoNotificacao,
    });

    return resultado.ok;
  } catch (err) {
    console.error('Erro ao notificar grupo da clínica no WhatsApp:', err);
    return false;
  }
}
