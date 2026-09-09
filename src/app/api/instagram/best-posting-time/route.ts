import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { getBestPostingTimes } from '@/lib/best-posting-time';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const accountId = new URL(req.url).searchParams.get('account');
    if (!accountId) {
      return NextResponse.json({ error: 'Conta é obrigatória.' }, { status: 400 });
    }

    const account = await getInstagramAccountByInstagramUserId(accountId);
    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    const result = await getBestPostingTimes(accountId, account.access_token);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
