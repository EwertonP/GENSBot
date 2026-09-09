import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;

    const { data: existing } = await supabase
      .from('scheduled_posts')
      .select('id, user_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Publicação não encontrada.' }, { status: 404 });
    }
    if (existing.status !== 'scheduled') {
      return NextResponse.json({ error: 'Só é possível cancelar publicações ainda agendadas.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update({ status: 'canceled' })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
