import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';

/** Lista as notificações da pessoa logada (mais novas primeiro) e quantas não foram lidas. */
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const limite = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limite')) || 30, 1), 100);
  const [{ data: itens, error }, { count }] = await Promise.all([
    supabase.from('notificacoes').select('id, tipo, titulo, corpo, url, lida_em, criado_em').eq('user_id', user.id).order('criado_em', { ascending: false }).limit(limite),
    supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('lida_em', null),
  ]);
  if (error) return NextResponse.json({ error: 'Não foi possível carregar as notificações.' }, { status: 500 });
  return NextResponse.json({ itens: itens || [], naoLidas: count || 0 });
}

/** Marca como lidas: `{ acao: 'todas' }` ou `{ acao: 'lidas', ids: [...] }`. */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  const agora = new Date().toISOString();
  let q = supabase.from('notificacoes').update({ lida_em: agora }).eq('user_id', user.id).is('lida_em', null);

  if (body?.acao === 'lidas') {
    const ids = Array.isArray(body.ids) ? body.ids.filter((i: unknown): i is string => typeof i === 'string').slice(0, 100) : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Informe os ids.' }, { status: 400 });
    q = q.in('id', ids);
  } else if (body?.acao !== 'todas') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: 'Não foi possível marcar como lida.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
