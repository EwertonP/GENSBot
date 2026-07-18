import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Obter status da conexão do Instagram
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('instagram_username, profile_picture_url, token_expires_at, instagram_user_id')
      .single();

    const isConnected = !!config?.instagram_username;

    const activeUserId = config?.instagram_user_id;

    // 2. Obter estatísticas básicas
    const { count: automationsCount } = activeUserId
      ? await supabase.from('automations').select('*', { count: 'exact', head: true }).eq('instagram_user_id', activeUserId)
      : { count: 0 };

    const { count: contactsCount } = activeUserId
      ? await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('instagram_user_id', activeUserId)
      : { count: 0 };

    const { count: queueCount } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true });

    const { count: eventsCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    // Buscar contatos cadastrados
    const { data: contactsList } = activeUserId
      ? await supabase.from('contacts').select('*').eq('instagram_user_id', activeUserId).order('updated_at', { ascending: false })
      : { data: [] };

    // Buscar últimos logs de eventos para exibição
    const { data: recentEvents } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Buscar últimos status da fila de envios
    const { data: recentQueue } = await supabase
      .from('queue')
      .select('id, contact_id, type, status, error_message, created_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      isConnected,
      config: config || null,
      contacts: contactsList || [],
      stats: {
        automations: automationsCount || 0,
        contacts: contactsCount || 0,
        queue: queueCount || 0,
        events: eventsCount || 0,
      },
      recentEvents: recentEvents || [],
      recentQueue: recentQueue || [],
    });
  } catch (err: any) {
    console.error('Erro ao buscar status da aplicação:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { error } = await supabase.from('config').delete().eq('id', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
