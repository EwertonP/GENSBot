import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { mapNotionPageToDemand } from '@/lib/notion';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verificação de URL challenge do Notion se aplicável
    if (body.verification_challenge || body.challenge) {
      return NextResponse.json({ challenge: body.verification_challenge || body.challenge });
    }

    const pageData = body.data || body.entity || body.page || body;
    if (!pageData || !pageData.id || !pageData.properties) {
      return NextResponse.json({ message: 'Payload de webhook ignóvel ou sem dados de página' }, { status: 200 });
    }

    const demand = mapNotionPageToDemand(pageData);
    const nowMonth = new Date().toISOString().substring(0, 7) + '-01';

    // Formata os arquivos recebidos
    const arquivos = demand.arquivosUrls.map((url, index) => ({
      id: `notion-file-${index}`,
      url,
      tipo: url.match(/\.(mp4|mov|webm)/i) ? 'video' : 'imagem',
      ordem: index,
    }));

    // Tenta encontrar a página existente no banco
    const { data: existing } = await supabase
      .from('conteudo_items')
      .select('id')
      .eq('notion_page_id', demand.notionPageId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('conteudo_items')
        .update({
          titulo: demand.titulo,
          tipo: demand.tipo,
          status: demand.status,
          legenda: demand.legenda,
          briefing: demand.briefing,
          arquivos: arquivos.length > 0 ? arquivos : undefined,
          notion_last_edited: demand.lastEditedTime,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Se for item novo, pega o primeiro cliente disponível se não puder mapear direto
      const { data: cliente } = await supabase.from('clientes').select('id, agencia_id').limit(1).single();

      if (cliente) {
        await supabase.from('conteudo_items').insert({
          agencia_id: cliente.agencia_id,
          cliente_id: cliente.id,
          notion_page_id: demand.notionPageId,
          titulo: demand.titulo,
          tipo: demand.tipo,
          status: demand.status,
          legenda: demand.legenda,
          briefing: demand.briefing,
          mes_referencia: nowMonth,
          arquivos,
          notion_last_edited: demand.lastEditedTime,
        });
      }
    }

    return NextResponse.json({ success: true, pageId: demand.notionPageId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
