import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { listInstagramAccountsForUser } from '@/lib/instagram-account';

// GET: Lista todas as contas do Instagram conectadas pelo usuário logado,
// para alimentar o seletor de contas no dashboard.
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accounts = await listInstagramAccountsForUser(user.id);
    return NextResponse.json(accounts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
