import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, slug, titulo, descricao, publicado, tema_config, redirect_url, cliente_id, clientes(nome, cor, foto_url)')
      .eq('slug', slug)
      .maybeSingle();

    if (formError || !form) {
      return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 });
    }

    if (!form.publicado) {
      return NextResponse.json({ error: 'Este formulário ainda não está disponível publicamente.' }, { status: 403 });
    }

    const { data: fields, error: fieldsError } = await supabase
      .from('form_fields')
      .select('id, tipo, label, descricao, placeholder, obrigatorio, ordem, opcoes, logica_pulo, validacoes')
      .eq('form_id', form.id)
      .order('ordem', { ascending: true });

    if (fieldsError) throw fieldsError;

    return NextResponse.json({
      ...form,
      cliente_nome: (form as any).clientes?.nome || null,
      cliente_foto: (form as any).clientes?.foto_url || null,
      fields: fields || [],
    });
  } catch (error: any) {
    console.error('Erro na rota pública do formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
