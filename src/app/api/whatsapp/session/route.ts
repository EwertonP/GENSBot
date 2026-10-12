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
    let openwaUrl = process.env.OPENWA_API_URL?.trim().replace(/\/$/, '') || null;
    if (openwaUrl && !openwaUrl.startsWith('http://') && !openwaUrl.startsWith('https://')) {
      openwaUrl = `https://${openwaUrl}`;
    }
    const openwaKey = process.env.OPENWA_API_KEY || process.env.API_MASTER_KEY;

    let gatewayTeste = null;
    if (openwaUrl) {
      try {
        const res = await fetch(`${openwaUrl}/api/sessions`, {
          headers: openwaKey ? { 'X-API-Key': openwaKey } : {},
          signal: AbortSignal.timeout(4000),
        });
        gatewayTeste = {
          conectou: res.ok,
          status: res.status,
          statusText: res.statusText,
        };
      } catch (err: unknown) {
        gatewayTeste = {
          conectou: false,
          erro: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return NextResponse.json({
      session: session || null,
      diagnostico: {
        urlConfigurada: Boolean(openwaUrl),
        urlPrefixo: openwaUrl ? openwaUrl.substring(0, 20) + '...' : null,
        keyConfigurada: Boolean(openwaKey),
        gatewayTeste,
      },
    });
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

    // O nome da sessão no OpenWA aceita apenas letras, números e hifens: /^[a-zA-Z0-9-]+$/
    const sessionName = clienteId ? `cliente-${clienteId}` : `agencia-${membro.agencia_id}`;

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
    let openwaUrl = process.env.OPENWA_API_URL?.trim().replace(/\/$/, '') || null;
    if (openwaUrl && !openwaUrl.startsWith('http://') && !openwaUrl.startsWith('https://')) {
      openwaUrl = `https://${openwaUrl}`;
    }
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
            const found = sessions.find((s: any) => s.name === sessionName || s.name === sessionName.replace('-', '_'));
            if (found) {
              sessionUuid = found.id;
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
            sessionUuid = createData.id;
          } else {
            const erroCriacao = await resCreate.text();
            detalhesOpenWA = { erroCriacao, status: resCreate.status };
          }
        }

        if (!sessionUuid) {
          throw new Error(detalhesOpenWA?.erroCriacao || 'Não foi possível obter o UUID da sessão no OpenWA.');
        }

        // Passo C: Se a sessão não estiver em execução, dispara o start (sem body)
        if (sessionStatus !== 'ready' && sessionStatus !== 'qr_ready') {
          await fetch(`${openwaUrl}/api/sessions/${sessionUuid}/start`, {
            method: 'POST',
            headers,
          }).catch(() => null);
        }

        // Passo D: Polling com até 5 tentativas para buscar o QR Code
        for (let tentativa = 1; tentativa <= 5; tentativa++) {
          await new Promise((r) => setTimeout(r, 1200));

          const resQr = await fetch(`${openwaUrl}/api/sessions/${sessionUuid}/qr`, { headers });
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
        detalhesOpenWA = { erro: errGateway instanceof Error ? errGateway.message : String(errGateway) };
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
