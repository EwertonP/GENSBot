import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { ehUuid } from '@/lib/clientes';
import { carregarSessoesConectadas, escolherSessaoEnvio } from '@/lib/whatsapp-sessions';

// GET: Retorna o histórico de mensagens de uma conversa de WhatsApp
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
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
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
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

    // O cliente informado precisa ser da agência de quem envia: o nome da sessão é derivado
    // dele, e sem essa checagem daria para usar a sessão de outra agência.
    if (targetClienteId) {
      if (!ehUuid(targetClienteId)) return respostaErro('cliente_id inválido.', 400);
      const { data: clienteDaAgencia } = await serviceSupabase
        .from('clientes')
        .select('id')
        .eq('id', targetClienteId)
        .eq('agencia_id', membro.agencia_id)
        .maybeSingle();
      if (!clienteDaAgencia) return respostaErro('Cliente não encontrado.', 404);
    }

    const sessoes = await carregarSessoesConectadas(membro.agencia_id);
    const sessao = escolherSessaoEnvio(sessoes, {
      papel: membro.papel,
      membroId: membro.id,
      clienteId: targetClienteId || null,
    });
    if (!sessao) {
      return respostaErro('Nenhum WhatsApp conectado disponível para este envio. Conecte o número no Perfil.', 400);
    }

    // Envia a mensagem pelo gateway centralizado OpenWA
    const { enviarMensagemOpenWA } = await import('@/lib/openwa-client');
    const resultado = await enviarMensagemOpenWA({
      sessionName: sessao.session_name,
      para: telefoneLimpo,
      texto: texto.trim(),
    });
    if (!resultado.ok) {
      return respostaErro(resultado.erro || 'Não foi possível enviar a mensagem no WhatsApp.', 502);
    }
    const messageId = resultado.messageId || `msg-out-${Date.now()}`;

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
