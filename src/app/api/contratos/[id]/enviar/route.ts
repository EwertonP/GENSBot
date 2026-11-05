import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos, obterIpRequisicao } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';
import { hashDocumento, registrarEventoContrato } from '@/lib/contrato-assinatura';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const ip = obterIpRequisicao(req);

    // 1. Busca contrato
    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .select('id, agencia_id, titulo, status, conteudo_html, conteudo_final_html, token_publico, cliente_id, lead_id')
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (erroContrato || !contrato) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    if (contrato.status === 'assinado') {
      return respostaErro('Este contrato já foi concluído e assinado pelas partes.', 400);
    }

    // 2. Congela o conteúdo HTML e gera o hash SHA-256
    const conteudoCongelado = (contrato.conteudo_final_html || contrato.conteudo_html || '').trim();
    if (!conteudoCongelado) {
      return respostaErro('O contrato não possui conteúdo para envio.', 400);
    }

    const hash = hashDocumento(conteudoCongelado);
    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const agoraIso = agora.toISOString();

    // 3. Atualiza o contrato
    const { error: erroUpdate } = await db
      .from('contratos')
      .update({
        status: 'aguardando_assinatura',
        conteudo_final_html: conteudoCongelado,
        hash_documento: hash,
        enviado_em: agoraIso,
        expira_em: expiraEm,
        revogado_em: null,
        atualizado_em: agoraIso,
      })
      .eq('id', contrato.id);

    if (erroUpdate) {
      console.error('Erro ao atualizar contrato para envio:', erroUpdate);
      return respostaErro('Não foi possível registrar o envio do contrato.', 500);
    }

    // 4. Registra evento na trilha de auditoria
    await registrarEventoContrato(
      contrato.id,
      membro.agencia_id,
      'enviado',
      {
        expira_em: expiraEm,
        canal: body.canal || 'link',
        hash_documento: hash,
      },
      membro.id,
      ip
    );

    // 5. Prepara URLs e texto de compartilhamento (WhatsApp)
    const host = req.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : '');
    const linkPublico = `${baseUrl}/contrato/${contrato.token_publico}`;

    const textoWhatsapp = `Olá! Segue o link para conferência e assinatura eletrônica do contrato:\n\n📄 *${contrato.titulo}*\n\nAcesse com segurança e assine direto pelo link abaixo:\n🔗 ${linkPublico}\n\n_(Este link é seguro e tem validade de 15 dias)_`;

    return NextResponse.json({
      ok: true,
      mensagem: 'Contrato congelado e link de assinatura preparado com sucesso!',
      link: linkPublico,
      token_publico: contrato.token_publico,
      textoWhatsapp,
      expira_em: expiraEm,
      hash_documento: hash,
    });
  } catch (err) {
    console.error('Erro na rota POST /api/contratos/[id]/enviar:', err);
    return respostaErro('Falha ao processar envio do contrato.', 500);
  }
}
