import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;

    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*, clientes(nome, cor)')
      .eq('id', id)
      .maybeSingle();

    if (formError || !form) {
      return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 });
    }

    const { data: fields, error: fieldsError } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', id)
      .order('ordem', { ascending: true });

    if (fieldsError) throw fieldsError;

    return NextResponse.json({
      ...form,
      cliente_nome: form.clientes?.nome || null,
      fields: fields || [],
    });
  } catch (error: any) {
    console.error('Erro ao buscar formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.titulo !== undefined) updatePayload.titulo = body.titulo;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.descricao !== undefined) updatePayload.descricao = body.descricao;
    if (body.publicado !== undefined) updatePayload.publicado = body.publicado;
    if (body.cliente_id !== undefined) updatePayload.cliente_id = body.cliente_id;
    if (body.tema_config !== undefined) updatePayload.tema_config = body.tema_config;
    if (body.notificacao_whatsapp_numero !== undefined) {
      updatePayload.notificacao_whatsapp_numero = body.notificacao_whatsapp_numero;
    }
    if (body.notificacao_email !== undefined) updatePayload.notificacao_email = body.notificacao_email;
    if (body.redirect_url !== undefined) updatePayload.redirect_url = body.redirect_url;
    if (body.tags_padrao !== undefined) updatePayload.tags_padrao = body.tags_padrao;

    const { data: updated, error } = await supabase
      .from('forms')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;

    const { error } = await supabase.from('forms').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
