import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';
import { obterIpRequisicao } from '@/lib/documentos-server';
import {
  validarDadosSignatario,
  podeAssinarContrato,
  registrarEventoContrato,
  hashDocumento,
} from '@/lib/contrato-assinatura';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const body = await req.json();
    const nome = (body.nome || '').trim();
    const doc = (body.doc || '').trim();
    const email = body.email ? body.email.trim() : null;
    const imagem = body.imagem || null;

    // 1. Validação dos dados do signatário
    const validacao = validarDadosSignatario(nome, doc, email);
    if (!validacao.valido) {
      return respostaErro(validacao.erro || 'Dados de identificação inválidos.', 400);
    }

    // 2. Busca contrato pelo token público
    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .select('id, agencia_id, cliente_id, lead_id, titulo, status, valor_mensal, expira_em, revogado_em, conteudo_html, conteudo_final_html, hash_documento')
      .eq('token_publico', token)
      .maybeSingle();

    if (erroContrato || !contrato) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    // 3. Validação do ciclo de vida e validade
    const checagemAssinatura = podeAssinarContrato(contrato);
    if (!checagemAssinatura.pode) {
      return respostaErro(checagemAssinatura.motivo || 'Este contrato não pode ser assinado.', 400);
    }

    const ip = obterIpRequisicao(req);
    const userAgent = req.headers.get('user-agent') || null;
    const agora = new Date().toISOString();

    // Se ainda não tiver hash e conteúdo congelado, calcula agora
    const conteudoCongelado = contrato.conteudo_final_html || contrato.conteudo_html || '';
    const hash = contrato.hash_documento || hashDocumento(conteudoCongelado);

    // 4. Atualização atômica condicional: só atualiza se estiver em 'aguardando_assinatura' ou 'rascunho'
    const { data: atualizado, error: erroAssina } = await db
      .from('contratos')
      .update({
        status: 'assinado_cliente',
        assinatura_cliente_nome: nome,
        assinatura_cliente_doc: doc,
        assinatura_cliente_email: email,
        assinatura_cliente_ip: ip,
        assinatura_cliente_data: agora,
        assinatura_cliente_imagem: imagem,
        conteudo_final_html: conteudoCongelado,
        hash_documento: hash,
        atualizado_em: agora,
      })
      .eq('id', contrato.id)
      .in('status', ['aguardando_assinatura', 'rascunho'])
      .select('id, status, titulo, assinatura_cliente_nome, assinatura_cliente_data')
      .maybeSingle();

    if (erroAssina) {
      console.error('Erro ao registrar assinatura do cliente:', erroAssina);
      return respostaErro('Não foi possível registrar a assinatura.', 500);
    }

    if (!atualizado) {
      return respostaErro(
        'Este contrato já recebeu uma assinatura ou mudou de status simultaneamente.',
        409
      );
    }

    // 5. Registra o evento na trilha de auditoria
    await registrarEventoContrato(
      contrato.id,
      contrato.agencia_id,
      'assinado_cliente',
      {
        signatario: nome,
        documento_mascarado: doc.length > 8 ? `${doc.slice(0, 3)}.***.***-${doc.slice(-2)}` : '***',
        email,
        ip,
        hash_documento: hash,
      },
      null,
      ip,
      userAgent
    );

    return NextResponse.json({
      ok: true,
      status: 'assinado_cliente',
      mensagem: 'Assinatura registrada com sucesso! A agência foi notificada para realizar a contra-assinatura final.',
      certificado: {
        signatario: nome,
        documento: doc,
        data_hora: agora,
        ip: ip,
        hash_documento: hash,
      },
    });
  } catch (err) {
    console.error('Erro ao assinar contrato:', err);
    return respostaErro('Falha no processo de assinatura.', 500);
  }
}
