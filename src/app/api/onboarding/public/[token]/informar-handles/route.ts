import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';

function limparHandle(handle?: string | null): string | null {
  if (!handle) return null;
  const limpo = handle.trim().replace(/^@+/, '');
  return limpo.length > 0 ? limpo : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const instagram = limparHandle(body.instagram);
    const threads = limparHandle(body.threads);
    const tiktok = limparHandle(body.tiktok);

    const { data: link, error: linkErr } = await db
      .from('cliente_onboarding_links')
      .select('id, cliente_id, expira_em')
      .eq('token', token)
      .maybeSingle();

    if (linkErr) {
      if (linkErr.code === '42P01') {
        return NextResponse.json(
          { error: 'Tabela de onboarding não migrada.' },
          { status: 503 }
        );
      }
      throw linkErr;
    }

    if (!link) {
      return NextResponse.json(
        { error: 'Link de onboarding não encontrado ou expirado.' },
        { status: 404 }
      );
    }

    if (new Date() > new Date(link.expira_em)) {
      return NextResponse.json(
        { error: 'Este link de onboarding expirou.' },
        { status: 410 }
      );
    }

    const { error: updateErr } = await db
      .from('cliente_onboarding_links')
      .update({
        instagram_username_informado: instagram,
        threads_username_informado: threads,
        tiktok_username_informado: tiktok,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', link.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      sucesso: true,
      handles: { instagram, threads, tiktok },
    });
  } catch (err) {
    console.error('Erro na rota POST /api/onboarding/public/[token]/informar-handles:', err);
    return NextResponse.json(
      { error: 'Erro ao salvar perfis informados.' },
      { status: 500 }
    );
  }
}
