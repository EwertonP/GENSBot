import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';
import { endpointValido } from '@/lib/push';

/** Registra o aparelho atual para receber notificações. */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpointValido(sub?.endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: 'Inscrição inválida.' }, { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 300) : null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a inscrição.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Cancela a inscrição do aparelho atual (só a da própria pessoa). */
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Informe o endpoint.' }, { status: 400 });

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
  return NextResponse.json({ ok: true });
}
