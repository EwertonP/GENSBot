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
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const appUrl = `${protocol}://${host}`;

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
      await processWebhookEvent(payload, appUrl);
    } catch (err) {
      console.error('Erro ao processar evento do webhook:', err);
    }
  });

  return NextResponse.json({ success: true });
}

// Processador do payload do webhook
async function fetchInstagramUserProfile(senderId: string, accessToken: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${senderId}?fields=username,name&access_token=${accessToken}`);
    if (res.ok) {
      const data = await res.json();
      return {
        username: data.username || null,
        name: data.name || null
      };
    } else {
      const errData = await res.json();
      console.error('Erro na resposta da API do perfil do Instagram:', errData);
    }
  } catch (err) {
    console.error('Erro ao buscar perfil do Instagram:', err);
  }
  return { username: null, name: null };
}

async function processWebhookEvent(payload: any, appUrl: string) {
  if (payload.object !== 'instagram' || !payload.entry) return;

  for (const entry of payload.entry) {
    const myIgId = entry.id;
    if (!myIgId) continue;

    // Descobrir qual usuário do SaaS é dono desta conta do Instagram
    const { data: accountConfig } = await supabase
      .from('config')
      .select('*')
      .eq('instagram_user_id', myIgId)
      .maybeSingle();

    if (!accountConfig || !accountConfig.user_id) {
      console.warn(`Webhook ignorado: Conta do Instagram ${myIgId} não encontrada no banco.`);
      continue;
    }

    const ownerUserId = accountConfig.user_id;
    const igToken = accountConfig.instagram_token;
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

          // Salvar comentário recebido no histórico de mensagens (inbound)
          await supabase.from('messages').insert({
            user_id: ownerUserId,
            instagram_user_id: myIgId,
            contact_id: fromUserId,
            direction: 'inbound',
            text: `[Comentário no Post] ${text}`,
            payload: value
          });

          // Buscar automações ativas com gatilho de comentário pertencentes a esta conta
          const { data: automations } = await supabase
            .from('automations')
            .select('*')
            .eq('active', true)
            .eq('user_id', ownerUserId)
            .eq('instagram_user_id', myIgId)
            .contains('triggers', ['comment']);

          if (!automations) continue;

          for (const auto of automations) {
            // Verificar se é para post específico
            if (auto.specific_post_id && auto.specific_post_id !== mediaId) continue;

            // Verificar se o texto bate com as palavras-chave
            if (matchesKeywords(text, auto.keywords, auto.match_type)) {
              // Log de evento analítico
              await supabase.from('analytics_events').insert({
                user_id: ownerUserId,
                instagram_user_id: myIgId,
                contact_id: fromUserId,
                automation_id: auto.id,
                event_type: 'comment'
              });

              // Determinar o próximo estado de acordo com a captura de leads
              let nextState = 'idle';
              let welcomeText = auto.welcome_dm;

              if (auto.ask_email) {
                nextState = 'waiting_email';
                welcomeText = `${auto.welcome_dm}\n\nPor favor, informe o seu melhor e-mail para continuar:`;
              } else if (auto.ask_phone) {
                nextState = 'waiting_phone';
                welcomeText = `${auto.welcome_dm}\n\nPor favor, informe seu número de telefone/WhatsApp com DDD:`;
              }

              // Obter ou atualizar informações de perfil (username/name)
              const { data: existingContact } = await supabase
                .from('contacts')
                .select('name, username')
                .eq('instagram_id', fromUserId)
                .single();

              let profileName = existingContact?.name || null;
              let profileUsername = fromUsername || existingContact?.username || fromUserId;

              if (!profileName) {
                const profile = await fetchInstagramUserProfile(fromUserId, igToken);
                profileName = profile.name;
                if (profile.username) profileUsername = profile.username;
              }

              // Upsert do contato
              await supabase.from('contacts').upsert({
                user_id: ownerUserId,
                instagram_id: fromUserId,
                instagram_user_id: myIgId,
                username: profileUsername,
                name: profileName,
                last_automation_id: auto.id,
                last_active_automation_id: auto.id,
                conversation_state: nextState,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'instagram_id' });

              // Enfileirar a resposta privada (welcome_dm)
              const welcomePayload = {
                recipient: { comment_id: commentId },
                message: {
                  text: welcomeText,
                  quick_replies: (nextState === 'idle' && auto.quick_reply_button)
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
                user_id: ownerUserId,
                instagram_user_id: myIgId,
                contact_id: fromUserId,
                automation_id: auto.id,
                type: 'private_reply',
                recipient_id: commentId,
                payload: welcomePayload,
                status: 'pending',
                scheduled_at: new Date().toISOString(),
              });

              // Se não estiver capturando dados e houver respostas públicas configuradas, sortear uma e enfileirar
              if (auto.public_replies && auto.public_replies.length > 0) {
                const randomReply =
                  auto.public_replies[Math.floor(Math.random() * auto.public_replies.length)];
                await supabase.from('queue').insert({
                  user_id: ownerUserId,
                  instagram_user_id: myIgId,
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

              // Executar a fila imediatamente
              triggerQueueDrain(appUrl);
              break;
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
        if (messageData.is_echo) continue;

        const isStoryMention = !!messageData.story?.mention;
        const text = messageData.text || (isStoryMention ? '[Menção no Story]' : '');

        // Salvar mensagem recebida no Direct (inbound)
        await supabase.from('messages').insert({
          user_id: ownerUserId,
          instagram_user_id: myIgId,
          contact_id: senderId,
          direction: 'inbound',
          text: text || 'Mensagem / Mídia recebida',
          payload: messageEvent
        });

        // Buscar dados do contato existente para ver o estado da conversa
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('instagram_id', senderId)
          .single();

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
            // Registrar clique no botão nos eventos
            await supabase.from('analytics_events').insert({
              user_id: ownerUserId,
              instagram_user_id: myIgId,
              contact_id: senderId,
              automation_id: auto.id,
              event_type: 'link_clicked'
            });

            // Atualizar last_response_at do contato (abre janela de 24h)
            await supabase.from('contacts').upsert({
              user_id: ownerUserId,
              instagram_id: senderId,
              instagram_user_id: myIgId,
              last_response_at: new Date().toISOString(),
              last_automation_id: auto.id,
              conversation_state: 'idle',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'instagram_id' });

            // Enfileirar os followups (link e lembrete)
            await enqueueFollowups(senderId, auto, ownerUserId, myIgId);
            triggerQueueDrain(appUrl);
          }
          continue;
        }

        if (!text) continue;

        // Tratar solicitação de exclusão de dados da Meta
        if (text.trim().toUpperCase() === 'EXCLUIR MEUS DADOS') {
          await supabase.from('contacts').delete().eq('instagram_id', senderId);
          const deletePayload = {
            recipient: { id: senderId },
            message: { text: 'Seus dados foram excluídos com sucesso do nosso banco de dados.' },
          };
          await supabase.from('queue').insert({
            user_id: ownerUserId,
            instagram_user_id: myIgId,
            contact_id: senderId,
            type: 'private_reply',
            recipient_id: senderId,
            payload: deletePayload,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
          });
          triggerQueueDrain(appUrl);
          continue;
        }

        // MÁQUINA DE ESTADOS: Captura Interativa de Leads
        if (contact && contact.conversation_state && contact.conversation_state !== 'idle') {
          const activeAutoId = contact.last_active_automation_id;
          
          if (activeAutoId) {
            const { data: auto } = await supabase.from('automations').select('*').eq('id', activeAutoId).single();
            
            if (auto) {
              if (contact.conversation_state === 'waiting_email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const emailCandidate = text.trim().toLowerCase();

                if (emailRegex.test(emailCandidate)) {
                  // Salvar email no contato
                  const nextState = auto.ask_phone ? 'waiting_phone' : 'idle';
                  
                  await supabase
                    .from('contacts')
                    .update({
                      email: emailCandidate,
                      conversation_state: nextState,
                      last_response_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('instagram_id', senderId);

                  if (nextState === 'waiting_phone') {
                    // Perguntar telefone
                    await supabase.from('queue').insert({
                      user_id: ownerUserId,
                      instagram_user_id: myIgId,
                      contact_id: senderId,
                      automation_id: auto.id,
                      type: 'private_reply',
                      recipient_id: senderId,
                      payload: {
                        recipient: { id: senderId },
                        message: { text: 'Ótimo! Agora, por favor, envie o seu número de WhatsApp/telefone com DDD (ex: 11999998888):' }
                      },
                      status: 'pending',
                      scheduled_at: new Date().toISOString()
                    });
                  } else {
                    // Finalizou fluxo (apenas e-mail)
                    await supabase.from('analytics_events').insert({
                      user_id: ownerUserId,
                      instagram_user_id: myIgId,
                      contact_id: senderId,
                      automation_id: auto.id,
                      event_type: 'lead_captured'
                    });

                    await enqueueFollowups(senderId, auto, ownerUserId, myIgId);
                    if (auto.webhook_url) {
                      triggerExternalWebhook(auto.webhook_url, { ...contact, email: emailCandidate }, auto);
                    }
                  }
                  triggerQueueDrain(appUrl);
                  continue;
                } else {
                  // E-mail inválido
                  await supabase.from('queue').insert({
                    user_id: ownerUserId,
                    instagram_user_id: myIgId,
                    contact_id: senderId,
                    automation_id: auto.id,
                    type: 'private_reply',
                    recipient_id: senderId,
                    payload: {
                      recipient: { id: senderId },
                      message: { text: '⚠️ E-mail inválido. Por favor, envie um endereço de e-mail correto (ex: nome@dominio.com):' }
                    },
                    status: 'pending',
                    scheduled_at: new Date().toISOString()
                  });
                  triggerQueueDrain(appUrl);
                  continue;
                }
              }

              if (contact.conversation_state === 'waiting_phone') {
                const phoneCandidate = text.replace(/\D/g, ''); // apenas números

                if (phoneCandidate.length >= 10 && phoneCandidate.length <= 15) {
                  // Salvar telefone e finalizar
                  await supabase
                    .from('contacts')
                    .update({
                      phone: phoneCandidate,
                      conversation_state: 'idle',
                      last_response_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('instagram_id', senderId);

                  await supabase.from('analytics_events').insert({
                    user_id: ownerUserId,
                    instagram_user_id: myIgId,
                    contact_id: senderId,
                    automation_id: auto.id,
                    event_type: 'lead_captured'
                  });

                  await enqueueFollowups(senderId, auto, ownerUserId, myIgId);
                  if (auto.webhook_url) {
                    triggerExternalWebhook(auto.webhook_url, { ...contact, phone: phoneCandidate }, auto);
                  }
                  triggerQueueDrain(appUrl);
                  continue;
                } else {
                  // Telefone inválido
                  await supabase.from('queue').insert({
                    user_id: ownerUserId,
                    instagram_user_id: myIgId,
                    contact_id: senderId,
                    automation_id: auto.id,
                    type: 'private_reply',
                    recipient_id: senderId,
                    payload: {
                      recipient: { id: senderId },
                      message: { text: '⚠️ Número de telefone inválido. Por favor, envie seu número completo com DDD (somente números):' }
                    },
                    status: 'pending',
                    scheduled_at: new Date().toISOString()
                  });
                  triggerQueueDrain(appUrl);
                  continue;
                }
              }
            }
          }
        }

        // Se o contato está IDLE, verificar gatilhos
        const isStoryReply = !!messageData.reply_to?.story;
        
        let requiredTrigger = 'dm';
        if (isStoryReply) requiredTrigger = 'story';
        if (isStoryMention) requiredTrigger = 'story_mention';

        // Buscar automações ativas com o gatilho correspondente
        const { data: automations } = await supabase
          .from('automations')
          .select('*')
          .eq('active', true)
          .eq('user_id', ownerUserId)
          .eq('instagram_user_id', myIgId)
          .contains('triggers', [requiredTrigger]);

        if (!automations) continue;

        for (const auto of automations) {
          // Se for story mention, não precisa validar palavras-chave (assume true).
          if (isStoryMention || matchesKeywords(text, auto.keywords, auto.match_type)) {
            // Log do gatilho acionado
            await supabase.from('analytics_events').insert({
              user_id: ownerUserId,
              instagram_user_id: myIgId,
              contact_id: senderId,
              automation_id: auto.id,
              event_type: 'welcome_dm_sent'
            });

            // Determinar próximo estado
            let nextState = 'idle';
            let welcomeText = auto.welcome_dm;

            if (auto.ask_email) {
              nextState = 'waiting_email';
              welcomeText = `${auto.welcome_dm}\n\nPor favor, informe o seu melhor e-mail para prosseguir:`;
            } else if (auto.ask_phone) {
              nextState = 'waiting_phone';
              welcomeText = `${auto.welcome_dm}\n\nPor favor, informe o seu telefone/WhatsApp com DDD para prosseguir:`;
            }

            // Obter ou atualizar informações de perfil (username/name)
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('name, username')
              .eq('instagram_id', senderId)
              .single();

            let profileName = existingContact?.name || null;
            let profileUsername = existingContact?.username || senderId;

            if (!profileName || profileUsername === senderId) {
              const profile = await fetchInstagramUserProfile(senderId, igToken);
              if (profile.name) profileName = profile.name;
              if (profile.username) profileUsername = profile.username;
            }

            await supabase.from('contacts').upsert({
              user_id: ownerUserId,
              instagram_id: senderId,
              instagram_user_id: myIgId,
              username: profileUsername,
              name: profileName,
              last_automation_id: auto.id,
              last_active_automation_id: auto.id,
              conversation_state: nextState,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'instagram_id' });

            const welcomePayload = {
              recipient: { id: senderId },
              message: {
                text: welcomeText,
                quick_replies: (nextState === 'idle' && auto.quick_reply_button)
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
              user_id: ownerUserId,
              instagram_user_id: myIgId,
              contact_id: senderId,
              automation_id: auto.id,
              type: 'private_reply',
              recipient_id: senderId,
              payload: welcomePayload,
              status: 'pending',
              scheduled_at: new Date().toISOString(),
            });

            triggerQueueDrain(appUrl);
            break;
          }
        }
      }
    }
  }
}

// Disparador de Webhook Externo (Make, Zapier, etc.)
async function triggerExternalWebhook(url: string, contact: any, auto: any) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'lead_captured',
        automation: {
          id: auto.id,
          name: auto.name
        },
        contact: {
          instagram_id: contact.instagram_id,
          username: contact.username,
          email: contact.email,
          phone: contact.phone,
          timestamp: new Date().toISOString()
        }
      })
    });
  } catch (err) {
    console.error('Falha ao disparar webhook externo:', err);
  }
}

// Auxiliar: Enfileira a sequência de followups (Dinâmico ou Legado)
async function enqueueFollowups(contactId: string, auto: any, userId: string, instagramUserId: string) {
  // 1. Passo 4: Envio do Link Imediato (Se configurado)
  if (auto.link_url || auto.link_text) {
    let linkPayload: any = {
      recipient: { id: contactId },
      message: {
        text: (auto.link_text || 'Aqui está o seu link:').trim(),
      },
    };

    if (auto.link_url) {
      linkPayload = {
        recipient: { id: contactId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: (auto.link_text || 'Aqui está o seu link:').trim(),
              buttons: [
                {
                  type: 'web_url',
                  url: auto.link_url,
                  title: (auto.link_button_label || 'Acessar Link').substring(0, 20)
                }
              ]
            }
          }
        }
      };
    }

    await supabase.from('followups').insert({
      user_id: userId,
      instagram_user_id: instagramUserId,
      automation_id: auto.id,
      contact_id: contactId,
      step: 1,
      status: 'queued',
    });

    await supabase.from('queue').insert({
      user_id: userId,
      instagram_user_id: instagramUserId,
      contact_id: contactId,
      automation_id: auto.id,
      type: 'link_dm',
      recipient_id: contactId,
      payload: linkPayload,
      status: 'pending',
      scheduled_at: new Date().toISOString(),
    });
  }

  // 2. Passo 5: Sequência Dinâmica (Followups)
  if (auto.followups && Array.isArray(auto.followups) && auto.followups.length > 0) {
    let cumulativeDelay = 0;
    
    for (let i = 0; i < auto.followups.length; i++) {
      const f = auto.followups[i];
      cumulativeDelay += (f.delay_minutes || 1);
      
      const scheduledTime = new Date();
      scheduledTime.setMinutes(scheduledTime.getMinutes() + cumulativeDelay);
      
      let messageText = f.text || '';
      
      let payload: any = {
        recipient: { id: contactId },
        message: { text: messageText.trim() }
      };

      if (f.link_url) {
        payload = {
          recipient: { id: contactId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                text: messageText.trim() || 'Acesse o link abaixo:',
                buttons: [
                  {
                    type: 'web_url',
                    url: f.link_url,
                    title: (f.link_button_label || 'Acessar Link').substring(0, 20)
                  }
                ]
              }
            }
          }
        };
      }
      
      await supabase.from('followups').insert({
        user_id: userId,
        instagram_user_id: instagramUserId,
        automation_id: auto.id,
        contact_id: contactId,
        step: i + 2, // Começa do step 2 (assumindo que o link imediato foi step 1)
        status: 'queued',
      });

      await supabase.from('queue').insert({
        user_id: userId,
        instagram_user_id: instagramUserId,
        contact_id: contactId,
        automation_id: auto.id,
        type: 'sequence_dm',
        recipient_id: contactId,
        payload: payload,
        status: 'pending',
        scheduled_at: scheduledTime.toISOString(),
      });
    }
  } 
  // 3. Fallback Legado: Lembrete Único Antigo
  else if (auto.reminder_text && auto.reminder_delay_minutes > 0) {
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + auto.reminder_delay_minutes);

    const reminderPayload = {
      recipient: { id: contactId },
      message: {
        text: auto.reminder_text,
      },
    };

    await supabase.from('followups').insert({
      user_id: userId,
      instagram_user_id: instagramUserId,
      automation_id: auto.id,
      contact_id: contactId,
      step: 2,
      status: 'queued',
    });

    await supabase.from('queue').insert({
      user_id: userId,
      instagram_user_id: instagramUserId,
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
function triggerQueueDrain(appUrl: string) {
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
