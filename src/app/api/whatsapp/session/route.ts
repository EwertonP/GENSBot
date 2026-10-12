import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { ehUuid } from '@/lib/clientes';

// GET: Retorna o status da sessão do WhatsApp do cliente
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  let clienteId = searchParams.get('cliente_id');

  if (membro.papel === 'cliente') {
    clienteId = membro.cliente_id || null;
  }

  try {
    let query = serviceSupabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('agencia_id', membro.agencia_id);

    if (clienteId && ehUuid(clienteId)) {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.is('cliente_id', null);
    }

    const { data: session, error } = await query.maybeSingle();
    if (error) return traduzirErroBanco(error, 'GET /api/whatsapp/session');

    return NextResponse.json({ session: session || null });
  } catch (err: unknown) {
    console.error('Erro ao buscar sessão do WhatsApp:', err);
    return respostaErro('Falha ao buscar sessão do WhatsApp.', 500);
  }
}

// POST: Inicializa uma sessão e obtém o QR Code no OpenWA
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    let clienteId = body.cliente_id;

    if (membro.papel === 'cliente') {
      clienteId = membro.cliente_id || null;
    }

    const sessionName = clienteId ? `cliente_${clienteId}` : `agencia_${membro.agencia_id}`;

    // 1. Cria ou atualiza o registro no banco
    const { data: session, error } = await serviceSupabase
      .from('whatsapp_sessions')
      .upsert({
        agencia_id: membro.agencia_id,
        cliente_id: clienteId || null,
        session_name: sessionName,
        status: 'aguardando_qrcode',
        ia_escuta_ativa: true,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'agencia_id,cliente_id' })
      .select()
      .single();

    if (error) return traduzirErroBanco(error, 'POST /api/whatsapp/session');

    // 2. Comunicação com a API do OpenWA
    const openwaUrl = process.env.OPENWA_API_URL?.replace(/\/$/, '');
    const openwaKey = process.env.OPENWA_API_KEY || process.env.API_MASTER_KEY;

    let qrCode: string | null = null;
    let detalhesOpenWA: any = null;

    if (openwaUrl) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (openwaKey) {
        headers['X-API-Key'] = openwaKey;
        headers['Authorization'] = `Bearer ${openwaKey}`;
      }

      try {
        // Passo A: Verifica se a sessão já existe no OpenWA
        const resList = await fetch(`${openwaUrl}/api/sessions`, { headers });
        let sessionUuid: string | null = null;
        let sessionStatus: string | null = null;

        if (resList.ok) {
          const sessions = await resList.json();
          if (Array.isArray(sessions)) {
            const found = sessions.find((s: any) => s.name === sessionName || s.sessionId === sessionName || s.id === sessionName);
            if (found) {
              sessionUuid = found.id || found.sessionId;
              sessionStatus = found.status;
            }
          }
        }

        // Passo B: Se não existir, cria a sessão
        if (!sessionUuid) {
          const resCreate = await fetch(`${openwaUrl}/api/sessions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: sessionName }),
          });

          if (resCreate.ok) {
            const createData = await resCreate.json();
            sessionUuid = createData.id || createData.sessionId || createData.data?.id;
          }
        }

        const targetId = sessionUuid || sessionName;

        // Passo C: Se a sessão não estiver ativa ou com qr_ready, inicia
        if (sessionStatus !== 'WORKING' && sessionStatus !== 'ready') {
          await fetch(`${openwaUrl}/api/sessions/${targetId}/start`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              config: {
                engine: 'baileys',
                webhook: `${process.env.NEXT_PUBLIC_APP_URL || 'https://allingens.vercel.app'}/api/webhook/whatsapp`,
              },
            }),
          }).catch(() => null);
        }

        // Passo D: Polling com até 5 tentativas (esperando o Baileys gerar o QR code)
        for (let tentativa = 1; tentativa <= 5; tentativa++) {
          await new Promise((r) => setTimeout(r, 1200));

          const resQr = await fetch(`${openwaUrl}/api/sessions/${targetId}/qr`, { headers });
          if (resQr.ok) {
            const qrData = await resQr.json();
            qrCode = qrData.qrCode || qrData.qr || qrData.dataUrl || null;
            detalhesOpenWA = qrData;
            if (qrCode) break;
          } else {
            detalhesOpenWA = {
              tentativa,
              status: resQr.status,
              statusText: resQr.statusText,
              text: await resQr.text(),
            };
          }
        }
      } catch (errGateway) {
        console.error('[OpenWA API] Falha de comunicação com gateway:', errGateway);
        detalhesOpenWA = { erro: String(errGateway) };
      }
    }

    return NextResponse.json({
      session,
      qrCode,
      gatewayConfigurado: Boolean(openwaUrl),
      detalhes: detalhesOpenWA,
      mensagem: qrCode
        ? 'QR Code gerado com sucesso.'
        : openwaUrl
        ? 'Aguardando inicialização do QR Code no OpenWA.'
        : 'OPENWA_API_URL não configurado na Vercel.',
    });
  } catch (err: unknown) {
    console.error('Erro ao processar sessão do WhatsApp:', err);
    return respostaErro('Falha interna ao processar sessão do WhatsApp.', 500);
  }
}
