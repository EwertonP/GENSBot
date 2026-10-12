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
  } catch (err: any) {
    return respostaErro('Falha ao buscar sessão do WhatsApp.', 500);
  }
}

// POST: Inicializa uma sessão ou solicita geração de QR Code no OpenWA
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

    // 2. Se a URL do OpenWA estiver configurada nas variáveis de ambiente, comunica com a API
    const openwaUrl = process.env.OPENWA_API_URL;
    const openwaKey = process.env.OPENWA_API_KEY;

    let qrCode = null;

    if (openwaUrl) {
      try {
        const res = await fetch(`${openwaUrl.replace(/\/$/, '')}/api/sessions/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(openwaKey ? { Authorization: `Bearer ${openwaKey}` } : {}),
          },
          body: JSON.stringify({
            name: sessionName,
            config: {
              engine: 'baileys',
              webhook: `${process.env.NEXT_PUBLIC_APP_URL || 'https://allingens.vercel.app'}/api/webhook/whatsapp`,
            },
          }),
        });

        if (res.ok) {
          const openwaData = await res.json();
          qrCode = openwaData.qr || openwaData.qrcode || null;
        }
      } catch (err) {
        console.error('[OpenWA API] Conexão pendente com gateway:', err);
      }
    }

    return NextResponse.json({
      session,
      qrCode,
      gatewayConfigurado: Boolean(openwaUrl),
      mensagem: openwaUrl
        ? 'Sessão iniciada no OpenWA. Escaneie o QR Code.'
        : 'Sessão cadastrada com sucesso. O gateway OpenWA pode ser conectado nas variáveis de ambiente.',
    });
  } catch (err: any) {
    return respostaErro('Falha ao iniciar sessão do WhatsApp.', 500);
  }
}
