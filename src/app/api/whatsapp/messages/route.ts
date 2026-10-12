import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { ehUuid } from '@/lib/clientes';

// GET: Retorna o histórico de mensagens de uma conversa de WhatsApp
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const telefone = searchParams.get('telefone');
  let clienteId = searchParams.get('cliente_id');

  if (membro.papel === 'cliente') {
    clienteId = membro.cliente_id || null;
  }

  if (!telefone) {
    return respostaErro('Parâmetro telefone é obrigatório.', 400);
  }

  const telefoneLimpo = telefone.replace(/\D/g, '');

  try {
    let query = serviceSupabase
      .from('whatsapp_mensagens')
      .select('*')
      .eq('agencia_id', membro.agencia_id)
      .eq('remetente', telefoneLimpo)
      .order('timestamp_msg', { ascending: true })
      .limit(100);

    if (clienteId && ehUuid(clienteId)) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query;
    if (error) return traduzirErroBanco(error, 'GET /api/whatsapp/messages');

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error('Erro ao buscar mensagens do WhatsApp:', err);
    return respostaErro('Falha interna ao buscar mensagens do WhatsApp.', 500);
  }
}

// POST: Envia mensagem manual no WhatsApp via OpenWA gateway
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const { telefone, texto, cliente_id } = await req.json();

    if (!telefone || !texto) {
      return respostaErro('telefone e texto são obrigatórios.', 400);
    }

    let targetClienteId = cliente_id;
    if (membro.papel === 'cliente') {
      targetClienteId = membro.cliente_id || null;
    }

    const telefoneLimpo = telefone.replace(/\D/g, '');
    const sessionName = targetClienteId ? `cliente_${targetClienteId}` : `agencia_${membro.agencia_id}`;

    const openwaUrl = process.env.OPENWA_API_URL;
    const openwaKey = process.env.OPENWA_API_KEY || process.env.API_MASTER_KEY;

    let messageId = `msg-out-${Date.now()}`;

    // Se o gateway OpenWA estiver ativo, envia a mensagem pelo Baileys
    if (openwaUrl) {
      try {
        const destJid = telefoneLimpo.includes('@s.whatsapp.net') ? telefoneLimpo : `${telefoneLimpo}@s.whatsapp.net`;
        const res = await fetch(`${openwaUrl.replace(/\/$/, '')}/api/messages/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(openwaKey ? { Authorization: `Bearer ${openwaKey}` } : {}),
          },
          body: JSON.stringify({
            session: sessionName,
            to: destJid,
            text: texto.trim(),
          }),
        });

        if (res.ok) {
          const resData = await res.json();
          messageId = resData.id || resData.messageId || messageId;
        } else {
          console.warn('[OpenWA API] Resposta de envio não-200:', await res.text());
        }
      } catch (errGateway) {
        console.error('[OpenWA API] Falha de conexão ao enviar mensagem:', errGateway);
      }
    }

    // Salva a mensagem enviada no banco local
    const { data: mensagemSalva, error: errSalvar } = await serviceSupabase
      .from('whatsapp_mensagens')
      .insert({
        agencia_id: membro.agencia_id,
        cliente_id: targetClienteId || null,
        message_id: messageId,
        remetente: telefoneLimpo,
        de_mim: true,
        tipo: 'texto',
        conteudo: texto.trim(),
        timestamp_msg: new Date().toISOString(),
      })
      .select()
      .single();

    if (errSalvar) {
      return traduzirErroBanco(errSalvar, 'POST /api/whatsapp/messages');
    }

    return NextResponse.json({ sucesso: true, mensagem: mensagemSalva });
  } catch (err: unknown) {
    console.error('Erro ao enviar mensagem no WhatsApp:', err);
    return respostaErro('Falha interna ao enviar mensagem no WhatsApp.', 500);
  }
}
