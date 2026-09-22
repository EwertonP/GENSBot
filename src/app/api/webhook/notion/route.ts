import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { mapNotionPageToDemand, fetchNotionPageContent, splitEstruturaELegenda, correspondeClienteEnotionDb } from '@/lib/notion';

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

    // Busca o corpo da página (estrutura "Cena 1 / Cena 2..." e "Legenda (pronta pra postar)")
    // e mescla com o que já veio das propriedades da tabela.
    const bodyContent = await fetchNotionPageContent(pageData.id);
    if (bodyContent) {
      const { estrutura, legendaPronta } = splitEstruturaELegenda(bodyContent);
      if (estrutura) {
        demand.briefing = demand.briefing ? `${demand.briefing}\n\n${estrutura}` : estrutura;
      }
      if (legendaPronta && !demand.legenda) {
        demand.legenda = legendaPronta;
      }
    }

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

      return NextResponse.json({ success: true, pageId: demand.notionPageId, action: 'updated' });
    }

    // Item novo: resolve o cliente dono da página pela coluna "Cliente" (select) da própria página —
    // todos os clientes compartilham a mesma database no Hub, então o parent id não distingue quem é quem.
    // Nunca "chuta" um cliente qualquer — isso já causava o risco de anexar conteúdo de um cliente
    // na esteira de outro. Se não achar dono certo, ignora e não grava nada.
    let clienteId: string | null = null;
    let agenciaId: string | null = null;

    if (demand.clienteLabel) {
      const { data: clientesCandidatos } = await supabase
        .from('clientes')
        .select('id, agencia_id, nome, notion_cliente_label');

      const match =
        (clientesCandidatos || []).find((c: any) => c.notion_cliente_label && c.notion_cliente_label === demand.clienteLabel) ||
        (clientesCandidatos || []).find((c: any) => correspondeClienteEnotionDb(c.nome, demand.clienteLabel));

      if (match) {
        clienteId = match.id;
        agenciaId = match.agencia_id;
      }
    }

    if (!clienteId || !agenciaId) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Cliente não mapeado para esta página (coluna "Cliente" vazia ou sem correspondência em notion_cliente_label). Evento ignorado para não gravar no cliente errado.',
          pageId: demand.notionPageId,
          clienteLabel: demand.clienteLabel || null,
        },
        { status: 200 }
      );
    }

    await supabase.from('conteudo_items').insert({
      agencia_id: agenciaId,
      cliente_id: clienteId,
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

    return NextResponse.json({ success: true, pageId: demand.notionPageId, action: 'created' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
