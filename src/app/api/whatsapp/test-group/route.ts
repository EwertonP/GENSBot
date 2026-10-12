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

    const sessionName = `cliente-${cliente_id}`;
    const grupoDestino = grupo_id.trim();

    const textoTeste = [
      `🔔 *GENSBot - Teste de Notificação de Demandas & Aprovações*`,
      ``,
      `Olá, equipe de *${cliente.nome}*! 👋`,
      `Este grupo foi configurado com sucesso para receber os links de aprovação de novos posts, reels e carrosséis.`,
      ``,
      `✅ _Conexão com WhatsApp Copiloto ativa e pronta para avisos de aprovação._`,
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
