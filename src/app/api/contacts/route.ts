import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser, listInstagramAccountsForUser } from '@/lib/instagram-account';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// GET: Lista paginada de contatos ("Leads & Público") — extraída de getDashboardMetrics,
// que antes buscava TODOS os contatos da conta de uma vez (sem limite). Com poucos leads
// não dava pra notar, mas ia começar a travar a tela conforme os clientes crescessem.
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const accountParam = searchParams.get('account');
    const isAggregate = accountParam === 'all';
    const tag = searchParams.get('tag');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

    let accountIds: string[] = [];
    if (isAggregate) {
      const allAccounts = await listInstagramAccountsForUser(user.id);
      accountIds = allAccounts.map(a => a.instagram_user_id);
    } else {
      const account = await getActiveInstagramAccountForUser(user.id, accountParam);
      accountIds = account?.instagram_user_id ? [account.instagram_user_id] : [];
    }

    if (accountIds.length === 0) {
      return NextResponse.json({ contacts: [], total: 0, page, pageSize });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Mesma regra do dashboard: só contatos que de fato interagiram com uma
    // automação entram em "Leads & Público" (ver src/lib/dashboard-metrics.ts).
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .in('instagram_user_id', accountIds)
      .not('last_automation_id', 'is', null)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (tag) query = query.contains('tags', [tag]);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Lista de tags pro filtro do dropdown — precisa olhar todo mundo, não só a
    // página atual, senão uma tag só apareceria como opção enquanto a página que
    // a contém estivesse visível. Escala mal virou depender de leitura maciça só
    // a partir de um volume de contatos que este produto ainda não tem.
    const { data: tagRows } = await supabase
      .from('contacts')
      .select('tags')
      .eq('user_id', user.id)
      .in('instagram_user_id', accountIds)
      .not('last_automation_id', 'is', null)
      .limit(5000);
    const allTags = Array.from(new Set((tagRows || []).flatMap(r => r.tags || []))).sort();

    return NextResponse.json({ contacts: data || [], total: count || 0, page, pageSize, allTags });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
