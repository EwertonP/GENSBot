import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { supabase as db } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const { data: cliente } = await db
      .from('clientes')
      .select('id, nome, agencia_id')
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (!cliente) {
      return respostaErro('Cliente não encontrado.', 404);
    }

    // Busca link ativo
    const { data: existingLink, error: linkErr } = await db
      .from('cliente_onboarding_links')
      .select('*')
      .eq('cliente_id', id)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkErr && linkErr.code !== '42P01') {
      throw linkErr;
    }

    let link = existingLink;

    if (!link && linkErr?.code !== '42P01') {
      const token = crypto.randomUUID();
      const { data: novoLink, error: createErr } = await db
        .from('cliente_onboarding_links')
        .insert({
          agencia_id: membro.agencia_id,
          cliente_id: id,
          token,
        })
        .select('*')
        .single();

      if (createErr) throw createErr;
      link = novoLink;
    }

    if (!link) {
      return respostaErro('Tabela de onboarding não migrada.', 503);
    }

    return NextResponse.json({
      link: `/conectar/${link.token}`,
      token: link.token,
      instagram_username_informado: link.instagram_username_informado,
      threads_username_informado: link.threads_username_informado,
      tiktok_username_informado: link.tiktok_username_informado,
      convite_instagram_enviado: !!link.convite_instagram_enviado,
      convite_threads_enviado: !!link.convite_threads_enviado,
      instagram_conectado_em: link.instagram_conectado_em,
      threads_conectado_em: link.threads_conectado_em,
      tiktok_conectado_em: link.tiktok_conectado_em,
      concluido_em: link.concluido_em,
      expira_em: link.expira_em,
    });
  } catch (err) {
    console.error('Erro na rota GET /api/clientes/[id]/onboarding-link:', err);
    return respostaErro('Falha ao obter link de onboarding.', 500);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const body = await req.json();
    const updateData: Record<string, any> = {
      atualizado_em: new Date().toISOString(),
    };

    if (typeof body.convite_instagram_enviado === 'boolean') {
      updateData.convite_instagram_enviado = body.convite_instagram_enviado;
    }
    if (typeof body.convite_threads_enviado === 'boolean') {
      updateData.convite_threads_enviado = body.convite_threads_enviado;
    }

    const { error: patchErr } = await db
      .from('cliente_onboarding_links')
      .update(updateData)
      .eq('cliente_id', id)
      .eq('agencia_id', membro.agencia_id);

    if (patchErr) {
      if (patchErr.code === '42P01') {
        return respostaErro('Tabela de onboarding não migrada.', 503);
      }
      throw patchErr;
    }

    return NextResponse.json({ sucesso: true });
  } catch (err) {
    console.error('Erro na rota PATCH /api/clientes/[id]/onboarding-link:', err);
    return respostaErro('Falha ao atualizar status de convites.', 500);
  }
}
