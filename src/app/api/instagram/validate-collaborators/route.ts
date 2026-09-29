import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getAccountForUserOrAgency } from '@/lib/instagram-account';
import { erroLimiteColaboradores, validarColaboradores } from '@/lib/instagram-publish';

export const maxDuration = 60;

const EXT_IMAGEM = /\.(jpe?g|png|webp)(\?|$)/i;

/**
 * POST /api/instagram/validate-collaborators
 * Pergunta à Meta, antes de agendar, se os @ escolhidos podem ser colaboradores
 * (perfil público e @ correto). Não publica nada.
 *
 * body: { instagram_user_id, collaborators: string[], sample_media_url?: string }
 * resposta: { ok: true, verificado } | { ok: false, invalidos, error }
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = (await req.json()) as { instagram_user_id?: string; collaborators?: string[]; sample_media_url?: string };
    const colaboradores = (body.collaborators || []).map((c) => String(c).replace(/^@/, '').trim()).filter(Boolean);
    if (!body.instagram_user_id || colaboradores.length === 0) {
      return NextResponse.json({ ok: true, verificado: false });
    }

    const limite = erroLimiteColaboradores(colaboradores);
    if (limite) return NextResponse.json({ ok: false, invalidos: [], error: limite }, { status: 400 });

    const account = await getAccountForUserOrAgency(user.id, body.instagram_user_id);
    if (!account?.access_token) {
      return NextResponse.json({ error: 'Conta do Instagram não encontrada.' }, { status: 404 });
    }

    // A Meta precisa de uma imagem para criar o container de teste: usa a do post, se for
    // imagem; senão, o logo público do app (o container nunca é publicado).
    const origem = new URL(req.url).origin;
    const amostra = body.sample_media_url && EXT_IMAGEM.test(body.sample_media_url) ? body.sample_media_url : `${origem}/logo.png`;

    const resultado = await validarColaboradores({
      instagramUserId: body.instagram_user_id,
      accessToken: account.access_token,
      collaborators: colaboradores,
      sampleImageUrl: amostra,
    });

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, invalidos: resultado.invalidos, error: resultado.mensagem });
    }
    return NextResponse.json(resultado);
  } catch (err) {
    console.error('validate-collaborators:', err);
    // A checagem é uma ajuda: se ela própria quebrar, não trava o agendamento.
    return NextResponse.json({ ok: true, verificado: false });
  }
}
