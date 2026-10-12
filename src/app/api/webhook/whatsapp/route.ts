import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { sincronizarMensagemEAtualizarCrm } from '@/lib/whatsapp-shadow-engine';

// POST: Webhook oficial para receber eventos do OpenWA
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validação de token secreto do webhook se configurado
    const secretKey = process.env.OPENWA_WEBHOOK_SECRET;
    const authHeader = req.headers.get('x-openwa-secret') || req.headers.get('authorization');
    if (secretKey && authHeader !== secretKey && authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json({ error: 'Assinatura inválida do webhook' }, { status: 401 });
    }

    const { event, session, data } = body;

    // Se for evento de mensagem (recebida ou enviada)
    if (event === 'onMessage' || event === 'message' || event === 'message_create' || body.message) {
      const msg = data || body.message || body;
      const sessionName = session || body.session || 'default';

      // 1. Localiza a sessão para identificar o cliente_id e agencia_id
      const { data: sessionData } = await serviceSupabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('session_name', sessionName)
        .maybeSingle();

      const agenciaId = sessionData?.agencia_id || 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
      const clienteId = sessionData?.cliente_id || null;

      const messageId = msg.id || msg.key?.id || `${Date.now()}-${Math.random()}`;
      const remetente = msg.from || msg.sender || msg.key?.remoteJid || '';
      const deMim = Boolean(msg.fromMe || msg.key?.fromMe);
      const conteudo = msg.body || msg.text || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const nomeContato = msg.pushName || msg.notifyName || null;

      // Ignora mensagens de grupos para não poluir o CRM
      if (remetente.includes('@g.us') || msg.isGroup) {
        return NextResponse.json({ ignored: 'group_message' });
      }

      // 2. Salva no banco a mensagem
      await serviceSupabase.from('whatsapp_mensagens').upsert({
        agencia_id: agenciaId,
        cliente_id: clienteId,
        session_id: sessionData?.id || null,
        message_id: messageId,
        remetente: remetente.replace(/\D/g, ''),
        de_mim: deMim,
        tipo: msg.type || 'texto',
        conteudo,
        nome_contato: nomeContato,
        timestamp_msg: new Date().toISOString(),
      }, { onConflict: 'agencia_id,message_id' });

      // 3. Se a escuta ativa estiver habilitada nesta sessão:
      if (sessionData?.ia_escuta_ativa !== false && conteudo?.trim()) {
        // Busca as últimas 6 mensagens dessa conversa para dar contexto completo à IA
        const { data: historicoRecente } = await serviceSupabase
          .from('whatsapp_mensagens')
          .select('de_mim, conteudo, timestamp_msg')
          .eq('agencia_id', agenciaId)
          .eq('remetente', remetente.replace(/\D/g, ''))
          .order('timestamp_msg', { ascending: false })
          .limit(6);

        const mensagensFormatadas = (historicoRecente || [])
          .reverse()
          .map((m) => `${m.de_mim ? 'Secretária' : 'Paciente'}: ${m.conteudo}`);

        // Dispara em background a sincronização com o CRM
        await sincronizarMensagemEAtualizarCrm({
          agenciaId,
          clienteId,
          remetenteTelefone: remetente,
          remetenteNome: nomeContato,
          mensagensTexto: mensagensFormatadas.length > 0 ? mensagensFormatadas : [`${deMim ? 'Secretária' : 'Paciente'}: ${conteudo}`],
        });
      }

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
