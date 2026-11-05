import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

/** DELETE /api/legendas-padrao/:id: exclui o modelo de legenda. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return respostaErro('ID inválido.', 400);

  const { error, count } = await db
    .from('legendas_padrao')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('agencia_id', auth.ctx.membro.agencia_id);

  if (error) return traduzirErroBanco(error, 'excluir modelo de legenda');
  if (!count) return respostaErro('Modelo não encontrado.', 404);

  return NextResponse.json({ ok: true });
}
