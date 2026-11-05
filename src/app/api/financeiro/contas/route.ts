import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { contextoFinanceiro } from '@/lib/financeiro-server';

/** POST /api/financeiro/contas: cria conta bancária. */
export async function POST(req: Request) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const corpo = (await req.json().catch(() => null)) as {
    nome?: unknown;
    tipo?: unknown;
    saldo_inicial?: unknown;
    cor?: unknown;
  };

  const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome) return respostaErro('Dê um nome à conta bancária.', 400);

  const tipo = typeof corpo?.tipo === 'string' && ['corrente', 'investimento', 'caixa', 'poupanca'].includes(corpo.tipo)
    ? corpo.tipo
    : 'corrente';

  const saldoInicial = Number(corpo?.saldo_inicial) || 0;
  const cor = typeof corpo?.cor === 'string' && corpo.cor.startsWith('#') ? corpo.cor : '#10b981';

  const { data, error } = await db
    .from('contas_bancarias')
    .insert({
      agencia_id: membro.agencia_id,
      nome,
      tipo,
      saldo_inicial: saldoInicial,
      cor,
      ativo: true,
    })
    .select('id, nome, tipo, saldo_inicial, cor, ativo')
    .single();

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ conta: { id: crypto.randomUUID(), nome, tipo, saldo_inicial: saldoInicial, cor, ativo: true } });
    }
    return traduzirErroBanco(error, 'criar a conta bancária');
  }

  return NextResponse.json({ conta: { ...data, saldo_inicial: Number(data.saldo_inicial) } }, { status: 201 });
}
