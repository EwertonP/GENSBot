import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { contextoFinanceiro, mesValido, UUID_RE } from '@/lib/financeiro-server';
import { vencimentoMensalidade } from '@/lib/financeiro';

/**
 * POST /api/financeiro/mensalidade { cliente_id, mes: "AAAA-MM", pago }
 * Marca a mensalidade do mês como recebida (ou desfaz). A primeira vez grava a
 * linha real, com o valor e o dia de vencimento do cadastro do cliente.
 */
export async function POST(req: Request) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const b = (await req.json().catch(() => null)) as { cliente_id?: unknown; mes?: unknown; pago?: unknown } | null;
  if (!b || typeof b.cliente_id !== 'string' || !UUID_RE.test(b.cliente_id) || !mesValido(b.mes) || typeof b.pago !== 'boolean') {
    return respostaErro('Informe cliente, mês e se foi pago.', 400);
  }

  const { data: cliente, error: errCliente } = await db
    .from('clientes')
    .select('id, nome, valor_mensal, dia_vencimento')
    .eq('id', b.cliente_id)
    .eq('agencia_id', membro.agencia_id)
    .maybeSingle();
  if (errCliente) return traduzirErroBanco(errCliente, 'ler o cliente');
  if (!cliente || !(Number(cliente.valor_mensal) > 0)) return respostaErro('Esse cliente não tem mensalidade cadastrada.', 400);

  const competencia = `${b.mes}-01`;
  const campos = {
    agencia_id: membro.agencia_id,
    tipo: 'receita',
    descricao: `Mensalidade: ${cliente.nome}`,
    valor: Number(cliente.valor_mensal),
    vencimento: vencimentoMensalidade(b.mes, cliente.dia_vencimento),
    categoria: 'mensalidade',
    origem: 'mensalidade',
    competencia,
    cliente_id: cliente.id,
    pago: b.pago,
    pago_em: b.pago ? new Date().toISOString().slice(0, 10) : null,
    atualizado_em: new Date().toISOString(),
  };

  const { data: existente } = await db
    .from('lancamentos')
    .select('id')
    .eq('agencia_id', membro.agencia_id)
    .eq('origem', 'mensalidade')
    .eq('cliente_id', cliente.id)
    .eq('competencia', competencia)
    .maybeSingle();

  const resultado = existente
    ? await db.from('lancamentos').update({ pago: campos.pago, pago_em: campos.pago_em, atualizado_em: campos.atualizado_em }).eq('id', existente.id).select().single()
    : await db.from('lancamentos').insert(campos).select().single();
  if (resultado.error) return traduzirErroBanco(resultado.error, 'registrar a mensalidade');

  return NextResponse.json({ lancamento: { ...resultado.data, valor: Number(resultado.data.valor) } });
}
