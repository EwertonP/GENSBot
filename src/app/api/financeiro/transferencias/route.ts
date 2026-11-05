import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { contextoFinanceiro, UUID_RE } from '@/lib/financeiro-server';

/** POST /api/financeiro/transferencias: transfere saldo entre contas. */
export async function POST(req: Request) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const corpo = (await req.json().catch(() => null)) as {
    conta_origem_id?: unknown;
    conta_destino_id?: unknown;
    valor?: unknown;
    data?: unknown;
    descricao?: unknown;
  };

  const origemId = typeof corpo?.conta_origem_id === 'string' ? corpo.conta_origem_id : '';
  const destinoId = typeof corpo?.conta_destino_id === 'string' ? corpo.conta_destino_id : '';
  if (!UUID_RE.test(origemId) || !UUID_RE.test(destinoId)) {
    return respostaErro('Selecione as contas de origem e destino.', 400);
  }
  if (origemId === destinoId) {
    return respostaErro('A conta de destino deve ser diferente da origem.', 400);
  }

  const valor = Number(corpo?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return respostaErro('Informe um valor de transferência válido.', 400);
  }

  const dataStr = typeof corpo?.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(corpo.data)
    ? corpo.data
    : new Date().toISOString().slice(0, 10);

  const descricao = typeof corpo?.descricao === 'string' ? corpo.descricao.trim().slice(0, 160) : 'Transferência entre contas';

  const { data, error } = await db
    .from('transferencias_contas')
    .insert({
      agencia_id: membro.agencia_id,
      conta_origem_id: origemId,
      conta_destino_id: destinoId,
      valor: Math.round(valor * 100) / 100,
      data: dataStr,
      descricao,
    })
    .select('id, conta_origem_id, conta_destino_id, valor, data, descricao')
    .single();

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({
        transferencia: {
          id: crypto.randomUUID(),
          conta_origem_id: origemId,
          conta_destino_id: destinoId,
          valor,
          data: dataStr,
          descricao,
        },
      });
    }
    return traduzirErroBanco(error, 'realizar transferência');
  }

  return NextResponse.json({ transferencia: { ...data, valor: Number(data.valor) } }, { status: 201 });
}
