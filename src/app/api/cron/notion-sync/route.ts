import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { queryNotionDatabase, searchNotionDatabases, mapNotionPageToDemand, correspondeClienteEnotionDb, fetchNotionPageContent } from '@/lib/notion';
import { getContextoAgencia } from '@/lib/clientes-server';

export async function handleNotionSync(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 1. Vercel Cron com Bearer Token
  const isVercelCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  // 2. Chamada manual pela interface (Usuário autenticado na sessão do Supabase)
  let isUserAuth = false;
  if (!isVercelCron) {
    try {
      const auth = await getContextoAgencia();
      if (auth.ok) {
        isUserAuth = true;
      }
    } catch {
      // Ignora e faz fallback para verificacao
    }
  }

  // Se estiver em produção e não for nem Cron da Vercel nem usuário logado no app:
  if (process.env.NODE_ENV === 'production' && !isVercelCron && !isUserAuth) {
    return NextResponse.json({ error: 'Não autorizado. Faça login para sincronizar com o Notion.' }, { status: 401 });
  }

  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return NextResponse.json({ error: 'NOTION_API_KEY não configurada no servidor' }, { status: 400 });
    }

    // 1. Busca todos os clientes do GENSBot (colunas base garantidas)
    const { data: clientes, error: clientesErr } = await supabase
      .from('clientes')
      .select('id, agencia_id, nome');

    if (clientesErr) throw clientesErr;
    if (!clientes || clientes.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum cliente cadastrado no sistema.' });
    }

    // Tenta obter notion_database_id de forma resiliente caso a coluna exista no Supabase
    let clientesComDatabaseIdMap: Record<string, string> = {};
    try {
      const { data: clientesFull } = await supabase
        .from('clientes')
        .select('id, notion_database_id');
      if (clientesFull) {
        for (const c of clientesFull) {
          if (c.notion_database_id) {
            clientesComDatabaseIdMap[c.id] = c.notion_database_id;
          }
        }
      }
    } catch {
      // Ignora se a coluna opcional notion_database_id ainda não tiver sido criada no Supabase
    }

    // 2. Descobre todas as databases do Notion Workspace
    const discoveredDbs = await searchNotionDatabases();
    let targetDatabases: Array<{ clienteId: string; agenciaId: string; databaseId: string }> = [];

    // Mapeamento Inteligente:
    // A. Clientes com notion_database_id explicitamente configurado
    for (const c of clientes) {
      const dbId = clientesComDatabaseIdMap[c.id];
      if (dbId) {
        targetDatabases.push({
          clienteId: c.id,
          agenciaId: c.agencia_id,
          databaseId: dbId,
        });
      }
    }

    // B. Para databases descobertas no Notion, faz o matching estrito com o cliente
    for (const db of discoveredDbs) {
      if (targetDatabases.some((t) => t.databaseId === db.id)) continue; // Já incluído acima

      // Procura cliente cuja identidade/nome bata com o título da database
      const clienteCorrespondente = clientes.find((c) => correspondeClienteEnotionDb(c.nome, db.title));

      if (clienteCorrespondente) {
        targetDatabases.push({
          clienteId: clienteCorrespondente.id,
          agenciaId: clienteCorrespondente.agencia_id,
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

        // Se o briefing estiver vazio, busca blocos do corpo da página no Notion
        if (!demand.briefing || demand.briefing.trim().length === 0) {
          const bodyContent = await fetchNotionPageContent(page.id);
          if (bodyContent) {
            demand.briefing = bodyContent;
          }
        }

        // Prepara objeto dos arquivos no formato ArquivoConteudo[]
        const arquivos = demand.arquivosUrls.map((url, index) => ({
          id: `notion-file-${index}`,
          url,
          tipo: url.match(/\.(mp4|mov|webm)/i) ? 'video' : 'imagem',
          ordem: index,
        }));

        // Verifica se o item já existe por notion_page_id (ou por título + cliente_id)
        let existingId: string | null = null;
        try {
          const { data: existing } = await supabase
            .from('conteudo_items')
            .select('id')
            .eq('notion_page_id', demand.notionPageId)
            .maybeSingle();
          if (existing) existingId = existing.id;
        } catch {
          const { data: existingByTitle } = await supabase
            .from('conteudo_items')
            .select('id')
            .eq('cliente_id', dbInfo.clienteId)
            .eq('titulo', demand.titulo)
            .maybeSingle();
          if (existingByTitle) existingId = existingByTitle.id;
        }

        const payloadBase: any = {
          titulo: demand.titulo,
          tipo: demand.tipo,
          status: demand.status,
          legenda: demand.legenda,
          briefing: demand.briefing,
          arquivos: arquivos.length > 0 ? arquivos : undefined,
          atualizado_em: new Date().toISOString(),
        };

        if (existingId) {
          try {
            const { error: updErr } = await supabase
              .from('conteudo_items')
              .update({ ...payloadBase, notion_last_edited: demand.lastEditedTime })
              .eq('id', existingId);
            if (updErr) {
              await supabase.from('conteudo_items').update(payloadBase).eq('id', existingId);
            }
          } catch {
            await supabase.from('conteudo_items').update(payloadBase).eq('id', existingId);
          }
          totalUpdated++;
        } else {
          const insertBase: any = {
            agencia_id: dbInfo.agenciaId,
            cliente_id: dbInfo.clienteId,
            titulo: demand.titulo,
            tipo: demand.tipo,
            status: demand.status,
            legenda: demand.legenda,
            briefing: demand.briefing,
            mes_referencia: nowMonth,
            arquivos,
          };

          try {
            const { error: insErr } = await supabase.from('conteudo_items').insert({
              ...insertBase,
              notion_page_id: demand.notionPageId,
              notion_last_edited: demand.lastEditedTime,
            });
            if (insErr) {
              await supabase.from('conteudo_items').insert(insertBase);
            }
          } catch {
            await supabase.from('conteudo_items').insert(insertBase);
          }
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
