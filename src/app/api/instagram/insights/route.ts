import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { listInstagramAccountsForUser, getInstagramAccountByInstagramUserId, getUserIdsInSameAgency } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';
import { ALLOWED_PERIODS, fetchAccountMetrics, type Period } from '@/lib/instagram-insights';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const agencyUserIds = await getUserIdsInSameAgency(user.id);
    const userIds = agencyUserIds.length > 0 ? agencyUserIds : [user.id];

    const url = new URL(req.url);
    const accountParam = url.searchParams.get('account');
    const periodParam = Number(url.searchParams.get('period'));
    const period = (ALLOWED_PERIODS.includes(periodParam as Period) ? periodParam : 7) as Period;
    const isAggregate = !accountParam || accountParam === 'all';

    let targets: { instagram_user_id: string; access_token: string }[] = [];

    if (isAggregate) {
      const accounts = await listInstagramAccountsForUser(user.id);
      const { data: withTokens } = await supabase
        .from('instagram_accounts')
        .select('instagram_user_id, access_token')
        .in('user_id', userIds)
        .in('instagram_user_id', accounts.map((a) => a.instagram_user_id));
      targets = withTokens || [];
    } else {
      const account = await getInstagramAccountByInstagramUserId(accountParam);
      if (account && userIds.includes(account.user_id)) {
        targets = [{ instagram_user_id: account.instagram_user_id, access_token: account.access_token }];
      }
    }

    if (targets.length === 0) return NextResponse.json([]);

    const results = await Promise.allSettled(targets.map((t) => fetchAccountMetrics(t.instagram_user_id, t.access_token, period)));

    const metrics = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { instagram_user_id: targets[i].instagram_user_id, error: 'Falha ao buscar métricas.' }
    );

    return NextResponse.json(metrics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
