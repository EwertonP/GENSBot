import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);
    if (!config?.instagram_user_id) {
      return NextResponse.json({ error: 'Nenhuma conta do Instagram conectada.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('sequences')
      .update({
        name: body.name,
        steps: body.steps || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('instagram_user_id', config.instagram_user_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);
    if (!config?.instagram_user_id) {
      return NextResponse.json({ error: 'Nenhuma conta do Instagram conectada.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('sequences')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('instagram_user_id', config.instagram_user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
