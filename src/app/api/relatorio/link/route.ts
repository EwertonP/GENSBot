import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { REPORT_PERIODS, gerarTokenRelatorio, obterUrlBaseApp, type ReportPeriod } from '@/lib/relatorio-token';

/**
 * Gera o link público assinado do relatório de uma conta. Só o dono da conta
 * gera — o token carrega o dono e é conferido de novo em /api/relatorio/dados.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const accountId = typeof body.accountId === 'string' ? body.accountId : '';
    const period = (REPORT_PERIODS as readonly number[]).includes(body.period) ? (body.period as ReportPeriod) : 30;
    const clienteNome = typeof body.clienteNome === 'string' ? body.clienteNome.trim().slice(0, 80) : '';

    if (!accountId || accountId === 'all') {
      return NextResponse.json({ error: 'Selecione uma conta do Instagram para gerar o relatório.' }, { status: 400 });
    }

    const account = await getInstagramAccountByInstagramUserId(accountId);
    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    const token = gerarTokenRelatorio({
      accountId,
      period,
      clienteNome: clienteNome || (account.instagram_username ? `@${account.instagram_username}` : 'Cliente'),
      ownerId: user.id,
    });

    return NextResponse.json({ token, url: `${obterUrlBaseApp()}/relatorio/${token}` });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao gerar link.' }, { status: 500 });
  }
}
