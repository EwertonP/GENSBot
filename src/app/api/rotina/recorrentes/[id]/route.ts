import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

async function regraAcessivel(id: string, agenciaId: string, membroId: string, papel: string) {
  const { data } = await serviceSupabase.from('tarefas_recorrentes').select('id, responsavel_id').eq('id', id).eq('agencia_id', agenciaId).maybeSingle();
  if (!data) return 'Rotina recorrente não encontrada.';
  if (papel !== 'master' && data.responsavel_id !== membroId) return 'Você só pode mexer nas suas rotinas recorrentes.';
  return null;
}

/** PATCH — pausar/retomar (ativo) ou trocar título/descrição/prioridade. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;
  const { id } = await params;

  const negado = await regraAcessivel(id, membro.agencia_id, membro.id, membro.papel);
  if (negado) return respostaErro(negado, 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }
  const updates: Record<string, unknown> = {};
  if (typeof body.ativo === 'boolean') updates.ativo = body.ativo;
  if (typeof body.titulo === 'string' && body.titulo.trim()) updates.titulo = body.titulo.trim().slice(0, 300);
  if ('descricao' in body) updates.descricao = String(body.descricao || '').trim() || null;
  if (['baixa', 'normal', 'alta', 'urgente'].includes(String(body.prioridade))) updates.prioridade = body.prioridade;
  if (Object.keys(updates).length === 0) return respostaErro('Nada para atualizar.', 400);
  updates.atualizado_em = new Date().toISOString();

  const atualizar = (db: typeof supabase) =>
    db.from('tarefas_recorrentes').update(updates).eq('id', id).eq('agencia_id', membro.agencia_id).select('*').single();
  let { data, error } = await atualizar(supabase);
  if (error) ({ data, error } = await atualizar(serviceSupabase));
  if (error) return traduzirErroBanco(error, 'PATCH /api/rotina/recorrentes/[id]');
  return NextResponse.json({ regra: data });
}

/** DELETE — apaga a regra. Tarefas já geradas ficam (perdem só o vínculo). */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;
  const { id } = await params;

  const negado = await regraAcessivel(id, membro.agencia_id, membro.id, membro.papel);
  if (negado) return respostaErro(negado, 404);

  const apagar = (db: typeof supabase) => db.from('tarefas_recorrentes').delete().eq('id', id).eq('agencia_id', membro.agencia_id);
  let { error } = await apagar(supabase);
  if (error) ({ error } = await apagar(serviceSupabase));
  if (error) return traduzirErroBanco(error, 'DELETE /api/rotina/recorrentes/[id]');
  return NextResponse.json({ ok: true });
}
