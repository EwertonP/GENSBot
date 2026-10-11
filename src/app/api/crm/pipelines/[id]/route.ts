import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

// PATCH: Atualiza dados do funil e suas etapas
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;
  try {
    const body = await req.json();
    const { nome, descricao, ativo, estagios } = body;

    const updates: Record<string, any> = { atualizado_em: new Date().toISOString() };
    if (nome !== undefined) updates.nome = nome.trim();
    if (descricao !== undefined) updates.descricao = descricao ? descricao.trim() : null;
    if (ativo !== undefined) updates.ativo = Boolean(ativo);

    const { data: pipe, error: pipeErr } = await serviceSupabase
      .from('crm_pipelines')
      .update(updates)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .select()
      .maybeSingle();

    if (pipeErr) return traduzirErroBanco(pipeErr, 'PATCH /api/crm/pipelines/[id]');
    if (!pipe) return respostaErro('Funil não encontrado.', 404);

    // Se veio array de estágios, atualiza/insere
    if (Array.isArray(estagios)) {
      for (const [idx, est] of estagios.entries()) {
        if (est.id) {
          await serviceSupabase
            .from('crm_estagios')
            .update({
              nome: est.nome,
              cor: est.cor,
              ordem: idx,
              tipo_conclusao: est.tipo_conclusao || 'aberto',
              dias_limite_estagnado: est.dias_limite_estagnado,
            })
            .eq('id', est.id)
            .eq('pipeline_id', id);
        } else {
          await serviceSupabase.from('crm_estagios').insert({
            pipeline_id: id,
            nome: est.nome,
            cor: est.cor || '#3b82f6',
            ordem: idx,
            tipo_conclusao: est.tipo_conclusao || 'aberto',
            dias_limite_estagnado: est.dias_limite_estagnado ?? 3,
          });
        }
      }
    }

    const { data: estagiosFinais } = await serviceSupabase
      .from('crm_estagios')
      .select('*')
      .eq('pipeline_id', id)
      .order('ordem', { ascending: true });

    return NextResponse.json({ ...pipe, estagios: estagiosFinais || [] });
  } catch (err: any) {
    console.error('Erro ao atualizar pipeline:', err);
    return respostaErro('Falha interna ao atualizar pipeline.', 500);
  }
}

// DELETE: Arquiva ou exclui o pipeline
export async function DELETE(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;
  try {
    const { error } = await serviceSupabase
      .from('crm_pipelines')
      .delete()
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (error) return traduzirErroBanco(error, 'DELETE /api/crm/pipelines/[id]');
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error('Erro ao excluir pipeline:', err);
    return respostaErro('Falha interna ao excluir pipeline.', 500);
  }
}
