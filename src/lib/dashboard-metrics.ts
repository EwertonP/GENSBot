import { supabase } from '@/lib/supabase';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Conta linhas de `table` criadas entre [from, to) dentro do escopo de contas.
async function countBetween(table: string, userId: string, accountIds: string[], from: Date, to: Date, dateColumn = 'created_at') {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('instagram_user_id', accountIds)
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

/**
 * Saúde do token de cada conta conectada por um usuário — usada tanto pro
 * badge de "expira em N dias" quanto pros alertas do dashboard. Sempre olha
 * TODAS as contas do usuário, independente de qual está selecionada no
 * seletor, porque uma conta esquecida sem renovar é exatamente o tipo de
 * coisa que passa batido se só aparecer quando ela está em foco.
 */
export async function getTokenHealth(userId: string) {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('instagram_user_id, instagram_username, token_expires_at')
    .eq('user_id', userId);

  if (error) throw error;

  const now = Date.now();
  return (data || []).map(acc => {
    const expiresAt = acc.token_expires_at ? new Date(acc.token_expires_at) : null;
    const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)) : null;
    let status: 'ok' | 'warning' | 'expired' | 'unknown' = 'unknown';
    if (daysRemaining !== null) {
      if (daysRemaining < 0) status = 'expired';
      else if (daysRemaining <= 7) status = 'warning';
      else status = 'ok';
    }
    return {
      instagram_user_id: acc.instagram_user_id,
      instagram_username: acc.instagram_username,
      token_expires_at: acc.token_expires_at,
      daysRemaining,
      status,
    };
  });
}

/**
 * Agregação principal do dashboard para um conjunto de contas (uma, ou todas
 * as contas do usuário no modo "visão agregada"). Mantida separada da rota
 * pra não deixar o handler HTTP gigante.
 */
export async function getDashboardMetrics(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) {
    return {
      stats: { automations: 0, contacts: 0, queue: 0, events: 0, leadsGenerated: 0 },
      contacts: [],
      recentEvents: [],
      recentQueue: [],
      funnel: { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 },
      weeklyChart: [] as { day: string; comments: number; dms: number }[],
      weeklyChartMax: 1,
      health: { sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false },
      trends: { contacts: null, automations: null, queue: null, events: null, leadsGenerated: null } as Record<string, number | null>,
      failureDiagnostics: [] as { reason: string; count: number }[],
      automationRanking: [] as { id: string; name: string; comments: number; welcomeDms: number; clicks: number; leads: number }[],
      automationsRaw: [] as { id: string; name: string; active: boolean; created_at?: string }[],
    };
  }

  const base = (table: string) => supabase.from(table).select('*').eq('user_id', userId).in('instagram_user_id', accountIds);
  const baseCount = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId).in('instagram_user_id', accountIds);

  const [
    { count: automationsCount },
    { count: contactsCount },
    { count: queueCount },
    { count: eventsCount },
    { data: contactsList },
    { data: recentEvents },
    { data: recentQueue },
    { data: analyticsEvents },
    { data: automationsList },
  ] = await Promise.all([
    baseCount('automations'),
    baseCount('contacts'),
    baseCount('queue'),
    baseCount('events'),
    base('contacts').order('updated_at', { ascending: false }),
    base('events').order('created_at', { ascending: false }).limit(20),
    supabase.from('queue').select('id, contact_id, type, status, error_message, created_at, sent_at')
      .eq('user_id', userId).in('instagram_user_id', accountIds)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('analytics_events').select('event_type, automation_id, contact_id, created_at').in('instagram_user_id', accountIds),
    base('automations').select('*'),
  ]);

  // Funil
  const funnel = { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 };
  for (const evt of analyticsEvents || []) {
    if (evt.event_type === 'comment') funnel.comments++;
    else if (evt.event_type === 'welcome_dm_sent') funnel.welcomeDms++;
    else if (evt.event_type === 'link_clicked') funnel.clicks++;
    else if (evt.event_type === 'lead_captured') funnel.leads++;
  }

  // "Leads Gerados" = pessoas DISTINTAS que de fato interagiram com uma automação
  // (bateram um gatilho e receberam a resposta inicial), não qualquer contato que
  // já mandou DM. 'comment'/'welcome_dm_sent' são logados exatamente nesse
  // momento (ver src/app/api/webhook/route.ts); `stats.contacts` (contagem crua
  // de `contacts`) inclui gente que só mandou mensagem sem bater nenhum gatilho,
  // por isso não serve pra essa métrica.
  const firstLeadDateByContact = new Map<string, Date>();
  for (const evt of analyticsEvents || []) {
    if (!evt.contact_id) continue;
    if (evt.event_type !== 'comment' && evt.event_type !== 'welcome_dm_sent') continue;
    const d = new Date(evt.created_at);
    const existing = firstLeadDateByContact.get(evt.contact_id);
    if (!existing || d < existing) firstLeadDateByContact.set(evt.contact_id, d);
  }
  const leadsGeneratedCount = firstLeadDateByContact.size;

  // Gráfico dos últimos 7 dias
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const weekComments = (analyticsEvents || []).filter(
    e => e.event_type === 'comment' && new Date(e.created_at) >= sevenDaysAgo
  );

  const { data: weekDms } = await supabase.from('queue').select('sent_at')
    .eq('user_id', userId).in('instagram_user_id', accountIds)
    .eq('status', 'sent').neq('type', 'public_reply')
    .gte('sent_at', sevenDaysAgo.toISOString());

  const weeklyChart = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sevenDaysAgo);
    day.setDate(day.getDate() + i);
    const comments = weekComments.filter(e => new Date(e.created_at).toDateString() === day.toDateString()).length;
    const dms = (weekDms || []).filter(e => e.sent_at && new Date(e.sent_at).toDateString() === day.toDateString()).length;
    return { day: WEEKDAY_LABELS[day.getDay()], comments, dms };
  });
  const weeklyChartMax = Math.max(1, ...weeklyChart.map(d => Math.max(d.comments, d.dms)));

  // Saúde das entregas (todo o histórico da fila, exceto respostas públicas)
  const [{ count: sentCount }, { count: pendingHealthCount }, { count: failedCount }] = await Promise.all([
    supabase.from('queue').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('instagram_user_id', accountIds).eq('status', 'sent').neq('type', 'public_reply'),
    supabase.from('queue').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('instagram_user_id', accountIds).eq('status', 'pending').neq('type', 'public_reply'),
    supabase.from('queue').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('instagram_user_id', accountIds).eq('status', 'failed').neq('type', 'public_reply'),
  ]);

  const healthTotal = (sentCount || 0) + (pendingHealthCount || 0) + (failedCount || 0);
  const health = healthTotal > 0
    ? {
        sentPercent: Math.round(((sentCount || 0) / healthTotal) * 100),
        pendingPercent: Math.round(((pendingHealthCount || 0) / healthTotal) * 100),
        failedPercent: Math.round(((failedCount || 0) / healthTotal) * 100),
        hasData: true,
      }
    : { sentPercent: 0, pendingPercent: 0, failedPercent: 0, hasData: false };

  // Tendências: últimos 30 dias vs 30 dias anteriores
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);
  const previousPeriodStart = new Date(periodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

  const [
    contactsCurrent, contactsPrevious,
    automationsCurrent, automationsPrevious,
    queueCurrent, queuePrevious,
    eventsCurrent, eventsPrevious,
  ] = await Promise.all([
    countBetween('contacts', userId, accountIds, periodStart, now, 'first_contact_at'),
    countBetween('contacts', userId, accountIds, previousPeriodStart, periodStart, 'first_contact_at'),
    countBetween('automations', userId, accountIds, periodStart, now),
    countBetween('automations', userId, accountIds, previousPeriodStart, periodStart),
    countBetween('queue', userId, accountIds, periodStart, now),
    countBetween('queue', userId, accountIds, previousPeriodStart, periodStart),
    countBetween('events', userId, accountIds, periodStart, now),
    countBetween('events', userId, accountIds, previousPeriodStart, periodStart),
  ]);

  let leadsGeneratedCurrent = 0;
  let leadsGeneratedPrevious = 0;
  for (const d of firstLeadDateByContact.values()) {
    if (d >= periodStart && d < now) leadsGeneratedCurrent++;
    else if (d >= previousPeriodStart && d < periodStart) leadsGeneratedPrevious++;
  }

  const trends = {
    contacts: percentChange(contactsCurrent, contactsPrevious),
    automations: percentChange(automationsCurrent, automationsPrevious),
    queue: percentChange(queueCurrent, queuePrevious),
    events: percentChange(eventsCurrent, eventsPrevious),
    leadsGenerated: percentChange(leadsGeneratedCurrent, leadsGeneratedPrevious),
  };

  // Diagnóstico de falhas: motivos mais comuns de erro na fila (últimos 90 dias)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { data: failedJobs } = await supabase.from('queue').select('error_message')
    .eq('user_id', userId).in('instagram_user_id', accountIds)
    .eq('status', 'failed')
    .gte('created_at', ninetyDaysAgo.toISOString());

  const failureCounts = new Map<string, number>();
  for (const job of failedJobs || []) {
    const reason = job.error_message || 'Erro desconhecido';
    failureCounts.set(reason, (failureCounts.get(reason) || 0) + 1);
  }
  const failureDiagnostics = Array.from(failureCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Ranking de automações por engajamento (comentários -> DMs -> cliques -> leads)
  const automationCounters = new Map<string, { comments: number; welcomeDms: number; clicks: number; leads: number }>();
  for (const evt of analyticsEvents || []) {
    if (!evt.automation_id) continue;
    const entry = automationCounters.get(evt.automation_id) || { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 };
    if (evt.event_type === 'comment') entry.comments++;
    else if (evt.event_type === 'welcome_dm_sent') entry.welcomeDms++;
    else if (evt.event_type === 'link_clicked') entry.clicks++;
    else if (evt.event_type === 'lead_captured') entry.leads++;
    automationCounters.set(evt.automation_id, entry);
  }

  const automationRanking = (automationsList || [])
    .map(auto => ({ id: auto.id, name: auto.name, ...(automationCounters.get(auto.id) || { comments: 0, welcomeDms: 0, clicks: 0, leads: 0 }) }))
    .sort((a, b) => (b.leads - a.leads) || (b.clicks - a.clicks) || (b.welcomeDms - a.welcomeDms))
    .slice(0, 5);

  return {
    stats: {
      automations: automationsCount || 0,
      contacts: contactsCount || 0,
      queue: queueCount || 0,
      events: eventsCount || 0,
      leadsGenerated: leadsGeneratedCount,
    },
    contacts: contactsList || [],
    recentEvents: recentEvents || [],
    recentQueue: recentQueue || [],
    funnel,
    weeklyChart,
    weeklyChartMax,
    health,
    trends,
    failureDiagnostics,
    automationRanking,
    automationsRaw: automationsList || [],
  };
}

/**
 * Alertas computados a partir dos dados já calculados — sem tabela própria,
 * é só um resumo do que já sabemos que merece atenção do usuário.
 */
export function buildAlerts(
  tokenHealth: Awaited<ReturnType<typeof getTokenHealth>>,
  health: { failedPercent: number; hasData: boolean },
  automations: { id: string; name: string; active: boolean; created_at?: string }[],
  automationRanking: { id: string; leads: number; clicks: number; welcomeDms: number; comments: number }[],
  healthScopeKey = 'combined'
) {
  const alerts: { level: 'critical' | 'warning'; message: string; key: string }[] = [];

  for (const acc of tokenHealth) {
    if (acc.status === 'expired') {
      alerts.push({ level: 'critical', key: `token:${acc.instagram_user_id}`, message: `O token da conta @${acc.instagram_username || acc.instagram_user_id} expirou. Reconecte a conta para as automações voltarem a funcionar.` });
    } else if (acc.status === 'warning') {
      alerts.push({ level: 'warning', key: `token:${acc.instagram_user_id}`, message: `O token da conta @${acc.instagram_username || acc.instagram_user_id} expira em ${acc.daysRemaining} dia(s). A renovação automática deve cobrir isso, mas vale confirmar.` });
    }
  }

  if (health.hasData && health.failedPercent >= 20) {
    alerts.push({ level: 'warning', key: `failure_rate:${healthScopeKey}`, message: `${health.failedPercent}% dos disparos recentes falharam. Veja o diagnóstico de falhas para entender o motivo.` });
  }

  const rankingByAutomation = new Map(automationRanking.map(r => [r.id, r]));
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const auto of automations) {
    if (!auto.active) continue;
    const isOld = auto.created_at ? new Date(auto.created_at) < thirtyDaysAgo : true;
    if (!isOld) continue;
    const activity = rankingByAutomation.get(auto.id);
    const totalActivity = activity ? activity.comments + activity.clicks + activity.welcomeDms : 0;
    if (totalActivity === 0) {
      alerts.push({ level: 'warning', key: `automation_inactive:${auto.id}`, message: `A automação "${auto.name}" está ativa mas não teve nenhuma interação registrada. Confira se os gatilhos ainda fazem sentido.` });
    }
  }

  return alerts;
}
