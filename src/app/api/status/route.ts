import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser, listInstagramAccountsForUser } from '@/lib/instagram-account';
import { getDashboardMetrics, getTokenHealth, buildAlerts } from '@/lib/dashboard-metrics';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const userId = user.id;
    const accountParam = new URL(req.url).searchParams.get('account');
    const isAggregate = accountParam === 'all';

    let config: any = null;
    let accountIds: string[] = [];

    if (isAggregate) {
      const allAccounts = await listInstagramAccountsForUser(userId);
      accountIds = allAccounts.map(a => a.instagram_user_id);
      config = allAccounts.length > 0
        ? { instagram_username: `Todas as contas (${allAccounts.length})`, profile_picture_url: null, isAggregate: true }
        : null;
    } else {
      // Obter conta do Instagram selecionada (ou a mais recente) do usuário autenticado
      const account = await getActiveInstagramAccountForUser(userId, accountParam);
      config = account;
      accountIds = account?.instagram_user_id ? [account.instagram_user_id] : [];
    }

    const isConnected = accountIds.length > 0;

    const metrics = await getDashboardMetrics(userId, accountIds);
    const tokenHealth = await getTokenHealth(userId);
    const alerts = buildAlerts(
      tokenHealth,
      metrics.health,
      metrics.automationsRaw,
      metrics.automationRanking
    );

    return NextResponse.json({
      isConnected,
      config,
      isAggregate,
      contacts: metrics.contacts,
      stats: metrics.stats,
      recentEvents: metrics.recentEvents,
      recentQueue: metrics.recentQueue,
      funnel: metrics.funnel,
      weeklyChart: metrics.weeklyChart,
      weeklyChartMax: metrics.weeklyChartMax,
      health: metrics.health,
      trends: metrics.trends,
      failureDiagnostics: metrics.failureDiagnostics,
      automationRanking: metrics.automationRanking,
      tokenHealth,
      alerts,
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
