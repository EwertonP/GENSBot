import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { after } from 'next/server';

// Função para verificar a assinatura X-Hub-Signature-256 da Meta
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    console.error('INSTAGRAM_APP_SECRET não está configurado.');
    return false;
  }

  const [algorithm, signature] = signatureHeader.split('=');
  if (algorithm !== 'sha256' || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  try {
    const bufSignature = Buffer.from(signature, 'hex');
    const bufExpected = Buffer.from(expectedSignature, 'hex');
    if (bufSignature.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufSignature, bufExpected);
  } catch {
    return false;
  }
}

// GET: Handshake de verificação do Webhook da Meta
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verificação falhou', { status: 403 });
}

// POST: Recebe eventos do webhook da Meta
export async function POST(req: Request) {
  const signatureHeader = req.headers.get('x-hub-signature-256');
  const rawBody = await req.text();

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { error: 'Corpo do payload não é JSON válido', raw: rawBody };
  }

  // Registrar o evento no banco para auditoria IMEDIATAMENTE (para facilitar debug)
  await supabase.from('events').insert({ payload });

  if (!verifySignature(rawBody, signatureHeader)) {
    // Adicionar um registro adicional de erro de assinatura para sabermos
    await supabase.from('events').insert({ 
      payload: { 
        error: 'Assinatura inválida (HMAC-SHA256 falhou)', 
        signatureHeader,
        bodyPreview: rawBody.substring(0, 1000)
      } 
    });
    return new Response('Assinatura inválida', { status: 401 });
  }

  // Disparar o processamento do evento de forma assíncrona após responder
  after(async () => {
    try {
      await processWebhookEvent(payload);
    } catch (err) {
      console.error('Erro ao processar evento do webhook:', err);
    }
  });

  return NextResponse.json({ success: true });
}

// Processador do payload do webhook
async function processWebhookEvent(payload: any) {
  if (payload.object !== 'instagram' || !payload.entry) return;

  // Buscar configurações da conta (ID do Instagram configurado)
  const { data: config } = await supabase.from('config').select('*').single();
  if (!config || !config.instagram_user_id) {
    console.error('Instagram não configurado no banco de dados.');
    return;
  }

  const myIgId = config.instagram_user_id;

  for (const entry of payload.entry) {
    // 1. Processar Comentários (changes com field comments)
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'comments') {
          const value = change.value;
          if (!value || !value.id || !value.text || !value.from) continue;

          const commentId = value.id;
          const text = value.text;
          const mediaId = value.media?.id;
          const fromUserId = value.from.id;
          const fromUsername = value.from.username;

          // Ignorar comentários da própria conta
          if (fromUserId === myIgId) continue;

          // Buscar automações ativas com gatilho de comentário
          const { data: automations } = await supabase
            .from('automations')
            .select('*')
            .eq('active', true)
            .contains('triggers', ['comment']);

          if (!automations) continue;

          for (const auto of automations) {
            // Verificar se é para post específico
            if (auto.specific_post_id && auto.specific_post_id !== mediaId) continue;

            // Verificar se o texto bate com as palavras-chave
            if (matchesKeywords(text, auto.keywords, auto.match_type)) {
              // Upsert do contato
              await supabase.from('contacts').upsert({
                instagram_id: fromUserId,
                username: fromUsername,
                last_automation_id: auto.id,
                updated_at: new Date().toISOString(),
              });

              // Enfileirar a resposta privada (welcome_dm) usando o comment_id como destinatário
              const welcomePayload = {
                recipient: { comment_id: commentId },
                message: {
                  text: auto.welcome_dm,
                  quick_replies: auto.quick_reply_button
                    ? [
                        {
                          content_type: 'text',
                          title: auto.quick_reply_button.substring(0, 20), // Limite de 20 chars para botões
                          payload: `automation_id:${auto.id}`,
                        },
                      ]
                    : undefined,
                },
              };

              await supabase.from('queue').insert({
                contact_id: fromUserId,
                automation_id: auto.id,
                type: 'private_reply',
                recipient_id: commentId,
                payload: welcomePayload,
                status: 'pending',
                scheduled_at: new Date().toISOString(),
              });

              // Se houver respostas públicas configuradas, sortear uma e enfileirar
              if (auto.public_replies && auto.public_replies.length > 0) {
                const randomReply =
                  auto.public_replies[Math.floor(Math.random() * auto.public_replies.length)];
                await supabase.from('queue').insert({
                  contact_id: fromUserId,
                  automation_id: auto.id,
                  type: 'public_reply',
                  recipient_id: commentId,
                  payload: {
                    message: randomReply,
                  },
                  status: 'pending',
                  scheduled_at: new Date().toISOString(),
                });
              }

              // Executar a fila imediatamente de forma assíncrona
              triggerQueueDrain();
              break; // Executa apenas a primeira automação que der match
            }
          }
        }
      }
    }

    // 2. Processar Mensagens Directs (messaging)
    if (entry.messaging) {
      for (const messageEvent of entry.messaging) {
        if (!messageEvent.sender || !messageEvent.sender.id) continue;

        const senderId = messageEvent.sender.id;
        // Ignorar ecos (mensagens enviadas por nós)
        if (senderId === myIgId) continue;

        const messageData = messageEvent.message;
        if (!messageData) continue;

        // Se for clique em quick reply (botão de resposta rápida)
        const quickReplyPayload = messageData.quick_reply?.payload;
        if (quickReplyPayload && quickReplyPayload.startsWith('automation_id:')) {
          const autoId = quickReplyPayload.split(':')[1];

          // Buscar a automação
          const { data: auto } = await supabase
            .from('automations')
            .select('*')
            .eq('id', autoId)
            .single();

          if (auto) {
            // Atualizar last_response_at do contato (abre janela de 24h)
            await supabase.from('contacts').upsert({
              instagram_id: senderId,
              last_response_at: new Date().toISOString(),
              last_automation_id: auto.id,
              updated_at: new Date().toISOString(),
            });

            // Enfileirar os followups (link e lembrete)
            await enqueueFollowups(senderId, auto);
            triggerQueueDrain();
          }
          continue;
        }

        // Se for mensagem comum ou resposta a story
        const text = messageData.text;
        if (!text) continue;

        // Tratar solicitação de exclusão de dados da Meta
        if (text.trim().toUpperCase() === 'EXCLUIR MEUS DADOS') {
          await supabase.from('contacts').delete().eq('instagram_id', senderId);
          const deletePayload = {
            recipient: { id: senderId },
            message: { text: 'Seus dados foram excluídos com sucesso do nosso banco de dados.' },
          };
          await supabase.from('queue').insert({
            contact_id: senderId,
            type: 'private_reply',
            recipient_id: senderId,
            payload: deletePayload,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
          });
          triggerQueueDrain();
          continue;
        }

        const isStoryReply = !!messageData.reply_to?.story;
        const requiredTrigger = isStoryReply ? 'story' : 'dm';

        // Buscar automações ativas com o gatilho correspondente
        const { data: automations } = await supabase
          .from('automations')
          .select('*')
          .eq('active', true)
          .contains('triggers', [requiredTrigger]);

        if (!automations) continue;

        for (const auto of automations) {
          if (matchesKeywords(text, auto.keywords, auto.match_type)) {
            // Se casar a palavra-chave, manda a DM de boas-vindas direto
            await supabase.from('contacts').upsert({
              instagram_id: senderId,
              last_automation_id: auto.id,
              updated_at: new Date().toISOString(),
            });

            // Como o contato já iniciou a conversa (enviou DM/story), a janela de 24h está aberta
            // Mandamos a DM de boas-vindas padrão com o botão de resposta rápida
            const welcomePayload = {
              recipient: { id: senderId },
              message: {
                text: auto.welcome_dm,
                quick_replies: auto.quick_reply_button
                  ? [
                      {
                        content_type: 'text',
                        title: auto.quick_reply_button.substring(0, 20),
                        payload: `automation_id:${auto.id}`,
                      },
                    ]
                  : undefined,
              },
            };

            await supabase.from('queue').insert({
              contact_id: senderId,
              automation_id: auto.id,
              type: 'private_reply',
              recipient_id: senderId,
              payload: welcomePayload,
              status: 'pending',
              scheduled_at: new Date().toISOString(),
            });

            triggerQueueDrain();
            break;
          }
        }
      }
    }
  }
}

// Auxiliar: Enfileira a sequência de followups (Link e Lembrete)
async function enqueueFollowups(contactId: string, auto: any) {
  // 1. Enfileirar DM com o link
  // Usamos template genérico para renderizar o link como botão se houver rótulo
  let linkPayload;
  if (auto.link_button_label && auto.link_url) {
    linkPayload = {
      recipient: { id: contactId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: auto.link_text || 'Aqui está o seu link:',
                subtitle: 'Toque no botão para acessar',
                buttons: [
                  {
                    type: 'web_url',
                    url: auto.link_url,
                    title: auto.link_button_label.substring(0, 20),
                  },
                ],
              },
            ],
          },
        },
      },
    };
  } else {
    // Se não tiver botão configurado, manda texto puro com o link
    linkPayload = {
      recipient: { id: contactId },
      message: {
        text: `${auto.link_text || 'Aqui está o seu link:'}\n\n${auto.link_url || ''}`.trim(),
      },
    };
  }

  // Registra o progresso do followup 1 (Link)
  await supabase.from('followups').insert({
    automation_id: auto.id,
    contact_id: contactId,
    step: 1,
    status: 'queued',
  });

  await supabase.from('queue').insert({
    contact_id: contactId,
    automation_id: auto.id,
    type: 'link_dm',
    recipient_id: contactId,
    payload: linkPayload,
    status: 'pending',
    scheduled_at: new Date().toISOString(),
  });

  // 2. Enfileirar Lembrete (se configurado)
  if (auto.reminder_text && auto.reminder_delay_minutes > 0) {
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + auto.reminder_delay_minutes);

    const reminderPayload = {
      recipient: { id: contactId },
      message: {
        text: auto.reminder_text,
      },
    };

    await supabase.from('followups').insert({
      automation_id: auto.id,
      contact_id: contactId,
      step: 2,
      status: 'queued',
    });

    await supabase.from('queue').insert({
      contact_id: contactId,
      automation_id: auto.id,
      type: 'reminder_dm',
      recipient_id: contactId,
      payload: reminderPayload,
      status: 'pending',
      scheduled_at: scheduledTime.toISOString(),
    });
  }
}

// Auxiliar: Valida se o texto dá match com as palavras-chave
function matchesKeywords(text: string, keywords: string[], matchType: string): boolean {
  if (matchType === 'any' || keywords.length === 0) return true;

  const normalizedText = text.trim().toLowerCase();

  if (matchType === 'exact') {
    return keywords.some(kw => normalizedText === kw.trim().toLowerCase());
  }

  if (matchType === 'contains') {
    return keywords.some(kw => normalizedText.includes(kw.trim().toLowerCase()));
  }

  return false;
}

// Disparador assíncrono para o drain worker
function triggerQueueDrain() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  fetch(`${appUrl}/api/cron/drain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
  }).catch(err => {
    // Silencia o erro para não quebrar o webhook principal
    console.error('Erro ao disparar drain da fila:', err);
  });
}
