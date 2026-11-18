import { NextResponse, after } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { sincronizarMensagemEAtualizarCrm } from '@/lib/whatsapp-shadow-engine';
import { validarWebhookOpenWA } from '@/lib/segredos';
import { jidParaE164 } from '@/lib/telefone';
import { segredoDaSessao } from '@/lib/openwa-segredo';

// POST: Webhook oficial para receber eventos do OpenWA
export async function POST(req: Request) {
  // Barato e antes de qualquer leitura: em produção, sem segredo nenhum nem se olha o corpo.
  if (process.env.NODE_ENV === 'production' && !req.headers.get('x-openwa-secret') && !req.headers.get('authorization')) {
    return NextResponse.json({ error: 'Assinatura inválida do webhook' }, { status: 401 });
  }

  try {
    const body = await req.json();

    const { event, session, data } = body;

    // O segredo depende da sessão (cada cliente tem o seu); o nome dela só se sabe lendo o corpo.
    const nomeDaSessao: string = session || body.session || new URL(req.url).searchParams.get('session') || 'default';
    let segredoSessao: string | null;
    try {
      segredoSessao = await segredoDaSessao(nomeDaSessao);
    } catch (err) {
      console.error('[OpenWA Webhook] Não consegui ler o segredo da sessão:', err);
      return NextResponse.json({ error: 'Falha ao validar o webhook' }, { status: 503 });
    }
    const negado = validarWebhookOpenWA(req, segredoSessao);
    if (negado) return negado;

    // Se for evento de mensagem (recebida ou enviada)
    // `message.received` / `message.sent` é o formato do OpenWA; os demais são formatos antigos.
    const EVENTOS_DE_MENSAGEM = ['onMessage', 'message', 'message_create', 'message.received', 'message.sent'];
    if (EVENTOS_DE_MENSAGEM.includes(event) || body.message) {
      const msg = data || body.message || body;
      // O OpenWA manda só o UUID da sessão (`sessionId`); o nome vem no `?session=` da URL cadastrada.
      const sessionName = session || body.session || new URL(req.url).searchParams.get('session') || 'default';

      // 1. Localiza a sessão para identificar o cliente_id e agencia_id
      const { data: sessionData } = await serviceSupabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('session_name', sessionName)
        .maybeSingle();

      // Sessão que não está cadastrada não pertence a nenhuma agência: descarta em vez de
      // gravar tudo na agência padrão.
      if (!sessionData) {
        return NextResponse.json({ ignored: 'unknown_session' });
      }

      const agenciaId = sessionData.agencia_id;
      const clienteId = sessionData.cliente_id || null;

      const messageId = msg.id || msg.key?.id || `${Date.now()}-${Math.random()}`;
      const deMim = Boolean(msg.fromMe || msg.key?.fromMe);
      // No OpenWA, `chatId` é sempre o contato (nos dois sentidos). Sem ele, mantém o que valia antes.
      const remetente: string =
        (deMim ? msg.chatId || msg.key?.remoteJid || msg.from : msg.from || msg.sender || msg.key?.remoteJid || msg.chatId) || '';
      // Com RESOLVE_LID_TO_PHONE=true o OpenWA manda `senderPhone` quando o JID é `@lid`.
      const telefoneContato = jidParaE164(remetente) || (msg.senderPhone ? jidParaE164(`${String(msg.senderPhone).replace(/\D/g, '')}@c.us`) : '');
      const conteudo = msg.body || msg.text || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const nomeContato = msg.pushName || msg.notifyName || msg.contact?.pushName || msg.contact?.name || null;

      // Ignora mensagens de grupos para não poluir o CRM
      if (remetente.includes('@g.us') || msg.isGroup) {
        return NextResponse.json({ ignored: 'group_message' });
      }

      // 2. Salva a mensagem. ignoreDuplicates + select devolve só o que foi inserido agora:
      // se o gateway reenviar o evento, nada é reprocessado (follow-ups, IA, custo).
      const { data: inseridas } = await serviceSupabase
        .from('whatsapp_mensagens')
        .upsert(
          {
            agencia_id: agenciaId,
            cliente_id: clienteId,
            session_id: sessionData?.id || null,
            message_id: messageId,
            remetente,
            de_mim: deMim,
            tipo: msg.type || 'texto',
            conteudo,
            nome_contato: nomeContato,
            timestamp_msg: new Date().toISOString(),
          },
          { onConflict: 'agencia_id,message_id', ignoreDuplicates: true }
        )
        .select('id');

      if (!inseridas || inseridas.length === 0) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      // JID `@lid` sem telefone resolvido: a mensagem fica guardada, mas não dá para criar
      // lead nem régua de follow-up com um número que não existe.
      if (!telefoneContato) {
        console.warn('[OpenWA Webhook] Contato sem telefone (@lid). Ative RESOLVE_LID_TO_PHONE=true no OpenWA.');
        return NextResponse.json({ ok: true, processed: false, skipped: 'sem_telefone' });
      }

      // O resto (follow-ups e análise da IA) roda depois da resposta: o gateway recebe o 200
      // na hora e não reenvia o evento por timeout enquanto o modelo pensa.
      after(async () => {
        try {
          if (!deMim) {
            // Mensagem do paciente/lead: CANCELA follow-ups pendentes imediatamente
            const { cancelarFollowUpsDoLead } = await import('@/lib/whatsapp-followup');
            await cancelarFollowUpsDoLead(agenciaId, telefoneContato);
          } else {
            // Mensagem da secretária: AGENDAR nova régua de follow-up (3h -> 8h -> 48h)
            const { agendarReguaFollowUp } = await import('@/lib/whatsapp-followup');
            await agendarReguaFollowUp({
              agenciaId,
              clienteId,
              telefone: telefoneContato,
              nomeContato,
              sessionName,
            });
          }

          // Atendimento por IA: só texto do paciente numa sessão de cliente. Ela escreve e põe na fila
          // (nunca envia daqui); se o atendimento está desligado, retorna na primeira consulta.
          if (!deMim && clienteId && conteudo?.trim()) {
            try {
              const { tratarMensagemDoPaciente } = await import('@/lib/atendimento/assistente');
              await tratarMensagemDoPaciente({ db: serviceSupabase, agenciaId, clienteId, remetente, sessionName, texto: conteudo, nomeContato });
            } catch (err) {
              console.error('[OpenWA Webhook] Erro no atendimento por IA:', err);
            }
          }

          // Se a escuta ativa estiver habilitada nesta sessão:
          if (sessionData.ia_escuta_ativa !== false && conteudo?.trim()) {
            // Últimas 6 mensagens da conversa para dar contexto à IA
            const { data: historicoRecente } = await serviceSupabase
              .from('whatsapp_mensagens')
              .select('de_mim, conteudo, timestamp_msg')
              .eq('agencia_id', agenciaId)
              .eq('remetente', remetente)
              .order('timestamp_msg', { ascending: false })
              .limit(6);

            const mensagensFormatadas = (historicoRecente || [])
              .reverse()
              .map((m) => `${m.de_mim ? 'Secretária' : 'Paciente'}: ${m.conteudo}`);

            await sincronizarMensagemEAtualizarCrm({
              agenciaId,
              clienteId,
              remetenteTelefone: telefoneContato,
              remetenteNome: nomeContato,
              mensagensTexto: mensagensFormatadas.length > 0 ? mensagensFormatadas : [`${deMim ? 'Secretária' : 'Paciente'}: ${conteudo}`],
              autoCriarCards: sessionData.auto_criar_cards !== false,
              autoMoverEstagios: sessionData.auto_mover_estagios !== false,
            });
          }
        } catch (err) {
          console.error('[OpenWA Webhook] Erro no processamento posterior:', err);
        }
      });

      return NextResponse.json({ ok: true, processed: true });
    }

    // Eventos de status da conexão do QR Code
    if (event === 'onStateChange' || event === 'status' || event === 'connection.update') {
      const sessionName = session || body.session;
      const statusRecebido = body.status || data?.status || data?.connection;

      let statusFormatado = 'desconectado';
      if (statusRecebido === 'open' || statusRecebido === 'CONNECTED') statusFormatado = 'conectado';
      else if (statusRecebido === 'connecting' || statusRecebido === 'QR') statusFormatado = 'aguardando_qrcode';

      if (sessionName) {
        await serviceSupabase
          .from('whatsapp_sessions')
          .update({
            status: statusFormatado,
            atualizado_em: new Date().toISOString(),
            conectado_em: statusFormatado === 'conectado' ? new Date().toISOString() : undefined,
          })
          .eq('session_name', sessionName);
      }

      return NextResponse.json({ ok: true, status: statusFormatado });
    }

    return NextResponse.json({ ok: true, unhandledEvent: event });
  } catch (err: any) {
    console.error('[OpenWA Webhook] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro no webhook' }, { status: 500 });
  }
}
