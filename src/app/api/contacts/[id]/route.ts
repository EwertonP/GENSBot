import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

// PATCH: Atualiza as tags de segmentação de um contato (ex: "cliente", "quente").
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    if (!Array.isArray(body.tags) || !body.tags.every((t: unknown) => typeof t === 'string')) {
      return NextResponse.json({ error: 'tags deve ser uma lista de strings.' }, { status: 400 });
    }

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    if (!config?.instagram_user_id) {
      return NextResponse.json({ error: 'Nenhuma conta do Instagram conectada.' }, { status: 400 });
    }

    const tags = Array.from(new Set(body.tags.map((t: string) => t.trim()).filter(Boolean))).slice(0, 10);

    const { data, error } = await supabase
      .from('contacts')
      .update({ tags, updated_at: new Date().toISOString() })
      .eq('instagram_id', id)
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
