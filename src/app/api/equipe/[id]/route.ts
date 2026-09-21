import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;

  // Apenas master pode alterar outros membros
  if (membro.papel !== 'master' && membro.id !== id) {
    return respostaErro('Permissão negada.', 403);
  }

  try {
    const body = await req.json();
    const permitidos = ['nome', 'cargo', 'papel', 'ativo', 'foto_url'];
    const updates: Record<string, any> = {};

    for (const key of permitidos) {
      if (key in body) {
        // Se não for master, não pode alterar papel ou status ativo
        if ((key === 'papel' || key === 'ativo') && membro.papel !== 'master') {
          continue;
        }
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return respostaErro('Nenhum campo válido para atualização.', 400);
    }

    const { data: membroAtualizado, error } = await serviceSupabase
      .from('membros')
      .update(updates)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .select('*')
      .single();

    if (error) {
      return traduzirErroBanco(error, 'PATCH /api/equipe/[id]');
    }

    return NextResponse.json({ membro: membroAtualizado });
  } catch {
    return respostaErro('Erro ao processar atualização.', 400);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;
  const url = new URL(req.url);
  const isHardDelete = url.searchParams.get('hard') === 'true';

  if (membro.papel !== 'master') {
    return respostaErro('Apenas administradores podem desativar ou remover membros.', 403);
  }

  if (membro.id === id) {
    return respostaErro('Você não pode remover a si mesmo.', 400);
  }

  if (isHardDelete) {
    // Exclusão completa: remove da tabela de membros e do auth
    const { error } = await serviceSupabase
      .from('membros')
      .delete()
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (error) {
      return traduzirErroBanco(error, 'DELETE /api/equipe/[id]');
    }

    // Tenta apagar do Supabase Auth em segundo plano
    serviceSupabase.auth.admin.deleteUser(id).catch(() => {});

    return NextResponse.json({ ok: true, message: 'Membro excluído permanentemente com sucesso.' });
  }

  // Desativa o membro para preservar integridade de dados históricos
  const { error } = await serviceSupabase
    .from('membros')
    .update({ ativo: false })
    .eq('id', id)
    .eq('agencia_id', membro.agencia_id);

  if (error) {
    return traduzirErroBanco(error, 'DELETE /api/equipe/[id]');
  }

  return NextResponse.json({ ok: true, message: 'Membro desativado com sucesso.' });
}
