import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id: formId } = await params;
    const body = await req.json();
    const { fields } = body || {};

    if (!Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields deve ser um array.' }, { status: 400 });
    }

    // Deleta os campos anteriores e insere a nova lista em ordem
    const { error: deleteError } = await supabase
      .from('form_fields')
      .delete()
      .eq('form_id', formId);

    if (deleteError) throw deleteError;

    if (fields.length === 0) {
      return NextResponse.json({ success: true, fields: [] });
    }

    const fieldsToInsert = fields.map((f: any, index: number) => ({
      id: f.id && f.id.length === 36 ? f.id : crypto.randomUUID(),
      form_id: formId,
      tipo: f.tipo || 'text',
      label: f.label || 'Pergunta sem título',
      descricao: f.descricao || null,
      placeholder: f.placeholder || null,
      obrigatorio: f.obrigatorio !== false,
      ordem: index,
      opcoes: f.opcoes || [],
      logica_pulo: f.logica_pulo || [],
      validacoes: f.validacoes || {},
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('form_fields')
      .insert(fieldsToInsert)
      .select()
      .order('ordem', { ascending: true });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, fields: inserted });
  } catch (error: any) {
    console.error('Erro ao atualizar campos do formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
