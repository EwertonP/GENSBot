import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { buildUtmUrl } from '@/lib/utm';

// PATCH: Atualiza um link UTM já criado. O short_code não muda — o link curto
// que já foi compartilhado continua funcionando, só o destino/parâmetros mudam.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    const { data: existing, error: fetchError } = await supabase
      .from('utm_links')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 });

    const merged = {
      base_url: body.base_url !== undefined ? body.base_url : existing.base_url,
      utm_source: body.utm_source !== undefined ? body.utm_source : existing.utm_source,
      utm_medium: body.utm_medium !== undefined ? body.utm_medium : existing.utm_medium,
      utm_campaign: body.utm_campaign !== undefined ? body.utm_campaign : existing.utm_campaign,
      utm_term: body.utm_term !== undefined ? body.utm_term : existing.utm_term,
      utm_content: body.utm_content !== undefined ? body.utm_content : existing.utm_content,
    };

    let generatedUrl: string;
    try {
      generatedUrl = buildUtmUrl(merged.base_url, merged);
    } catch {
      return NextResponse.json({ error: 'URL de destino inválida.' }, { status: 400 });
    }

    const update: Record<string, unknown> = { ...merged, generated_url: generatedUrl };
    if (body.name !== undefined) update.name = body.name || null;
    if (body.automation_id !== undefined) update.automation_id = body.automation_id || null;

    const { data, error } = await supabase
      .from('utm_links')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const origin = new URL(req.url).origin;
    return NextResponse.json({ ...data, short_url: data.short_code ? `${origin}/r/${data.short_code}` : null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;

    const { error } = await supabase.from('utm_links').delete().eq('id', id).eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
