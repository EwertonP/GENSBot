import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;

  try {
    const body = await req.json();
    const permitidos = ['titulo', 'descricao', 'status', 'prioridade', 'prazo', 'responsavel_id', 'cliente_id'];
    const updates: Record<string, any> = {};

    for (const key of permitidos) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (updates.status === 'concluido') {
      updates.concluido_em = new Date().toISOString();
    } else if (updates.status === 'pendente') {
      updates.concluido_em = null;
    }

    const { data, error } = await supabase
      .from('tarefas')
      .update(updates)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .select(`
        *,
        cliente:clientes(id, nome, cor, foto_url),
        responsavel:membros!responsavel_id(id, nome, email, cargo)
      `)
      .single();

    if (error) {
      return traduzirErroBanco(error, 'PATCH /api/rotina/[id]');
    }

    return NextResponse.json({ tarefa: data });
  } catch {
    return respostaErro('Erro ao processar atualização.', 400);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;

  const { error } = await supabase
    .from('tarefas')
    .delete()
    .eq('id', id)
    .eq('agencia_id', membro.agencia_id);

  if (error) {
    return traduzirErroBanco(error, 'DELETE /api/rotina/[id]');
  }

  return NextResponse.json({ ok: true });
}
