import { supabase } from '@/lib/supabase';
import { resumeFlow } from '@/lib/flow-engine/runner';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Tipos de job que representam envio real de DM (checam a janela de 24h da Meta).
// `flow_send` é o equivalente, pro motor de fluxo novo, de link_dm/reminder_dm/sequence_dm.
function isDirectMessageJob(type: string): boolean {
  return type === 'link_dm' || type === 'reminder_dm' || type === 'sequence_dm' || type === 'flow_send';
}

/**
 * Processa a fila de mensagens pendentes (queue), respeitando o limite de
 * ~200 DMs/hora e a janela de 24h da Meta. Extraída para uma função direta
 * (sem HTTP) para poder ser chamada tanto pelas rotas de API quanto, mais
 * importante, diretamente pelo webhook logo após enfileirar uma automação —
 * evitando o hop de rede extra e o cold start de uma nova invocação.
 */
export async function drainQueue() {
  // Verificar limite de DMs nas últimas 1 hora (limite de segurança ~200 DMs por hora)
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { count: sentInLastHour, error: countError } = await supabase
    .from('queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .neq('type', 'public_reply')
    .gt('sent_at', oneHourAgo.toISOString());

  if (countError) throw countError;

  if (sentInLastHour && sentInLastHour >= 200) {
    console.warn('Limite de segurança de 200 DMs/hora atingido. Pulando processamento da fila.');
    return { message: 'Limite de taxa de segurança atingido. Fila pausada por 1 hora.' };
  }

  // Calcular batch size restante para não estourar os 200/hora
  const remainingLimit = 200 - (sentInLastHour || 0);
  const batchSize = Math.min(10, remainingLimit);

  if (batchSize <= 0) {
    return { message: 'Zero vagas restantes no limite horário.' };
  }

  // Chamar a RPC atômica para pegar trabalhos pendentes
  const { data: jobs, error: rpcError } = await supabase.rpc('claim_queue_jobs', {
    batch_size: batchSize,
  });

  if (rpcError) throw rpcError;
  if (!jobs || jobs.length === 0) {
    return { message: 'Nenhuma mensagem na fila para enviar.' };
  }

  const processedJobs = [];

  for (const job of jobs) {
    // Pequeno atraso para respeitar o limite de 2 envios por segundo
    await sleep(500);

    try {
      // Obter a conta do Instagram dona deste job
      const { data: account } = await supabase
        .from('instagram_accounts')
        .select('access_token, instagram_user_id, user_id')
        .eq('instagram_user_id', job.instagram_user_id)
        .maybeSingle();

      if (!account || !account.access_token) {
        await markJobFailed(job.id, 'Conta do Instagram não encontrada ou sem token.', job.automation_id, job.contact_id, job.type);
        processedJobs.push({ id: job.id, status: 'failed', reason: 'missing_token' });
        continue;
      }

      const token = account.access_token;

      // Job de retomada de um nó `delay` do motor de fluxo novo — não envia
      // nada na Graph API diretamente; caminha o grafo a partir do nó pausado,
      // que por sua vez pode gerar um novo job `flow_send` real.
      if (job.type === 'flow_resume') {
        const { data: automation } = await supabase
          .from('automations')
          .select('*')
          .eq('id', job.automation_id)
          .single();

        if (automation?.flow_definition && job.payload?.node_id) {
          await resumeFlow(
            automation,
            {
              ownerUserId: account.user_id,
              instagramUserId: account.instagram_user_id,
              contactId: job.contact_id,
              text: '',
              triggerType: 'dm',
              recipientRef: { id: job.contact_id },
              resolveProfile: async () => ({ username: null, name: null }),
            },
            job.payload.node_id,
          );
        }

        await supabase
          .from('queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', job.id);
        processedJobs.push({ id: job.id, status: 'sent' });
        continue;
      }

      // Validar janela de 24h se for envio de DM direta
      if (isDirectMessageJob(job.type)) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('last_response_at')
          .eq('instagram_id', job.contact_id)
          .single();

        if (!contact || !contact.last_response_at) {
          await markJobFailed(job.id, 'Sem interação registrada para abrir janela de 24h.', job.automation_id, job.contact_id, job.type);
          processedJobs.push({ id: job.id, status: 'skipped', reason: 'sem_janela' });
          continue;
        }

        const lastResponse = new Date(contact.last_response_at);
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        if (lastResponse < twentyFourHoursAgo) {
          await markJobFailed(job.id, 'Fora da janela de 24 horas permitida pela Meta.', job.automation_id, job.contact_id, job.type);
          processedJobs.push({ id: job.id, status: 'skipped', reason: 'janela_expirada' });
          continue;
        }
      }

      // Enviar a requisição para a API da Meta
      let apiEndpoint = '';
      let requestBody = {};

      if (job.type === 'public_reply') {
        // Responder comentário publicamente
        // POST /{comment_id}/replies?message={message}
        apiEndpoint = `https://graph.instagram.com/v25.0/${job.recipient_id}/replies`;
        requestBody = { message: job.payload.message };
      } else {
        // Enviar DM (resposta privada a comentário, link ou lembrete)
        // POST /me/messages
        apiEndpoint = `https://graph.instagram.com/v25.0/me/messages`;
        requestBody = {
          recipient: job.payload.recipient,
          message: job.payload.message,
        };
      }

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const resData = await res.json();

      if (!res.ok) {
        console.error('Erro retornado pela API da Meta:', resData);
        const errorMsg = resData.error?.message || 'Erro desconhecido na API do Instagram.';
        await markJobFailed(job.id, errorMsg, job.automation_id, job.contact_id, job.type);
        processedJobs.push({ id: job.id, status: 'failed', error: errorMsg });
      } else {
        // Sucesso no envio
        await supabase
          .from('queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', job.id);

        // Salvar no histórico de mensagens (outbound)
        const textContent = job.payload.message?.text ||
          (job.payload.message?.attachment?.payload?.elements?.[0]?.title) ||
          'Mensagem Estruturada';

        await supabase.from('messages').insert({
          user_id: account.user_id,
          instagram_user_id: account.instagram_user_id,
          contact_id: job.contact_id,
          direction: 'outbound',
          text: textContent,
          payload: resData
        });

        // Logar eventos de análise
        if (job.type === 'private_reply') {
          await supabase.from('analytics_events').insert({
            user_id: account.user_id,
            instagram_user_id: account.instagram_user_id,
            contact_id: job.contact_id,
            automation_id: job.automation_id,
            event_type: 'welcome_dm_sent'
          });
        } else if (job.type === 'reminder_dm' || job.type === 'sequence_dm') {
          await supabase.from('analytics_events').insert({
            user_id: account.user_id,
            instagram_user_id: account.instagram_user_id,
            contact_id: job.contact_id,
            automation_id: job.automation_id,
            event_type: job.type === 'sequence_dm' ? 'sequence_sent' : 'reminder_sent'
          });
        }

        // Atualizar o status da tabela followups correspondente se aplicável
        if (job.type === 'link_dm' || job.type === 'reminder_dm') {
          const step = job.type === 'link_dm' ? 1 : 2;
          await supabase
            .from('followups')
            .update({ status: 'sent' })
            .eq('automation_id', job.automation_id)
            .eq('contact_id', job.contact_id)
            .eq('step', step);
        }

        processedJobs.push({ id: job.id, status: 'sent' });
      }
    } catch (err: any) {
      console.error('Erro de rede ou processamento no job:', job.id, err);
      await markJobFailed(job.id, err.message || 'Erro inesperado no worker.', job.automation_id, job.contact_id, job.type);
      processedJobs.push({ id: job.id, status: 'failed', error: err.message });
    }
  }

  return { success: true, processed: processedJobs };
}

async function markJobFailed(jobId: string, errorMsg: string, automationId: string, contactId: string, type: string) {
  const isSkip = errorMsg.includes('janela') || errorMsg.includes('interação');
  const finalStatus = isSkip ? 'skipped' : 'failed';

  await supabase
    .from('queue')
    .update({
      status: finalStatus,
      error_message: errorMsg,
      sent_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (type === 'link_dm' || type === 'reminder_dm') {
    const step = type === 'link_dm' ? 1 : 2;
    await supabase
      .from('followups')
      .update({ status: finalStatus })
      .eq('automation_id', automationId)
      .eq('contact_id', contactId)
      .eq('step', step);
  }
}
