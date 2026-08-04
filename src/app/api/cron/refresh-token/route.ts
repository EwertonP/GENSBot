import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function handleRefresh(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    // Renovar todas as contas cujo token expira nos próximos 7 dias (a Meta
    // exige refresh entre 24h e 60 dias antes do vencimento). Antes esta rota
    // só olhava uma única linha da tabela `config`, o que quebrava qualquer
    // conta além da primeira em um cenário multi-tenant.
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);

    const { data: accounts, error: accountsError } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_user_id, access_token, token_expires_at')
      .lte('token_expires_at', soon.toISOString());

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'Nenhum token precisa ser renovado.' });
    }

    const results = [];

    for (const account of accounts) {
      if (!account.access_token) {
        results.push({ instagram_user_id: account.instagram_user_id, status: 'skipped', reason: 'sem_token' });
        continue;
      }

      try {
        const refreshResponse = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.access_token}`
        );
        const refreshData = await refreshResponse.json();

        if (!refreshResponse.ok || !refreshData.access_token) {
          console.error('Erro ao renovar token:', account.instagram_user_id, refreshData);
          results.push({ instagram_user_id: account.instagram_user_id, status: 'failed' });
          continue;
        }

        const expiresIn = refreshData.expires_in || 5184000;
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

        const { error: updateError } = await supabase
          .from('instagram_accounts')
          .update({
            access_token: refreshData.access_token,
            token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);

        if (updateError) throw updateError;

        results.push({ instagram_user_id: account.instagram_user_id, status: 'refreshed', expires_at: expiresAt.toISOString() });
      } catch (err: any) {
        console.error('Erro ao renovar token da conta', account.instagram_user_id, err);
        results.push({ instagram_user_id: account.instagram_user_id, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('Erro na renovação de token cron:', err);
    return NextResponse.json({ error: err.message || 'Erro desconhecido' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleRefresh(req);
}

export async function POST(req: Request) {
  return handleRefresh(req);
}
