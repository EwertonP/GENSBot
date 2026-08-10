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

    // Se o body trouxer flow_definition, é um save vindo do editor visual (Fase 3) —
    // antes de sobrescrever, guarda um snapshot do flow_definition ANTERIOR em
    // automation_versions (Fase 5 — histórico de versões). Snapshot do estado
    // anterior, não do novo: o atual já fica em `automations`, então versionar
    // o anterior evita duplicar o mesmo estado em duas tabelas.
    let flowVersionUpdate: { flow_definition: unknown; flow_version: number } | null = null;
    if (body.flow_definition) {
      const { data: current } = await supabase.from('automations').select('flow_definition, flow_version').eq('id', id).single();
      const previousVersion = current?.flow_version || 0;

      if (current?.flow_definition) {
        await supabase.from('automation_versions').insert({
          automation_id: id,
          user_id: user.id,
          version_number: previousVersion,
          flow_definition: current.flow_definition,
        });
      }

      flowVersionUpdate = {
        flow_definition: body.flow_definition,
        flow_version: previousVersion + 1,
      };
    }

    const { data, error } = await supabase
      .from('automations')
      .update({
        name: body.name,
        active: body.active,
        triggers: body.triggers,
        keywords: body.keywords,
        match_type: body.match_type,
        specific_post_id: body.specific_post_id || null,
        specific_story_id: body.specific_story_id || null,
        public_replies: body.public_replies,
        welcome_dm: body.welcome_dm,
        quick_reply_button: body.quick_reply_button || null,
        link_text: body.link_text || null,
        link_button_label: body.link_button_label || null,
        link_url: body.link_url || null,
        reminder_text: body.reminder_text || null,
        reminder_delay_minutes: body.reminder_delay_minutes || null,
        updated_at: new Date().toISOString(),
        ...flowVersionUpdate,
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
      .from('automations')
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
