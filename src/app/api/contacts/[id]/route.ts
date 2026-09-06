import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

// PATCH: Atualiza campos editáveis de um contato — tags de segmentação (ex: "cliente",
// "quente") e/ou os dados do lead (nome, e-mail, telefone, observações livres). Todos os
// campos são opcionais no corpo da requisição; só os presentes são atualizados.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};

    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || !body.tags.every((t: unknown) => typeof t === 'string')) {
        return NextResponse.json({ error: 'tags deve ser uma lista de strings.' }, { status: 400 });
      }
      update.tags = Array.from(new Set(body.tags.map((t: string) => t.trim()).filter(Boolean))).slice(0, 10);
    }

    for (const field of ['name', 'email', 'phone', 'notes'] as const) {
      if (body[field] === undefined) continue;
      if (body[field] !== null && typeof body[field] !== 'string') {
        return NextResponse.json({ error: `${field} deve ser uma string ou null.` }, { status: 400 });
      }
      update[field] = typeof body[field] === 'string' ? body[field].trim() || null : null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar foi enviado.' }, { status: 400 });
    }

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    if (!config?.instagram_user_id) {
      return NextResponse.json({ error: 'Nenhuma conta do Instagram conectada.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .update({ ...update, updated_at: new Date().toISOString() })
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

// DELETE: Remove um contato da audiência (ex: contato irrelevante que o usuário não quer na lista/exportação).
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
      .from('contacts')
      .delete()
      .eq('instagram_id', id)
      .eq('user_id', user.id)
      .eq('instagram_user_id', config.instagram_user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
