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

    const { id: formId } = await params;

    const { data: responses, error } = await supabase
      .from('form_responses')
      .select('*')
      .eq('form_id', formId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      responses: responses || [],
      total: responses?.length || 0,
    });
  } catch (error: any) {
    console.error('Erro ao buscar respostas do formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
