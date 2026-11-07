import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { ehUuid } from '@/lib/clientes';
import { supabase } from '@/lib/supabase';
import { membroDaAgencia } from '@/lib/responsavel-entrega-server';

/** Atribui o responsável de uma entrega arquivada (a demanda já foi excluída). Só gestores. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  if (membro.papel !== 'master') return respostaErro('Apenas administradores e sócios podem atribuir entregas.', 403);

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Entrega inválida.', 400);

  const body = await req.json().catch(() => ({}));
  const responsavel = await membroDaAgencia(body?.responsavel_id, membro.agencia_id);
  if (!responsavel) return respostaErro('Escolha uma pessoa da equipe.', 400);

  const { data, error } = await supabase
    .from('entregas_arquivadas')
    .update({ responsavel_id: responsavel })
    .eq('id', id)
    .eq('agencia_id', membro.agencia_id)
    .select('id')
    .maybeSingle();
  if (error) return respostaErro('Não foi possível atribuir.', 500);
  if (!data) return respostaErro('Entrega não encontrada.', 404);
  return NextResponse.json({ ok: true });
}
