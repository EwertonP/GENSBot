import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  if (secret !== 'gensbot-debug-clientes-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: clientes, error: errCli } = await serviceSupabase
    .from('clientes')
    .select('id, nome, ativo, posts_mes, reels_mes, instagram_account_id, criado_em')
    .order('criado_em', { ascending: true });

  const { data: contas, error: errContas } = await serviceSupabase
    .from('instagram_accounts')
    .select('id, username, instagram_username');

  return NextResponse.json({
    clientes,
    contas,
    errCli: errCli?.message,
    errContas: errContas?.message,
  });
}
