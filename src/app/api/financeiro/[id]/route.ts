import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { contextoFinanceiro, UUID_RE, validarLancamento } from '@/lib/financeiro-server';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/financeiro/:id: edita campos (ex.: marcar como pago). */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_RE.test(id)) return respostaErro('Lançamento inválido.', 400);

  const corpo = await req.json().catch(() => null);
  const v = validarLancamento(corpo, true);
  if (!v.ok) return respostaErro(v.erro, 400);
  if (Object.keys(v.campos).length === 0) return respostaErro('Nada para atualizar.', 400);

  const { data, error } = await db
    .from('lancamentos')
    .update({ ...v.campos, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('agencia_id', auth.ctx.membro.agencia_id)
    .select('id, tipo, descricao, valor, vencimento, pago, pago_em, categoria, origem, competencia, cliente_id, conta_id, recorrente, recorrencia_periodo, observacoes')
    .maybeSingle();
  if (error) return traduzirErroBanco(error, 'atualizar o lançamento');
  if (!data) return respostaErro('Lançamento não encontrado.', 404);
  return NextResponse.json({ lancamento: { ...data, valor: Number(data.valor) } });
}

/** DELETE /api/financeiro/:id */
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_RE.test(id)) return respostaErro('Lançamento inválido.', 400);

  const { error, count } = await db
    .from('lancamentos')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('agencia_id', auth.ctx.membro.agencia_id);
  if (error) return traduzirErroBanco(error, 'excluir o lançamento');
  if (!count) return respostaErro('Lançamento não encontrado.', 404);
  return NextResponse.json({ ok: true });
}
