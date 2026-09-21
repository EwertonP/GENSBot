import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { queryNotionDatabase, searchNotionDatabases, mapNotionPageToDemand } from '@/lib/notion';

export async function handleNotionSync(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return NextResponse.json({ error: 'NOTION_API_KEY não configurada no servidor' }, { status: 400 });
    }

    // 1. Busca todos os clientes do GENSBot
    const { data: clientes, error: clientesErr } = await supabase
      .from('clientes')
      .select('id, agencia_id, nome, notion_database_id');

    if (clientesErr) throw clientesErr;
    if (!clientes || clientes.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum cliente cadastrado no sistema.' });
    }

    // 2. Descobre todas as databases do Notion Workspace
    const discoveredDbs = await searchNotionDatabases();
    let targetDatabases: Array<{ clienteId: string; agenciaId: string; databaseId: string }> = [];

    // Mapeamento Inteligente:
    // A. Clientes com notion_database_id explicitamente configurado
    for (const c of clientes) {
      if (c.notion_database_id) {
        targetDatabases.push({
          clienteId: c.id,
          agenciaId: c.agencia_id,
          databaseId: c.notion_database_id,
        });
      }
    }

    // B. Para databases descobertas no Notion, faz o matching com o cliente pelo nome da database ou nome da página pai
    for (const db of discoveredDbs) {
      if (targetDatabases.some((t) => t.databaseId === db.id)) continue; // Já incluído acima

      const dbTitleLower = db.title.toLowerCase();
      // Tenta encontrar um cliente cujo nome bata com o título da database
      const clienteCorrespondente = clientes.find(
        (c) => dbTitleLower.includes(c.nome.toLowerCase()) || c.nome.toLowerCase().includes(dbTitleLower.replace('calendário de conteúdo', '').trim())
      );

      if (clienteCorrespondente) {
        targetDatabases.push({
          clienteId: clienteCorrespondente.id,
          agenciaId: clienteCorrespondente.agencia_id,
          databaseId: db.id,
        });
      } else if (clientes.length === 1) {
        // Se houver apenas 1 cliente cadastrado no GENSBot, vincula todas as tabelas encontradas a este cliente
        targetDatabases.push({
          clienteId: clientes[0].id,
          agenciaId: clientes[0].agencia_id,
          databaseId: db.id,
        });
      }
    }

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    for (const dbInfo of targetDatabases) {
      const pages = await queryNotionDatabase(dbInfo.databaseId);
      const nowMonth = new Date().toISOString().substring(0, 7) + '-01';

      for (const page of pages) {
        totalSynced++;
        const demand = mapNotionPageToDemand(page);

        // Prepara objeto dos arquivos no formato ArquivoConteudo[]
        const arquivos = demand.arquivosUrls.map((url, index) => ({
          id: `notion-file-${index}`,
          url,
          tipo: url.match(/\.(mp4|mov|webm)/i) ? 'video' : 'imagem',
          ordem: index,
        }));

        // Verifica se o item já existe por notion_page_id
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
          totalUpdated++;
        } else {
          await supabase.from('conteudo_items').insert({
            agencia_id: dbInfo.agenciaId,
            cliente_id: dbInfo.clienteId,
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
          totalCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      databasesScanned: targetDatabases.length,
      totalSynced,
      totalCreated,
      totalUpdated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleNotionSync(req);
}

export async function POST(req: Request) {
  return handleNotionSync(req);
}
