import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, validarAcessoItemConteudo } from '@/lib/clientes-server';

/** Sugestões de texto pendentes da cliente numa demanda (lado da agência). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const negado = await validarAcessoItemConteudo(auth.ctx, id);
  if (negado) return negado;

  const { data, error } = await db
    .from('conteudo_sugestoes_texto')
    .select('id, campo, texto_original, texto_proposto, autor, criado_em')
    .eq('item_id', id)
    .eq('agencia_id', auth.ctx.membro.agencia_id)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true });

  if (error) return respostaErro('Não foi possível carregar as sugestões.', 500);
  return NextResponse.json({ sugestoes: data || [] });
}
