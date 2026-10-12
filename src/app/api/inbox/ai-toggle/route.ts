import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';
import { pausarIASessao, reativarIASessao } from '@/lib/ai/orchestrator';

// POST: Alterna o modo de atendimento entre IA e Humano para um contato específico no Inbox
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { contact_id, modo, motivo } = await req.json();

    if (!contact_id || !modo) {
      return NextResponse.json({ error: 'contact_id e modo são obrigatórios.' }, { status: 400 });
    }

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    if (!config || !config.instagram_user_id) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    const defaultAgenciaId = 'a6839f40-dc25-4c00-a662-8d90c100b8c2';

    if (modo === 'humano') {
      await pausarIASessao(config.instagram_user_id, contact_id, defaultAgenciaId, motivo || 'Atendimento assumido manualmente no Inbox');
    } else {
      await reativarIASessao(config.instagram_user_id, contact_id, defaultAgenciaId);
    }

    return NextResponse.json({ ok: true, modo });
  } catch (err: any) {
    console.error('Erro ao alternar modo de IA no Inbox:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
