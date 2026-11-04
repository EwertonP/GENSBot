import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { enviarPush, pushConfigurado } from '@/lib/push';

/** Manda uma notificação de teste para os aparelhos da própria pessoa. */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();
  if (!pushConfigurado()) {
    return NextResponse.json({ error: 'As chaves de notificação (VAPID) ainda não foram configuradas no servidor.' }, { status: 503 });
  }
  const r = await enviarPush(user.id, { title: 'GENSBot', body: 'As notificações estão funcionando neste aparelho.', url: '/', tag: 'teste' });
  if (r.enviados === 0) return NextResponse.json({ error: 'Nenhum aparelho recebeu. Ative as notificações neste aparelho primeiro.', ...r }, { status: 409 });
  return NextResponse.json({ ok: true, ...r });
}
