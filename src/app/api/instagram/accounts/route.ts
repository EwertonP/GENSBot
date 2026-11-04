import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { listInstagramAccountsForUser } from '@/lib/instagram-account';
import { supabase } from '@/lib/supabase';

// GET: Lista todas as contas do Instagram conectadas pelo usuário/agência,
// respeitando o escopo do papel:
// - master: todas as contas da agência.
// - membro: apenas as contas dos clientes aos quais está vinculado.
// - cliente: apenas a conta do seu cliente.
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { data: membro } = await supabase
      .from('membros')
      .select('papel, cliente_id')
      .eq('id', user.id)
      .maybeSingle();

    const accounts = await listInstagramAccountsForUser(user.id);

    if (membro?.papel === 'cliente' && membro.cliente_id) {
      const { data: cli } = await supabase
        .from('clientes')
        .select('instagram_account_id')
        .eq('id', membro.cliente_id)
        .maybeSingle();

      return NextResponse.json(accounts.filter((a) => a.id === cli?.instagram_account_id));
    }

    if (membro?.papel === 'membro') {
      const { data: vinculos } = await supabase
        .from('membro_clientes')
        .select('cliente:clientes(instagram_account_id)')
        .eq('membro_id', user.id);

      const allowedAccountIds = new Set(
        (vinculos || [])
          .map((v: any) => v.cliente?.instagram_account_id)
          .filter(Boolean)
      );

      return NextResponse.json(accounts.filter((a) => allowedAccountIds.has(a.id)));
    }

    return NextResponse.json(accounts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
