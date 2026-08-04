import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Conta linhas de `table` criadas entre [from, to) para a conta ativa.
async function countBetween(table: string, userId: string, activeUserId: string, from: Date, to: Date, dateColumn = 'created_at') {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('instagram_user_id', activeUserId)
    .gte(dateColumn, from.toISOString())
    .lt(dateColumn, to.toISOString());
  return count || 0;
}

// Variação percentual entre o período atual e o anterior (mesma duração).
// Retorna null quando não há base de comparação (período anterior vazio).
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const userId = user.id;
    const accountParam = new URL(req.url).searchParams.get('account');

    // 1. Obter conta do Instagram selecionada (ou a mais recente) do usuário autenticado
    const config = await getActiveInstagramAccountForUser(userId, accountParam);

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
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
      : { count: 0 };

    const { count: eventsCount } = activeUserId
      ? await supabase.from('events').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
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
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] };

    // 5. Fila recente do usuário
    const { data: recentQueue } = activeUserId
      ? await supabase.from('queue')
          .select('id, contact_id, type, status, error_message, created_at, sent_at')
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
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

    // 7. Gráfico dos últimos 7 dias: comentários detectados x DMs entregues por dia
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: weekComments } = activeUserId
      ? await supabase.from('analytics_events').select('created_at')
          .eq('instagram_user_id', activeUserId)
          .eq('event_type', 'comment')
          .gte('created_at', sevenDaysAgo.toISOString())
      : { data: [] };

    const { data: weekDms } = activeUserId
      ? await supabase.from('queue').select('sent_at')
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
          .eq('status', 'sent').neq('type', 'public_reply')
          .gte('sent_at', sevenDaysAgo.toISOString())
      : { data: [] };

    const weeklyChart = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(sevenDaysAgo);
      day.setDate(day.getDate() + i);
      const comments = (weekComments || []).filter(e => new Date(e.created_at).toDateString() === day.toDateString()).length;
      const dms = (weekDms || []).filter(e => e.sent_at && new Date(e.sent_at).toDateString() === day.toDateString()).length;
      return { day: WEEKDAY_LABELS[day.getDay()], comments, dms };
    });
    const weeklyChartMax = Math.max(1, ...weeklyChart.map(d => Math.max(d.comments, d.dms)));

    // 8. Saúde das entregas: proporção real de sent / pending / failed na fila (todo o histórico)
    const { count: sentCount } = activeUserId
      ? await supabase.from('queue').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
          .eq('status', 'sent').neq('type', 'public_reply')
      : { count: 0 };
    const { count: pendingHealthCount } = activeUserId
      ? await supabase.from('queue').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
          .eq('status', 'pending').neq('type', 'public_reply')
      : { count: 0 };
    const { count: failedCount } = activeUserId
      ? await supabase.from('queue').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('instagram_user_id', activeUserId)
          .eq('status', 'failed').neq('type', 'public_reply')
      : { count: 0 };

    const healthTotal = (sentCount || 0) + (pendingHealthCount || 0) + (failedCount || 0);
    const health = healthTotal > 0
      ? {
          sentPercent: Math.round(((sentCount || 0) / healthTotal) * 100),
          pendingPercent: Math.round(((pendingHealthCount || 0) / healthTotal) * 100),
          failedPercent: Math.round(((failedCount || 0) / healthTotal) * 100),
          hasData: true,
        }
      : { sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false };

    // 9. Tendências reais: período atual (últimos 30 dias) vs período anterior (30 dias antes disso)
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 30);
    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

    const trends = activeUserId
      ? {
          contacts: percentChange(
            await countBetween('contacts', userId, activeUserId, periodStart, now, 'first_contact_at'),
            await countBetween('contacts', userId, activeUserId, previousPeriodStart, periodStart, 'first_contact_at')
          ),
          automations: percentChange(
            await countBetween('automations', userId, activeUserId, periodStart, now),
            await countBetween('automations', userId, activeUserId, previousPeriodStart, periodStart)
          ),
          queue: percentChange(
            await countBetween('queue', userId, activeUserId, periodStart, now),
            await countBetween('queue', userId, activeUserId, previousPeriodStart, periodStart)
          ),
          events: percentChange(
            await countBetween('events', userId, activeUserId, periodStart, now),
            await countBetween('events', userId, activeUserId, previousPeriodStart, periodStart)
          ),
        }
      : { contacts: null, automations: null, queue: null, events: null };

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
      weeklyChart,
      weeklyChartMax,
      health,
      trends,
    });
  } catch (err: any) {
    console.error('Erro ao buscar status:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE: Desconecta uma conta específica do Instagram (não afeta as outras
// contas conectadas pelo mesmo usuário).
export async function DELETE(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountParam = new URL(req.url).searchParams.get('account');
    if (!accountParam) {
      return NextResponse.json({ error: 'Parâmetro account é obrigatório.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('instagram_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('instagram_user_id', accountParam);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
