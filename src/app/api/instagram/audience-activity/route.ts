import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';

/**
 * "Quando seu público está mais ativo" — métrica NATIVA da Meta (`online_followers`),
 * o mesmo dado que aparece no Painel Profissional do próprio Instagram. Diferente de
 * `best-posting-time.ts`, que é CALCULADO a partir do desempenho dos posts já publicados
 * (alcance por dia/hora dos próprios posts) — este aqui é atividade real da audiência,
 * direto da Meta, sem depender de a conta já ter histórico de posts. Os dois se
 * complementam e aparecem como cards separados na tela (Onda 2, item 2.2 do plano).
 *
 * `online_followers` só devolve granularidade de HORA DO DIA (agregado, sem quebra por
 * dia da semana) — não existe breakdown dia×hora nessa métrica. Documentando isso em vez
 * de fingir uma granularidade que a API não oferece (mesma postura de best-posting-time.ts).
 */
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

    const res = await fetch(
      `https://graph.instagram.com/v25.0/${accountId}/insights?metric=online_followers&period=lifetime&access_token=${account.access_token}`
    );
    const data = await res.json();

    if (!res.ok) {
      // Métrica indisponível (conta pequena demais, ou nome mudou de novo entre versões
      // da Graph API) — devolve "sem dado" em vez de derrubar a tela inteira de métricas.
      return NextResponse.json({ available: false, reason: data.error?.message || 'Métrica indisponível para esta conta.' });
    }

    const byHourRaw: Record<string, number> = data.data?.[0]?.values?.[0]?.value || {};
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      followersOnline: byHourRaw[String(hour)] || 0,
    }));

    if (byHour.every((h) => h.followersOnline === 0)) {
      return NextResponse.json({ available: false, reason: 'Sem dado suficiente ainda para esta conta.' });
    }

    return NextResponse.json({ available: true, byHour });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
