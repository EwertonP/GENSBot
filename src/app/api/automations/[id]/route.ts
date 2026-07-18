import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { data, error } = await supabase
      .from('automations')
      .update({
        name: body.name,
        active: body.active,
        triggers: body.triggers,
        keywords: body.keywords,
        match_type: body.match_type,
        specific_post_id: body.specific_post_id || null,
        public_replies: body.public_replies,
        welcome_dm: body.welcome_dm,
        quick_reply_button: body.quick_reply_button || null,
        link_text: body.link_text || null,
        link_button_label: body.link_button_label || null,
        link_url: body.link_url || null,
        reminder_text: body.reminder_text || null,
        reminder_delay_minutes: body.reminder_delay_minutes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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
    const { id } = await params;
    const { error } = await supabase.from('automations').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
