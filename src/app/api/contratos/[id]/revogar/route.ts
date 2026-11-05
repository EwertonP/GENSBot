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

    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .select('id, agencia_id, titulo, status')
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (erroContrato || !contrato) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    const { error: erroUpdate } = await db
      .from('contratos')
      .update({
        status: 'cancelado',
        revogado_em: agora,
        atualizado_em: agora,
      })
      .eq('id', contrato.id);

    if (erroUpdate) {
      console.error('Erro ao revogar contrato:', erroUpdate);
      return respostaErro('Não foi possível revogar o contrato.', 500);
    }

    await registrarEventoContrato(
      contrato.id,
      membro.agencia_id,
      'cancelado',
      {
        motivo: body.motivo || 'Link revogado / contrato cancelado pela agência',
      },
      membro.id,
      ip
    );

    return NextResponse.json({
      ok: true,
      mensagem: 'Contrato cancelado e link público revogado.',
    });
  } catch (err) {
    console.error('Erro na rota POST /api/contratos/[id]/revogar:', err);
    return respostaErro('Falha ao revogar contrato.', 500);
  }
}
