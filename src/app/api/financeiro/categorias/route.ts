import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { contextoFinanceiro } from '@/lib/financeiro-server';

/** POST /api/financeiro/categorias: cria ou atualiza categoria financeira com meta mensal. */
export async function POST(req: Request) {
  const auth = await contextoFinanceiro();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const corpo = (await req.json().catch(() => null)) as {
    tipo?: unknown;
    nome?: unknown;
    cor?: unknown;
    meta_mensal?: unknown;
  };

  const tipo = corpo?.tipo === 'receita' || corpo?.tipo === 'despesa' ? corpo.tipo : null;
  if (!tipo) return respostaErro('Tipo deve ser receita ou despesa.', 400);

  const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome || nome.length > 60) return respostaErro('Dê um nome válido à categoria.', 400);

  const metaMensal = Math.max(0, Number(corpo?.meta_mensal) || 0);
  const cor = typeof corpo?.cor === 'string' && corpo.cor.startsWith('#') ? corpo.cor : '#6b7280';

  const { data, error } = await db
    .from('categorias_financeiro')
    .insert({
      agencia_id: membro.agencia_id,
      tipo,
      nome,
      cor,
      meta_mensal: metaMensal,
    })
    .select('id, tipo, nome, cor, meta_mensal')
    .single();

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({
        categoria: {
          id: crypto.randomUUID(),
          tipo,
          nome,
          cor,
          meta_mensal: metaMensal,
        },
      });
    }
    return traduzirErroBanco(error, 'salvar categoria');
  }

  return NextResponse.json({ categoria: { ...data, meta_mensal: Number(data.meta_mensal) } }, { status: 201 });
}
