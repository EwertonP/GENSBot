import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

const SELECT_NEGOCIO = `
  *,
  responsavel:membros!responsavel_id(id, nome, email, cargo),
  estagio:crm_estagios!estagio_id(id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado),
  cliente:clientes!cliente_id(id, nome, cor)
`;

// GET: Retorna ficha completa do negócio com timeline e tarefas
export async function GET(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;
  try {
    let query = serviceSupabase
      .from('crm_negocios')
      .select(SELECT_NEGOCIO)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (membro.papel === 'cliente') {
      if (!membro.cliente_id) {
        return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
      }
      query = query.eq('cliente_id', membro.cliente_id);
    }

    const { data: negocio, error } = await query.maybeSingle();

    if (error) return traduzirErroBanco(error, 'GET /api/crm/negocios/[id]');
    if (!negocio) return respostaErro('Negócio não encontrado.', 404);

    // Busca timeline de atividades e tarefas em paralelo
    const [{ data: atividades }, { data: tarefas }] = await Promise.all([
      serviceSupabase
        .from('crm_atividades')
        .select('*, membro:membros!membro_id(id, nome)')
        .eq('negocio_id', id)
        .order('criado_em', { ascending: false }),
      serviceSupabase
        .from('crm_tarefas')
        .select('*, responsavel:membros!responsavel_id(id, nome)')
        .eq('negocio_id', id)
        .order('prazo', { ascending: true }),
    ]);

    return NextResponse.json({
      ...negocio,
      atividades: atividades || [],
      tarefas: tarefas || [],
    });
  } catch (err: any) {
    console.error('Erro ao buscar negócio:', err);
    return respostaErro('Falha interna ao carregar negócio.', 500);
  }
}

// PATCH: Edição dos dados do negócio
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro, user } = auth.ctx;

  const { id } = await params;
  try {
    const body = await req.json();
    const {
      titulo,
      valor,
      nome_contato,
      telefone,
      email,
      instagram_username,
      empresa,
      cargo,
      prioridade,
      responsavel_id,
      previsao_fechamento,
      probabilidade,
      tags,
      motivo_perda,
      status,
    } = body;

    const updates: Record<string, any> = { atualizado_em: new Date().toISOString() };
    if (titulo !== undefined) updates.titulo = titulo.trim();
    if (valor !== undefined) updates.valor = Number(valor) || 0;
    if (nome_contato !== undefined) updates.nome_contato = nome_contato.trim();
    if (telefone !== undefined) updates.telefone = telefone ? telefone.trim() : null;
    if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;
    if (instagram_username !== undefined) {
      updates.instagram_username = instagram_username ? instagram_username.replace(/^@/, '').trim() : null;
    }
    if (empresa !== undefined) updates.empresa = empresa ? empresa.trim() : null;
    if (cargo !== undefined) updates.cargo = cargo ? cargo.trim() : null;
    if (prioridade !== undefined) updates.prioridade = prioridade;
    if (responsavel_id !== undefined) updates.responsavel_id = responsavel_id || null;
    if (previsao_fechamento !== undefined) updates.previsao_fechamento = previsao_fechamento || null;
    if (probabilidade !== undefined) updates.probabilidade = probabilidade !== null ? Number(probabilidade) : null;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];
    if (motivo_perda !== undefined) updates.motivo_perda = motivo_perda || null;
    if (status !== undefined) updates.status = status;

    let updateQuery = serviceSupabase
      .from('crm_negocios')
      .update(updates)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (membro.papel === 'cliente') {
      if (!membro.cliente_id) {
        return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
      }
      updateQuery = updateQuery.eq('cliente_id', membro.cliente_id);
    }

    const { data: atualizado, error } = await updateQuery
      .select(SELECT_NEGOCIO)
      .maybeSingle();

    if (error) return traduzirErroBanco(error, 'PATCH /api/crm/negocios/[id]');
    if (!atualizado) return respostaErro('Negócio não encontrado.', 404);

    return NextResponse.json(atualizado);
  } catch (err: any) {
    console.error('Erro ao atualizar negócio:', err);
    return respostaErro('Falha interna ao atualizar negócio.', 500);
  }
}

// DELETE: Exclusão permanente do negócio
export async function DELETE(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;
  try {
    let deleteQuery = serviceSupabase
      .from('crm_negocios')
      .delete()
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (membro.papel === 'cliente') {
      if (!membro.cliente_id) {
        return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
      }
      deleteQuery = deleteQuery.eq('cliente_id', membro.cliente_id);
    }

    const { error } = await deleteQuery;

    if (error) return traduzirErroBanco(error, 'DELETE /api/crm/negocios/[id]');
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error('Erro ao excluir negócio:', err);
    return respostaErro('Falha interna ao excluir negócio.', 500);
  }
}
