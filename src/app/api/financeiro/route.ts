import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { contextoFinanceiro, mesValido, validarLancamento } from '@/lib/financeiro-server';
import { mesAtual, somarMeses } from '@/lib/financeiro';

/**
 * GET /api/financeiro?de=AAAA-MM&ate=AAAA-MM
 * Lançamentos reais da janela (por vencimento) + os clientes que cobram
 * mensalidade. As mensalidades "ainda não recebidas" são calculadas no cliente.
 */
export async function GET(req: Request) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const hoje = mesAtual();
  const de = searchParams.get('de') ?? somarMeses(hoje, -3);
  const ate = searchParams.get('ate') ?? somarMeses(hoje, 3);
  if (!mesValido(de) || !mesValido(ate) || de > ate) return respostaErro('Período inválido.', 400);

  const fim = `${somarMeses(ate, 1)}-01`;
  const [lancs, clientes, contasRes, catsRes, transRes] = await Promise.all([
    db
      .from('lancamentos')
      .select('id, tipo, descricao, valor, vencimento, pago, pago_em, categoria, origem, competencia, cliente_id, conta_id, recorrente, recorrencia_periodo, observacoes')
      .eq('agencia_id', membro.agencia_id)
      .gte('vencimento', `${de}-01`)
      .lt('vencimento', fim)
      .order('vencimento', { ascending: true }),
    db
      .from('clientes')
      .select('id, nome, valor_mensal, dia_vencimento, ativo, criado_em')
      .eq('agencia_id', membro.agencia_id)
      .gt('valor_mensal', 0),
    db
      .from('contas_bancarias')
      .select('id, nome, tipo, saldo_inicial, cor, ativo')
      .eq('agencia_id', membro.agencia_id)
      .eq('ativo', true),
    db
      .from('categorias_financeiro')
      .select('id, tipo, nome, cor, meta_mensal')
      .eq('agencia_id', membro.agencia_id),
    db
      .from('transferencias_contas')
      .select('id, conta_origem_id, conta_destino_id, valor, data, descricao')
      .eq('agencia_id', membro.agencia_id),
  ]);
  if (lancs.error) return traduzirErroBanco(lancs.error, 'ler os lançamentos');
  if (clientes.error) return traduzirErroBanco(clientes.error, 'ler os clientes');

  const contas = contasRes.error && contasRes.error.code === '42P01' ? [] : (contasRes.data ?? []);
  const categorias = catsRes.error && catsRes.error.code === '42P01' ? [] : (catsRes.data ?? []);
  const transferencias = transRes.error && transRes.error.code === '42P01' ? [] : (transRes.data ?? []);

  return NextResponse.json({
    lancamentos: (lancs.data ?? []).map((l) => ({ ...l, valor: Number(l.valor) })),
    clientes: (clientes.data ?? []).map(({ criado_em, ...c }) => ({ ...c, valor_mensal: Number(c.valor_mensal), desde: criado_em })),
    contas: contas.map((c) => ({ ...c, saldo_inicial: Number(c.saldo_inicial) })),
    categorias: categorias.map((cat) => ({ ...cat, meta_mensal: Number(cat.meta_mensal) })),
    transferencias: transferencias.map((t) => ({ ...t, valor: Number(t.valor) })),
  });
}

/** POST /api/financeiro: cria uma receita ou despesa avulsa. */
export async function POST(req: Request) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const corpo = await req.json().catch(() => null);
  const v = validarLancamento(corpo, false);
  if (!v.ok) return respostaErro(v.erro, 400);

  const { data, error } = await db
    .from('lancamentos')
    .insert({ ...v.campos, agencia_id: membro.agencia_id, origem: 'manual' })
    .select('id, tipo, descricao, valor, vencimento, pago, pago_em, categoria, origem, competencia, cliente_id, conta_id, recorrente, recorrencia_periodo, observacoes')
    .single();
  if (error) return traduzirErroBanco(error, 'criar o lançamento');
  return NextResponse.json({ lancamento: { ...data, valor: Number(data.valor) } }, { status: 201 });
}
