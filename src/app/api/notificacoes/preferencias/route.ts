import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';
import { TIPOS_NOTIFICACAO, tipoValido, type TipoNotificacao } from '@/lib/notificar';

/** Preferências da pessoa: para cada tipo, se ela quer push (o aviso no sino sempre existe). */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const { data } = await supabase.from('notificacao_preferencias').select('tipo, push').eq('user_id', user.id);
  const salvas = new Map((data || []).map((p: { tipo: string; push: boolean }) => [p.tipo, p.push]));
  const itens = (Object.keys(TIPOS_NOTIFICACAO) as TipoNotificacao[]).map((tipo) => ({
    tipo,
    rotulo: TIPOS_NOTIFICACAO[tipo].rotulo,
    descricao: TIPOS_NOTIFICACAO[tipo].descricao,
    push: salvas.get(tipo) ?? TIPOS_NOTIFICACAO[tipo].pushPadrao,
  }));
  return NextResponse.json({ itens });
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  if (!tipoValido(body?.tipo) || typeof body?.push !== 'boolean') return NextResponse.json({ error: 'Tipo ou valor inválido.' }, { status: 400 });

  const { error } = await supabase.from('notificacao_preferencias').upsert({ user_id: user.id, tipo: body.tipo, push: body.push }, { onConflict: 'user_id,tipo' });
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
