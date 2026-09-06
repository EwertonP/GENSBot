import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logDbError } from '@/lib/db-log';

// GET /r/[code]: redirect público (sem autenticação — é o link que o lead de fato
// clica, vindo do Instagram) que loga o clique antes de mandar pro destino real.
// O clique vira um analytics_events do tipo 'link_clicked' (mesmo tipo que o
// dashboard já soma no funil/ranking de automações), vinculado à automação
// quando o link UTM foi criado a partir de uma — permitindo comparar quantas
// vezes a automação rodou vs quantas vezes o link final foi de fato clicado.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const { data: link, error } = await supabase
    .from('utm_links')
    .select('*')
    .eq('short_code', code)
    .maybeSingle();

  if (error) {
    logDbError('utm_links.select (redirect)', error);
    return new Response('Erro ao processar o link.', { status: 500 });
  }
  if (!link) {
    return new Response('Link não encontrado.', { status: 404 });
  }

  const { error: incrementError } = await supabase
    .from('utm_links')
    .update({ click_count: (link.click_count || 0) + 1 })
    .eq('id', link.id);
  logDbError('utm_links.update (click_count)', incrementError);

  const { error: analyticsError } = await supabase.from('analytics_events').insert({
    user_id: link.user_id,
    instagram_user_id: link.instagram_user_id,
    automation_id: link.automation_id,
    event_type: 'link_clicked',
  });
  logDbError('analytics_events.insert (utm redirect)', analyticsError);

  return NextResponse.redirect(link.generated_url, { status: 302 });
}
