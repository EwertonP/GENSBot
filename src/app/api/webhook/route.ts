import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { after } from 'next/server';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { drainQueue } from '@/lib/drain';
import { runFlow, resumeFlow } from '@/lib/flow-engine/runner';
import { matchesKeywords } from '@/lib/flow-engine/evaluator';
import { logDbError } from '@/lib/db-log';
import { triggerExternalWebhook } from '@/lib/external-webhook';

// `messages.contact_id` tem FK pra `contacts.instagram_id` — pra um
// comentarista/remetente de primeira vez (ainda sem linha em `contacts`,
// já que o upsert completo só acontece depois, ao bater uma automação),
// inserir em `messages` antes disso violava a FK. Como o client do
// Supabase não lança exceção em erro de escrita (só devolve `{error}`,
// que este arquivo não checava em nenhum insert), a falha era 100%
// silenciosa: a mensagem nunca aparecia no histórico e ninguém via erro
// nenhum. Isso garante a linha mínima antes de qualquer insert em `messages`.
async function ensureContactExists(fields: {
  user_id: string;
  instagram_id: string;
  instagram_user_id: string;
}) {
  const { error } = await supabase.from('contacts').upsert(fields, {
    onConflict: 'instagram_id',
    ignoreDuplicates: true,
  });
  logDbError('contacts.upsert (ensureContactExists)', error);
}

// A Meta reenvia a entrega do webhook quando não recebe 200 rápido o
// suficiente (comum em cold start da Vercel) — sem isso, o mesmo
// comentário/mensagem seria reprocessado do zero e podia disparar a
// mesma automação (e o mesmo DM) duas vezes. `eventId` é um id estável
// por evento (`comment:<id do comentário>` ou `dm:<mid da mensagem>`).
// Usa upsert com `ignoreDuplicates` pra aproveitar a constraint UNIQUE
// como trava atômica: se a linha já existia, `data` volta vazio.
async function isDuplicateWebhookEvent(eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('processed_webhook_events')
    .upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true })
    .select();

  if (error) {
    // Falha ao checar deduplicação: melhor processar de novo (pior caso,
    // reenvia uma mensagem) do que arriscar descartar um evento real.
    logDbError('processed_webhook_events.upsert (dedup check)', error);
    return false;
  }

  return !data || data.length === 0;
}

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
  const { error: eventLogError } = await supabase.from('events').insert({ payload });
  logDbError('events.insert (auditoria)', eventLogError);

  if (!verifySignature(rawBody, signatureHeader)) {
    // Adicionar um registro adicional de erro de assinatura para sabermos
    const { error: sigLogError } = await supabase.from('events').insert({
      payload: {
        error: 'Assinatura inválida (HMAC-SHA256 falhou)',
        signatureHeader,
        bodyPreview: rawBody.substring(0, 1000)
      }
    });
    logDbError('events.insert (assinatura inválida)', sigLogError);
    return new Response('Assinatura inválida', { status: 401 });
  }

  // Disparar o processamento do evento de forma assíncrona após responder.
  // O next/server `after()` mantém a função viva até essa promise resolver,
  // então é seguro (e necessário) aguardar o drain da fila aqui dentro —
  // ao contrário de um fetch solto, que podia ser cortado antes de completar.
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
async function fetchInstagramUserProfile(senderId: string, accessToken: string) {
  try {
    // Token do Instagram Business Login só é válido contra graph.instagram.com
    // (mesmo host usado no resto do arquivo) — graph.facebook.com rejeitava
    // com "Cannot parse access token", silenciosamente engolido pelo catch
    // abaixo, então nunca aparecia como o motivo real de nada quebrar.
    // `profile_pic` é pedido junto — se a Meta não devolver pra esse contato
    // específico (privacidade/janela de tempo), fica null e nada quebra,
    // igual já acontece hoje quando username/name vêm ausentes.
    const res = await fetch(`https://graph.instagram.com/v25.0/${senderId}?fields=username,name,profile_pic&access_token=${accessToken}`);
    if (res.ok) {
      const data = await res.json();
      return {
        username: data.username || null,
        name: data.name || null,
        profile_picture_url: data.profile_pic || null,
      };
    } else {
      const errData = await res.json();
      console.error('Erro na resposta da API do perfil do Instagram:', errData);
    }
  } catch (err) {
    console.error('Erro ao buscar perfil do Instagram:', err);
  }
  return { username: null, name: null, profile_picture_url: null };
}

async function processWebhookEvent(payload: any) {
  if (payload.object !== 'instagram' || !payload.entry) return;

  let queueDrainNeeded = false;

  for (const entry of payload.entry) {
    const myIgId = entry.id;
    if (!myIgId) continue;

    // Descobrir qual usuário do SaaS é dono desta conta do Instagram
    const accountConfig = await getInstagramAccountByInstagramUserId(myIgId);

    if (!accountConfig || !accountConfig.user_id) {
      console.warn(`Webhook ignorado: Conta do Instagram ${myIgId} não encontrada no banco.`);
      continue;
    }

    const ownerUserId = accountConfig.user_id;
    const igToken = accountConfig.access_token;
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

          // A Meta pode reentregar o mesmo comentário mais de uma vez — ignora
          // qualquer repetição pra não disparar a automação (e o DM) de novo.
          if (await isDuplicateWebhookEvent(`comment:${commentId}`)) continue;

          // Garante que o contato exista antes de logar a mensagem (ver
          // ensureContactExists) — evita violar a FK messages.contact_id
          // pra quem comenta pela primeira vez.
          await ensureContactExists({
            user_id: ownerUserId,
            instagram_id: fromUserId,
            instagram_user_id: myIgId,
          });

          // Salvar comentário recebido no histórico de mensagens (inbound)
          const { error: commentMsgError } = await supabase.from('messages').insert({
            instagram_user_id: myIgId,
            contact_id: fromUserId,
            direction: 'inbound',
            text: `[Comentário no Post] ${text}`,
            payload: value
          });
          if (commentMsgError) console.error('Erro ao salvar comentário em messages:', commentMsgError);

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
            // Automação já migrada pro canvas visual: motor novo cuida de tudo
            // (match de trigger, envio, condição/ação/delay) — não passa pelo
            // caminho legado abaixo.
            if (auto.flow_definition) {
              const result = await runFlow(auto, {
                ownerUserId,
                instagramUserId: myIgId,
                contactId: fromUserId,
                text,
                triggerType: 'comment',
                mediaId,
                recipientRef: { comment_id: commentId },
                resolveProfile: (id) => fetchInstagramUserProfile(id, igToken),
              });
              if (result.matched) {
                const { error: analyticsError } = await supabase.from('analytics_events').insert({
                  user_id: ownerUserId,
                  instagram_user_id: myIgId,
                  contact_id: fromUserId,
                  automation_id: auto.id,
                  event_type: 'comment',
                });
                logDbError('analytics_events.insert (comment, flow)', analyticsError);
                queueDrainNeeded = true;
                break;
              }
              continue;
            }

            // Verificar se é para post específico
            if (auto.specific_post_id && auto.specific_post_id !== mediaId) continue;

            // Verificar se o texto bate com as palavras-chave
            if (matchesKeywords(text, auto.keywords, auto.match_type)) {
              // Log de evento analítico
              const { error: analyticsLegacyError } = await supabase.from('analytics_events').insert({
                user_id: ownerUserId,
                instagram_user_id: myIgId,
                contact_id: fromUserId,
                automation_id: auto.id,
                event_type: 'comment'
              });
              logDbError('analytics_events.insert (comment, legado)', analyticsLegacyError);

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

              // Obter ou atualizar informações de perfil (username/name/foto)
              const { data: existingContact } = await supabase
                .from('contacts')
                .select('name, username, profile_picture_url')
                .eq('instagram_id', fromUserId)
                .single();

              let profileName = existingContact?.name || null;
              let profileUsername = fromUsername || existingContact?.username || fromUserId;
              let profilePictureUrl = existingContact?.profile_picture_url || null;

              if (!profileName) {
                const profile = await fetchInstagramUserProfile(fromUserId, igToken);
                profileName = profile.name;
                if (profile.username) profileUsername = profile.username;
                if (profile.profile_picture_url) profilePictureUrl = profile.profile_picture_url;
              }

              // Upsert do contato
              const { error: contactUpsertError } = await supabase.from('contacts').upsert({
                user_id: ownerUserId,
                instagram_id: fromUserId,
                instagram_user_id: myIgId,
                username: profileUsername,
                name: profileName,
                profile_picture_url: profilePictureUrl,
                last_automation_id: auto.id,
                last_active_automation_id: auto.id,
                conversation_state: nextState,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'instagram_id' });
              logDbError('contacts.upsert (comment, legado)', contactUpsertError);

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

              const { error: queueCommentError } = await supabase.from('queue').insert({
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
              if (queueCommentError) console.error('Erro ao enfileirar resposta de comentário:', queueCommentError);

              // Se não estiver capturando dados e houver respostas públicas configuradas, sortear uma e enfileirar
              if (auto.public_replies && auto.public_replies.length > 0) {
                const randomReply =
                  auto.public_replies[Math.floor(Math.random() * auto.public_replies.length)];
                const { error: publicReplyError } = await supabase.from('queue').insert({
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
                logDbError('queue.insert (public_reply, legado)', publicReplyError);
              }

              // Executar a fila imediatamente
              queueDrainNeeded = true;
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

        // A Meta pode reentregar a mesma mensagem mais de uma vez — ignora
        // qualquer repetição pra não rodar a automação (e reenviar o DM) de
        // novo. `mid` é o id único da mensagem; se vier ausente (alguns
        // eventos synthetic não têm), processa normalmente em vez de
        // arriscar deduplicar por engano com uma chave fraca.
        if (messageData.mid && (await isDuplicateWebhookEvent(`dm:${messageData.mid}`))) continue;

        const isStoryMention = !!messageData.story?.mention;
        const text = messageData.text || (isStoryMention ? '[Menção no Story]' : '');

        // Garante que o contato exista antes de logar a mensagem — mesma
        // razão do bloco de comentários acima.
        await ensureContactExists({
          user_id: ownerUserId,
          instagram_id: senderId,
          instagram_user_id: myIgId,
        });

        // Salvar mensagem recebida no Direct (inbound)
        const { error: dmMsgError } = await supabase.from('messages').insert({
          instagram_user_id: myIgId,
          contact_id: senderId,
          direction: 'inbound',
          text: text || 'Mensagem / Mídia recebida',
          payload: messageEvent
        });
        if (dmMsgError) console.error('Erro ao salvar DM em messages:', dmMsgError);

        // Buscar dados do contato existente para ver o estado da conversa
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('instagram_id', senderId)
          .single();

        // Se o contato está pausado num nó `waitForReply` de uma automação em canvas,
        // essa mensagem é a resposta que o fluxo está esperando — retoma o grafo com o
        // texto real e não roda o matching normal de trigger nem a máquina de estados
        // legada pra essa mensagem. Prioridade máxima: mesmo um clique de quick reply
        // (que também chega com `text` = título do botão) conta como a resposta aqui.
        if (contact?.flow_run_id && contact?.flow_node_id && contact?.last_active_automation_id) {
          const { data: pausedAuto } = await supabase
            .from('automations')
            .select('*')
            .eq('id', contact.last_active_automation_id)
            .single();

          const pausedNode = pausedAuto?.flow_definition?.nodes?.find((n: { id: string }) => n.id === contact.flow_node_id);

          if (pausedAuto?.flow_definition && pausedNode?.type === 'waitForReply') {
            const { error: contactUpdateError } = await supabase
              .from('contacts')
              .update({ last_response_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('instagram_id', senderId);
            logDbError('contacts.update (last_response_at, waitForReply)', contactUpdateError);

            await resumeFlow(
              pausedAuto,
              {
                ownerUserId,
                instagramUserId: myIgId,
                contactId: senderId,
                text,
                triggerType: 'dm',
                recipientRef: { id: senderId },
                resolveProfile: async () => ({ username: contact.username || null, name: contact.name || null, profile_picture_url: contact.profile_picture_url || null }),
              },
              contact.flow_node_id,
              'reply',
            );
            queueDrainNeeded = true;
            continue;
          }
        }

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
            const { error: linkClickError } = await supabase.from('analytics_events').insert({
              user_id: ownerUserId,
              instagram_user_id: myIgId,
              contact_id: senderId,
              automation_id: auto.id,
              event_type: 'link_clicked'
            });
            logDbError('analytics_events.insert (link_clicked)', linkClickError);

            // Atualizar last_response_at do contato (abre janela de 24h)
            const { error: contactQuickReplyError } = await supabase.from('contacts').upsert({
              user_id: ownerUserId,
              instagram_id: senderId,
              instagram_user_id: myIgId,
              last_response_at: new Date().toISOString(),
              last_automation_id: auto.id,
              conversation_state: 'idle',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'instagram_id' });
            logDbError('contacts.upsert (quick_reply)', contactQuickReplyError);

            // Enfileirar os followups (link e lembrete)
            await enqueueFollowups(senderId, auto, ownerUserId, myIgId);
            queueDrainNeeded = true;
          }
          continue;
        }

        if (!text) continue;

        // Tratar solicitação de exclusão de dados da Meta
        if (text.trim().toUpperCase() === 'EXCLUIR MEUS DADOS') {
          const { error: deleteContactError } = await supabase.from('contacts').delete().eq('instagram_id', senderId);
          logDbError('contacts.delete (EXCLUIR MEUS DADOS)', deleteContactError);
          const deletePayload = {
            recipient: { id: senderId },
            message: { text: 'Seus dados foram excluídos com sucesso do nosso banco de dados.' },
          };
          const { error: deleteReplyQueueError } = await supabase.from('queue').insert({
            user_id: ownerUserId,
            instagram_user_id: myIgId,
            contact_id: senderId,
            type: 'private_reply',
            recipient_id: senderId,
            payload: deletePayload,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
          });
          logDbError('queue.insert (confirmação EXCLUIR MEUS DADOS)', deleteReplyQueueError);
          queueDrainNeeded = true;
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

                  const { error: emailUpdateError } = await supabase
                    .from('contacts')
                    .update({
                      email: emailCandidate,
                      conversation_state: nextState,
                      last_response_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('instagram_id', senderId);
                  logDbError('contacts.update (email capturado)', emailUpdateError);

                  if (nextState === 'waiting_phone') {
                    // Perguntar telefone
                    const { error: askPhoneError } = await supabase.from('queue').insert({
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
                    logDbError('queue.insert (pedir telefone)', askPhoneError);
                  } else {
                    // Finalizou fluxo (apenas e-mail)
                    const { error: leadCapturedEmailError } = await supabase.from('analytics_events').insert({
                      user_id: ownerUserId,
                      instagram_user_id: myIgId,
                      contact_id: senderId,
                      automation_id: auto.id,
                      event_type: 'lead_captured'
                    });
                    logDbError('analytics_events.insert (lead_captured, email)', leadCapturedEmailError);

                    await enqueueFollowups(senderId, auto, ownerUserId, myIgId);
                    if (auto.webhook_url) {
                      triggerExternalWebhook(auto.webhook_url, { ...contact, email: emailCandidate }, auto);
                    }
                  }
                  queueDrainNeeded = true;
                  continue;
                } else {
                  // E-mail inválido
                  const { error: invalidEmailError } = await supabase.from('queue').insert({
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
                  logDbError('queue.insert (email inválido)', invalidEmailError);
                  queueDrainNeeded = true;
                  continue;
                }
              }

              if (contact.conversation_state === 'waiting_phone') {
                const phoneCandidate = text.replace(/\D/g, ''); // apenas números

                if (phoneCandidate.length >= 10 && phoneCandidate.length <= 15) {
                  // Salvar telefone e finalizar
                  const { error: phoneUpdateError } = await supabase
                    .from('contacts')
                    .update({
                      phone: phoneCandidate,
                      conversation_state: 'idle',
                      last_response_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('instagram_id', senderId);
                  logDbError('contacts.update (telefone capturado)', phoneUpdateError);

                  const { error: leadCapturedPhoneError } = await supabase.from('analytics_events').insert({
                    user_id: ownerUserId,
                    instagram_user_id: myIgId,
                    contact_id: senderId,
                    automation_id: auto.id,
                    event_type: 'lead_captured'
                  });
                  logDbError('analytics_events.insert (lead_captured, telefone)', leadCapturedPhoneError);

                  await enqueueFollowups(senderId, auto, ownerUserId, myIgId);
                  if (auto.webhook_url) {
                    triggerExternalWebhook(auto.webhook_url, { ...contact, phone: phoneCandidate }, auto);
                  }
                  queueDrainNeeded = true;
                  continue;
                } else {
                  // Telefone inválido
                  const { error: invalidPhoneError } = await supabase.from('queue').insert({
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
                  logDbError('queue.insert (telefone inválido)', invalidPhoneError);
                  queueDrainNeeded = true;
                  continue;
                }
              }
            }
          }
        }

        // Se o contato está IDLE, verificar gatilhos
        const isStoryReply = !!messageData.reply_to?.story;
        const repliedStoryId = messageData.reply_to?.story?.id;

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

        let matchedTrigger = false;

        for (const auto of automations) {
          // Automação já migrada pro canvas visual: motor novo cuida de tudo.
          if (auto.flow_definition) {
            const result = await runFlow(auto, {
              ownerUserId,
              instagramUserId: myIgId,
              contactId: senderId,
              text,
              triggerType: requiredTrigger as 'dm' | 'story' | 'story_mention',
              storyId: repliedStoryId,
              recipientRef: { id: senderId },
              resolveProfile: (id) => fetchInstagramUserProfile(id, igToken),
            });
            if (result.matched) {
              const { error: welcomeDmFlowError } = await supabase.from('analytics_events').insert({
                user_id: ownerUserId,
                instagram_user_id: myIgId,
                contact_id: senderId,
                automation_id: auto.id,
                event_type: 'welcome_dm_sent',
              });
              logDbError('analytics_events.insert (welcome_dm_sent, flow)', welcomeDmFlowError);
              queueDrainNeeded = true;
              matchedTrigger = true;
              break;
            }
            continue;
          }

          // Se a automação está restrita a uma story específica, ignora
          // respostas a qualquer outra story sua.
          if (isStoryReply && auto.specific_story_id && auto.specific_story_id !== repliedStoryId) continue;

          // Se for story mention, não precisa validar palavras-chave (assume true).
          if (isStoryMention || matchesKeywords(text, auto.keywords, auto.match_type)) {
            // Log do gatilho acionado
            const { error: welcomeDmLegacyError } = await supabase.from('analytics_events').insert({
              user_id: ownerUserId,
              instagram_user_id: myIgId,
              contact_id: senderId,
              automation_id: auto.id,
              event_type: 'welcome_dm_sent'
            });
            logDbError('analytics_events.insert (welcome_dm_sent, legado)', welcomeDmLegacyError);

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

            // Obter ou atualizar informações de perfil (username/name/foto)
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('name, username, profile_picture_url')
              .eq('instagram_id', senderId)
              .single();

            let profileName = existingContact?.name || null;
            let profileUsername = existingContact?.username || senderId;
            let profilePictureUrl = existingContact?.profile_picture_url || null;

            if (!profileName || profileUsername === senderId) {
              const profile = await fetchInstagramUserProfile(senderId, igToken);
              if (profile.name) profileName = profile.name;
              if (profile.username) profileUsername = profile.username;
              if (profile.profile_picture_url) profilePictureUrl = profile.profile_picture_url;
            }

            const { error: contactDmUpsertError } = await supabase.from('contacts').upsert({
              user_id: ownerUserId,
              instagram_id: senderId,
              instagram_user_id: myIgId,
              username: profileUsername,
              name: profileName,
              profile_picture_url: profilePictureUrl,
              last_automation_id: auto.id,
              last_active_automation_id: auto.id,
              conversation_state: nextState,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'instagram_id' });
            logDbError('contacts.upsert (dm, legado)', contactDmUpsertError);

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

            const { error: queueDmError } = await supabase.from('queue').insert({
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
            if (queueDmError) console.error('Erro ao enfileirar resposta de DM:', queueDmError);

            queueDrainNeeded = true;
            matchedTrigger = true;
            break;
          }
        }

        // Nenhuma automação bateu nessa mensagem. Se o contato não tinha
        // nenhum histórico de automação antes (nunca disparou nada, nunca
        // ficou num estado de captura), essa mensagem é ruído — alguém
        // mandando DM sem relação com nenhum fluxo (ex: mensagem pessoal
        // numa conta que também é usada como perfil pessoal). Remove o
        // registro "vazio" que ensureContactExists criou só pra permitir
        // o log da mensagem, em vez de deixar poluir "Leads & Público".
        if (!matchedTrigger && !contact?.last_automation_id && !contact?.conversation_state) {
          const { error: noiseCleanupError } = await supabase.from('contacts').delete().eq('instagram_id', senderId);
          logDbError('contacts.delete (contato sem automação)', noiseCleanupError);
        }
      }
    }
  }

  if (queueDrainNeeded) {
    try {
      await drainQueue();
    } catch (err) {
      console.error('Erro ao drenar a fila após o webhook:', err);
    }
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

    const { error: followupInsertError } = await supabase.from('followups').insert({
      user_id: userId,
      instagram_user_id: instagramUserId,
      automation_id: auto.id,
      contact_id: contactId,
      step: 1,
      status: 'queued',
    });
    logDbError('followups.insert (link imediato)', followupInsertError);

    const { error: linkQueueError } = await supabase.from('queue').insert({
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
    logDbError('queue.insert (link_dm)', linkQueueError);
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

      const { error: sequenceFollowupError } = await supabase.from('followups').insert({
        user_id: userId,
        instagram_user_id: instagramUserId,
        automation_id: auto.id,
        contact_id: contactId,
        step: i + 2, // Começa do step 2 (assumindo que o link imediato foi step 1)
        status: 'queued',
      });
      logDbError('followups.insert (sequência dinâmica)', sequenceFollowupError);

      const { error: sequenceQueueError } = await supabase.from('queue').insert({
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
      logDbError('queue.insert (sequence_dm)', sequenceQueueError);
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

    const { error: reminderFollowupError } = await supabase.from('followups').insert({
      user_id: userId,
      instagram_user_id: instagramUserId,
      automation_id: auto.id,
      contact_id: contactId,
      step: 2,
      status: 'queued',
    });
    logDbError('followups.insert (lembrete legado)', reminderFollowupError);

    const { error: reminderQueueError } = await supabase.from('queue').insert({
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
    logDbError('queue.insert (reminder_dm)', reminderQueueError);
  }
}

// matchesKeywords foi movida para src/lib/flow-engine/evaluator.ts (importada no topo do arquivo) —
// reaproveitada tanto pelo caminho legado abaixo quanto pelo motor de fluxo novo.
