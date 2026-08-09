import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);
    if (!config?.instagram_user_id) return NextResponse.json([]);

    const { data, error } = await supabase
      .from('sequences')
      .select('*')
      .eq('user_id', user.id)
      .eq('instagram_user_id', config.instagram_user_id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Nome da sequência é obrigatório.' }, { status: 400 });
    }

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);
    if (!config?.instagram_user_id) {
      return NextResponse.json({ error: 'Você precisa conectar uma conta do Instagram primeiro.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('sequences')
      .insert({
        user_id: user.id,
        instagram_user_id: config.instagram_user_id,
        name: body.name,
        steps: body.steps || [],
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
