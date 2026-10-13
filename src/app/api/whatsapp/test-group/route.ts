import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { ehUuid } from '@/lib/clientes';
import { enviarMensagemOpenWA } from '@/lib/openwa-client';

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const { cliente_id, grupo_id } = body;

    if (!cliente_id || !ehUuid(cliente_id)) {
      return respostaErro('cliente_id inválido.', 400);
    }

    if (!grupo_id || typeof grupo_id !== 'string') {
      return respostaErro('Informe o ID ou JID do Grupo do WhatsApp (ex: 12036302482394@g.us).', 400);
    }

    const { data: cliente, error } = await serviceSupabase
      .from('clientes')
      .select('id, nome, whatsapp_grupo_id')
      .eq('id', cliente_id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (error) return traduzirErroBanco(error, 'POST /api/whatsapp/test-group');
    if (!cliente) return respostaErro('Cliente não encontrado.', 404);

    // Identifica qual sessão do WhatsApp está conectada:
    // 1. Sessão do membro logado (designer/dono)
    // 2. Sessão geral da agência
    // 3. Sessão do cliente
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('session_name, membro_id, cliente_id, status')
      .eq('agencia_id', membro.agencia_id)
      .eq('status', 'conectado');

    let sessionName = `agencia-${membro.agencia_id}`;
    if (sessoes && sessoes.length > 0) {
      const sessaoMembro = sessoes.find((s: any) => s.membro_id === membro.id);
      if (sessaoMembro) {
        sessionName = sessaoMembro.session_name;
      } else {
        const sessaoAgencia = sessoes.find((s: any) => !s.cliente_id && !s.membro_id);
        if (sessaoAgencia) {
          sessionName = sessaoAgencia.session_name;
        } else {
          sessionName = sessoes[0].session_name;
        }
      }
    }

    let grupoDestino = grupo_id.trim();

    // Se o usuário informou o link de convite em vez do JID, resolve automaticamente
    if (grupoDestino.includes('chat.whatsapp.com/')) {
      const match = grupoDestino.match(/chat\.whatsapp\.com\/([a-zA-Z0-9_-]+)/i);
      const inviteCode = match ? match[1] : '';
      if (inviteCode) {
        const { getOpenWAConfig } = await import('@/lib/openwa-client');
        const { url: openwaUrl, headers } = getOpenWAConfig();
        if (openwaUrl) {
          try {
            const resJoin = await fetch(`${openwaUrl}/api/sessions/${encodeURIComponent(sessionName)}/groups/join-info?code=${encodeURIComponent(inviteCode)}`, { headers, signal: AbortSignal.timeout(4000) });
            if (resJoin.ok) {
              const dataJoin = await resJoin.json();
              if (dataJoin.id && String(dataJoin.id).includes('@g.us')) {
                grupoDestino = String(dataJoin.id);
              }
            }
          } catch {}
        }
      }
    }

    if (!grupoDestino.includes('@')) {
      if (grupoDestino.length >= 15 || grupoDestino.includes('-')) {
        grupoDestino = `${grupoDestino}@g.us`;
      }
    }

    const textoTeste = [
      `🔔 *GENSBot - Teste de Notificação de Demandas & Aprovações*`,
      ``,
      `Olá, equipe de *${cliente.nome}*! 👋`,
      `Este grupo foi configurado com sucesso para receber os links de aprovação de novos posts, reels e carrosséis.`,
      ``,
      `✅ _Conexão com WhatsApp ativa e pronta para avisos de aprovação._`,
    ].join('\n');

    const resultado = await enviarMensagemOpenWA({
      sessionName,
      para: grupoDestino,
      texto: textoTeste,
    });

    if (!resultado.ok) {
      return respostaErro(resultado.erro || 'Falha ao enviar mensagem para o grupo via OpenWA.', 400);
    }

    // Salva o grupo no cadastro do cliente se ainda não estava salvo
    await serviceSupabase
      .from('clientes')
      .update({ whatsapp_grupo_id: grupoDestino })
      .eq('id', cliente_id);

    return NextResponse.json({
      ok: true,
      mensagem: 'Mensagem de teste enviada com sucesso para o grupo!',
      messageId: resultado.messageId,
    });
  } catch (err: unknown) {
    console.error('Erro ao testar envio no grupo do WhatsApp:', err);
    return respostaErro('Erro interno ao testar grupo do WhatsApp.', 500);
  }
}
