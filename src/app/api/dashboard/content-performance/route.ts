import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId, listInstagramAccountsForUser } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';
import { ALLOWED_PERIODS, buildEmptySparkline, computeContentPerformance, type Period } from '@/lib/content-performance';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const url = new URL(req.url);
    const accountParam = url.searchParams.get('account');
    const periodParam = Number(url.searchParams.get('period'));
    const period = (ALLOWED_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period;
    const isAggregate = !accountParam || accountParam === 'all';

    let targets: { instagram_user_id: string; access_token: string }[] = [];

    if (isAggregate) {
      const accounts = await listInstagramAccountsForUser(user.id);
      const { data: withTokens } = await supabase
        .from('instagram_accounts')
        .select('instagram_user_id, access_token')
        .eq('user_id', user.id)
        .in('instagram_user_id', accounts.map((a) => a.instagram_user_id));
      targets = withTokens || [];
    } else {
      const account = await getInstagramAccountByInstagramUserId(accountParam);
      if (account && account.user_id === user.id) {
        targets = [{ instagram_user_id: account.instagram_user_id, access_token: account.access_token }];
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({
        summary: {
          posts: 0,
          reels: 0,
          stories: 0,
          reachTotal: 0,
          engagementRate: 0,
          postsSparkline: buildEmptySparkline(period),
          reelsSparkline: buildEmptySparkline(period),
          storiesSparkline: buildEmptySparkline(period),
          reachSparkline: buildEmptySparkline(period),
        },
        topPublications: [],
        topStories: [],
        linkClicks: { bio: 0, dm: 0 },
      });
    }

    const accountIds = targets.map((t) => t.instagram_user_id);
    const { summary, topPublications, topStories } = await computeContentPerformance(targets, period);

    const { data: utmLinks } = await supabase
      .from('utm_links')
      .select('automation_id, click_count, instagram_user_id')
      .eq('user_id', user.id)
      .in('instagram_user_id', accountIds);

    let bioClicks = 0;
    let dmClicks = 0;
    for (const link of utmLinks || []) {
      if (link.automation_id === null) bioClicks += link.click_count || 0;
      else dmClicks += link.click_count || 0;
    }

    return NextResponse.json({
      summary,
      topPublications,
      topStories,
      linkClicks: { bio: bioClicks, dm: dmClicks },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
