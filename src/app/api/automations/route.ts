import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Buscar o ID da conta do Instagram conectada atualmente
    const { data: config } = await supabase
      .from('config')
      .select('instagram_user_id')
      .single();

    if (!config || !config.instagram_user_id) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('automations')
      .select('*')
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
    const body = await req.json();

    if (!body.name || !body.welcome_dm) {
      return NextResponse.json({ error: 'Nome e DM de boas-vindas são obrigatórios.' }, { status: 400 });
    }

    // Buscar o ID da conta do Instagram conectada atualmente
    const { data: config } = await supabase
      .from('config')
      .select('instagram_user_id')
      .single();

    if (!config || !config.instagram_user_id) {
      return NextResponse.json({ error: 'Você precisa conectar uma conta do Instagram primeiro.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('automations')
      .insert({
        instagram_user_id: config.instagram_user_id,
        name: body.name,
        active: body.active ?? true,
        triggers: body.triggers || [],
        keywords: body.keywords || [],
        match_type: body.match_type || 'contains',
        specific_post_id: body.specific_post_id || null,
        public_replies: body.public_replies || [],
        welcome_dm: body.welcome_dm,
        quick_reply_button: body.quick_reply_button || null,
        link_text: body.link_text || null,
        link_button_label: body.link_button_label || null,
        link_url: body.link_url || null,
        reminder_text: body.reminder_text || null,
        reminder_delay_minutes: body.reminder_delay_minutes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
