import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const userId = user.id;

    // 1. Obter config do Instagram SOMENTE do usuário autenticado
    const { data: config } = await supabase
      .from('config')
      .select('instagram_username, profile_picture_url, token_expires_at, instagram_user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const isConnected = !!config?.instagram_username;
    const activeUserId = config?.instagram_user_id;

    // 2. Estatísticas filtradas por user_id
    const { count: automationsCount } = activeUserId
      ? await supabase.from('automations').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
      : { count: 0 };

    const { count: contactsCount } = activeUserId
      ? await supabase.from('contacts').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
      : { count: 0 };

    const { count: queueCount } = activeUserId
      ? await supabase.from('queue').select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
      : { count: 0 };

    const { count: eventsCount } = activeUserId
      ? await supabase.from('events').select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
      : { count: 0 };

    // 3. Contatos do usuário
    const { data: contactsList } = activeUserId
      ? await supabase.from('contacts').select('*')
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
          .order('updated_at', { ascending: false })
      : { data: [] };

    // 4. Eventos recentes do usuário
    const { data: recentEvents } = activeUserId
      ? await supabase.from('events').select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] };

    // 5. Fila recente do usuário
    const { data: recentQueue } = activeUserId
      ? await supabase.from('queue')
          .select('id, contact_id, type, status, error_message, created_at, sent_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] };

    // 6. Funil de analytics do usuário
    const { data: analyticsEvents } = activeUserId
      ? await supabase.from('analytics_events').select('event_type')
          .eq('instagram_user_id', activeUserId)
      : { data: null };

    const funnel = { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 };
    if (analyticsEvents) {
      for (const evt of analyticsEvents) {
        if (evt.event_type === 'comment') funnel.comments++;
        else if (evt.event_type === 'welcome_dm_sent') funnel.welcomeDms++;
        else if (evt.event_type === 'link_clicked') funnel.clicks++;
        else if (evt.event_type === 'lead_captured') funnel.leads++;
      }
    }

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
      funnel,
    });
  } catch (err: any) {
    console.error('Erro ao buscar status:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { error } = await supabase
      .from('config')
      .delete()
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
