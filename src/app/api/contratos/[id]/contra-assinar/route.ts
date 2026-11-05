import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos, obterIpRequisicao } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';
import { registrarEventoContrato } from '@/lib/contrato-assinatura';

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
    const agora = new Date().toISOString();

    // 1. Busca contrato
    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .select('id, agencia_id, cliente_id, lead_id, titulo, status, valor_mensal, dia_vencimento, data_inicio, assinatura_cliente_nome, assinatura_cliente_doc')
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (erroContrato || !contrato) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    if (contrato.status === 'assinado') {
      return NextResponse.json({ ok: true, mensagem: 'Este contrato já foi contra-assinado e concluído.' });
    }

    if (contrato.status !== 'assinado_cliente') {
      return respostaErro(
        `O contrato precisa ser assinado primeiro pelo cliente antes da contra-assinatura da agência (status atual: ${contrato.status}).`,
        400
      );
    }

    const nomeAgencia = (body.nome_signatario || membro.nome || 'Representante Legal da Agência').trim();

    // 2. Atualiza o contrato para assinado definitivo
    const { data: contratoAtualizado, error: erroUpdate } = await db
      .from('contratos')
      .update({
        status: 'assinado',
        assinatura_agencia_nome: nomeAgencia,
        assinatura_agencia_data: agora,
        assinatura_agencia_membro_id: membro.id,
        assinatura_agencia_ip: ip,
        atualizado_em: agora,
      })
      .eq('id', contrato.id)
      .select()
      .single();

    if (erroUpdate) {
      console.error('Erro ao contra-assinar contrato:', erroUpdate);
      return respostaErro('Não foi possível gravar a contra-assinatura.', 500);
    }

    // 3. Registra evento de contra-assinatura
    await registrarEventoContrato(
      contrato.id,
      membro.agencia_id,
      'contra_assinado',
      {
        signatario_agencia: nomeAgencia,
        membro_id: membro.id,
        ip,
      },
      membro.id,
      ip
    );

    // 4. Integração CRM: Negócio vira "ganho"
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

    // 5. Integração com Financeiro e Ficha do Cliente:
    if (contrato.valor_mensal && Number(contrato.valor_mensal) > 0) {
      const valor = Number(contrato.valor_mensal);
      const diaVenc = Number(contrato.dia_vencimento) || 10;

      // 5.1 Atualiza cliente
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

      // 5.2 Lança receita no Financeiro para o próximo ciclo
      try {
        const dataHoje = new Date();
        let ano = dataHoje.getFullYear();
        let mes = dataHoje.getMonth() + 1;

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
            observacoes: `Contrato assinado por ambas as partes (Cliente: ${contrato.assinatura_cliente_nome || 'N/A'}, Agência: ${nomeAgencia}).`,
          });
      } catch (e) {
        console.warn('Aviso: Falha ao inserir lançamento financeiro:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      mensagem: 'Contrato contra-assinado com sucesso! As integrações com CRM e Financeiro foram ativadas.',
      contrato: contratoAtualizado,
    });
  } catch (err) {
    console.error('Erro na rota POST /api/contratos/[id]/contra-assinar:', err);
    return respostaErro('Falha ao processar contra-assinatura.', 500);
  }
}
