import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';
import { obterIpRequisicao } from '@/lib/documentos-server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const body = await req.json();
    const nome = body.nome?.trim();
    const doc = body.doc?.trim();
    const email = body.email?.trim() || null;
    const imagem = body.imagem || null;

    if (!nome) return respostaErro('Nome completo do signatário é obrigatório.', 400);
    if (!doc) return respostaErro('CPF ou CNPJ do signatário é obrigatório.', 400);

    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .select('id, agencia_id, cliente_id, lead_id, titulo, status, valor_mensal, dia_vencimento, data_inicio')
      .eq('token_publico', token)
      .maybeSingle();

    if (erroContrato || !contrato) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    if (contrato.status === 'assinado') {
      return NextResponse.json({ ok: true, mensagem: 'Este contrato já foi assinado digitalmente.' });
    }

    const ip = obterIpRequisicao(req);
    const agora = new Date().toISOString();

    // 1. Atualiza o contrato como assinado
    const { error: erroAssina } = await db
      .from('contratos')
      .update({
        status: 'assinado',
        assinatura_cliente_nome: nome,
        assinatura_cliente_doc: doc,
        assinatura_cliente_email: email,
        assinatura_cliente_ip: ip,
        assinatura_cliente_data: agora,
        assinatura_cliente_imagem: imagem,
        atualizado_em: agora,
      })
      .eq('id', contrato.id);

    if (erroAssina) {
      console.error('Erro ao registrar assinatura:', erroAssina);
      return respostaErro('Não foi possível gravar a assinatura.', 500);
    }

    // 2. Integração com CRM: se o contrato tem um lead_id associado, marca como ganho
    if (contrato.lead_id) {
      try {
        await db
          .from('crm_negocios')
          .update({
            status: 'ganho',
            data_conclusao: agora,
            atualizado_em: agora,
          })
          .eq('id', contrato.lead_id);
      } catch (e) {
        console.warn('Aviso: Não foi possível atualizar o negócio no CRM:', e);
      }
    }

    // 3. Integração com Financeiro e Clientes:
    if (contrato.valor_mensal && Number(contrato.valor_mensal) > 0) {
      const valor = Number(contrato.valor_mensal);
      const diaVenc = Number(contrato.dia_vencimento) || 10;

      // 3.1 Atualiza ficha do cliente se houver cliente_id
      if (contrato.cliente_id) {
        try {
          await db
            .from('clientes')
            .update({
              valor_mensal: valor,
              dia_vencimento: diaVenc,
              contrato_inicio: contrato.data_inicio || agora.slice(0, 10),
              atualizado_em: agora,
            })
            .eq('id', contrato.cliente_id);
        } catch (e) {
          console.warn('Aviso: Não foi possível atualizar cliente:', e);
        }
      }

      // 3.2 Lança a receita no Financeiro para o próximo vencimento
      try {
        const dataHoje = new Date();
        let ano = dataHoje.getFullYear();
        let mes = dataHoje.getMonth() + 1; // 1 a 12

        // Se o dia do vencimento deste mês já passou, lança para o próximo mês
        if (dataHoje.getDate() > diaVenc) {
          mes += 1;
          if (mes > 12) {
            mes = 1;
            ano += 1;
          }
        }

        const mesFormatado = String(mes).padStart(2, '0');
        const diaFormatado = String(diaVenc).padStart(2, '0');
        const dataVencimento = `${ano}-${mesFormatado}-${diaFormatado}`;
        const competencia = `${ano}-${mesFormatado}`;

        await db
          .from('lancamentos')
          .insert({
            agencia_id: contrato.agencia_id,
            cliente_id: contrato.cliente_id || null,
            tipo: 'receita',
            descricao: `Mensalidade - ${contrato.titulo}`,
            valor: valor,
            vencimento: dataVencimento,
            categoria: 'Mensalidade',
            origem: 'contrato',
            competencia: competencia,
            recorrente: true,
            recorrencia_periodo: 'mensal',
            observacoes: `Gerado automaticamente via assinatura eletrônica do contrato (Signatário: ${nome}, CPF/CNPJ: ${doc}, IP: ${ip}).`,
          });
      } catch (e) {
        console.warn('Aviso: Falha ao inserir lançamento financeiro:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      mensagem: 'Contrato assinado com sucesso e validade jurídica certificada!',
      certificado: {
        signatario: nome,
        documento: doc,
        data_hora: agora,
        ip: ip,
      },
    });
  } catch (err) {
    console.error('Erro ao assinar contrato:', err);
    return respostaErro('Falha no processo de assinatura.', 500);
  }
}
