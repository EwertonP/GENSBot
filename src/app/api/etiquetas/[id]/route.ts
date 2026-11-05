import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

/** DELETE /api/etiquetas/:id: apaga a etiqueta e tira o id das demandas que a usam. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return respostaErro('Etiqueta inválida.', 400);
  const agenciaId = auth.ctx.membro.agencia_id;

  const { data: usadas } = await db.from('conteudo_items').select('id, etiquetas_ids').eq('agencia_id', agenciaId).contains('etiquetas_ids', [id]);
  for (const it of usadas ?? []) {
    await db.from('conteudo_items').update({ etiquetas_ids: (it.etiquetas_ids ?? []).filter((x: string) => x !== id) }).eq('id', it.id);
  }
  const { error, count } = await db.from('etiquetas').delete({ count: 'exact' }).eq('id', id).eq('agencia_id', agenciaId);
  if (error) return traduzirErroBanco(error, 'apagar a etiqueta');
  if (!count) return respostaErro('Etiqueta não encontrada.', 404);
  return NextResponse.json({ ok: true });
}
