import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function handleDrain(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  // Permitir execução local sem auth se for desenvolvimento, senão validar token
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    // 1. Buscar configuração do Instagram
    const { data: config } = await supabase.from('config').select('*').single();
    if (!config || !config.instagram_token) {
      return NextResponse.json({ error: 'Configuração ou token do Instagram não encontrado.' }, { status: 404 });
    }

    const token = config.instagram_token;

    // 2. Verificar limite de DMs nas últimas 1 hora (limite de segurança ~200 DMs por hora)
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
      return NextResponse.json({ message: 'Limite de taxa de segurança atingido. Fila pausada por 1 hora.' });
    }

    // Calcular batch size restante para não estourar os 200/hora
    const remainingLimit = 200 - (sentInLastHour || 0);
    const batchSize = Math.min(10, remainingLimit);

    if (batchSize <= 0) {
      return NextResponse.json({ message: 'Zero vagas restantes no limite horário.' });
    }

    // 3. Chamar a RPC atômica para pegar trabalhos pendentes
    const { data: jobs, error: rpcError } = await supabase.rpc('claim_queue_jobs', {
      batch_size: batchSize,
    });

    if (rpcError) throw rpcError;
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'Nenhuma mensagem na fila para enviar.' });
    }

    const processedJobs = [];

    for (const job of jobs) {
      // Pequeno atraso para respeitar o limite de 2 envios por segundo
      await sleep(500);

      try {
        // 4. Validar janela de 24h se for envio de DM direta (link_dm ou reminder_dm)
        if (job.type === 'link_dm' || job.type === 'reminder_dm') {
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

        // 5. Enviar a requisição para a API da Meta
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
            instagram_user_id: config.instagram_user_id,
            contact_id: job.contact_id,
            direction: 'outbound',
            text: textContent,
            payload: resData
          });

          // Logar eventos de análise
          if (job.type === 'private_reply') {
            await supabase.from('analytics_events').insert({
              instagram_user_id: config.instagram_user_id,
              contact_id: job.contact_id,
              automation_id: job.automation_id,
              event_type: 'welcome_dm_sent'
            });
          } else if (job.type === 'reminder_dm') {
            await supabase.from('analytics_events').insert({
              instagram_user_id: config.instagram_user_id,
              contact_id: job.contact_id,
              automation_id: job.automation_id,
              event_type: 'reminder_sent'
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

    return NextResponse.json({ success: true, processed: processedJobs });
  } catch (err: any) {
    console.error('Erro geral no drain worker:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

// Auxiliar: Marca o job na fila como falho/ignorado e atualiza followups se aplicável
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

export async function GET(req: Request) {
  return handleDrain(req);
}

export async function POST(req: Request) {
  return handleDrain(req);
}
