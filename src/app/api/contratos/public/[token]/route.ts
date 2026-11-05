import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';
import { obterIpRequisicao } from '@/lib/documentos-server';
import { registrarEventoContrato } from '@/lib/contrato-assinatura';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const { data: contrato, error } = await db
      .from('contratos')
      .select(`
        id, agencia_id, titulo, status, valor_mensal, dia_vencimento, data_inicio, data_termino,
        renovacao_automatica, conteudo_html, conteudo_final_html, hash_documento,
        enviado_em, visualizado_em, expira_em, revogado_em,
        token_publico, itens,
        assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
        assinatura_cliente_ip, assinatura_cliente_data, assinatura_cliente_imagem,
        assinatura_agencia_nome, assinatura_agencia_data, criado_em,
        agencia:agencias(id, nome, razao_social, cnpj_cpf, endereco, cidade_estado, email_contato, telefone_contato, chave_pix),
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal),
        lead:crm_negocios(id, titulo, nome_contato, empresa)
      `)
      .eq('token_publico', token)
      .maybeSingle();

    if (error || !contrato) {
      return respostaErro('Contrato não encontrado ou link expirado.', 404);
    }

    // Se foi revogado ou cancelado
    if (contrato.revogado_em || contrato.status === 'cancelado') {
      return NextResponse.json(
        {
          error: 'Este contrato foi cancelado ou teve seu link de assinatura revogado pela agência.',
          contrato: {
            ...contrato,
            status: 'cancelado',
          },
        },
        { status: 410 }
      );
    }

    // Marca como visualizado se for a primeira abertura
    if (!contrato.visualizado_em) {
      const agora = new Date().toISOString();
      const ip = obterIpRequisicao(req);
      const userAgent = req.headers.get('user-agent') || null;

      await db
        .from('contratos')
        .update({ visualizado_em: agora })
        .eq('id', contrato.id);

      await registrarEventoContrato(
        contrato.id,
        contrato.agencia_id,
        'visualizado',
        { ip },
        null,
        ip,
        userAgent
      );

      contrato.visualizado_em = agora;
    }

    // Garante que o cliente veja o texto congelado se já foi enviado/congelado
    const conteudoExibicao = contrato.conteudo_final_html || contrato.conteudo_html;

    return NextResponse.json({
      contrato: {
        ...contrato,
        conteudo_html: conteudoExibicao,
      },
    });
  } catch (err) {
    console.error('Erro ao buscar contrato público:', err);
    return respostaErro('Erro ao processar contrato.', 500);
  }
}
