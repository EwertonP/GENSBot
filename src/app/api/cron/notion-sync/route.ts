import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { queryNotionDatabase, mapNotionPageToDemand, correspondeClienteEnotionDb, clienteLabelBate, fetchNotionPageContent, splitEstruturaELegenda } from '@/lib/notion';
import { getContextoAgencia } from '@/lib/clientes-server';

// Plano Hobby da Vercel: teto de execução de função serverless. Igual aos outros crons do projeto
// (drain, publish-scheduled, instagram/publish).
export const maxDuration = 60;

// Quantas páginas no máximo buscam o corpo completo (Notion) numa única execução. Com dezenas de
// páginas na base única do Hub, buscar todas de uma vez estoura o teto de 60s da Vercel. O que sobrar
// fica pra próxima execução do cron (1x por dia) ou pro próximo clique manual em "Sincronizar".
const LIMITE_BUSCAS_DETALHADAS_POR_EXECUCAO = 60;

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

    // 1. Busca todos os clientes do GENSBot, com notion_database_id/notion_cliente_label se existirem
    let clientes: Array<{ id: string; agencia_id: string; nome: string; notion_database_id?: string | null; notion_cliente_label?: string | null }> = [];
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, agencia_id, nome, notion_database_id, notion_cliente_label');
      if (error) throw error;
      clientes = data || [];
    } catch {
      // Fallback resiliente caso as colunas opcionais ainda não existam no Supabase
      const { data, error: baseErr } = await supabase.from('clientes').select('id, agencia_id, nome');
      if (baseErr) throw baseErr;
      clientes = data || [];
    }

    if (clientes.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum cliente cadastrado no sistema.' });
    }

    // 2. Base única do Notion ("🗂️ Pipeline + Calendário Editorial" no Hub Central): todos os clientes
    // compartilham a mesma database, distinguidos pela coluna "Cliente" de cada página.
    // Dedup: normalmente todo cliente aponta pro mesmo notion_database_id, mas o código aceita
    // configurações diferentes por cliente sem quebrar (ex.: um cliente com base própria à parte).
    const databaseIds = Array.from(
      new Set(clientes.map((c) => c.notion_database_id).filter((id): id is string => Boolean(id)))
    );

    if (databaseIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum cliente com notion_database_id configurado. Nada para sincronizar.',
      });
    }

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalUnmapped = 0;
    let totalSemMudanca = 0;
    let totalAdiadoPraProximaExecucao = 0;
    let buscasDetalhadasFeitas = 0;
    const unmappedLabels = new Set<string>();

    for (const databaseId of databaseIds) {
      const pages = await queryNotionDatabase(databaseId);
      const nowMonth = new Date().toISOString().substring(0, 7) + '-01';

      for (const page of pages) {
        totalSynced++;
        const demand = mapNotionPageToDemand(page);

        // Resolve o cliente dono da página pela coluna "Cliente" (match exato com notion_cliente_label,
        // com fallback pro matching por nome só pra manter compatibilidade com configurações antigas).
        const clienteMatch =
          clientes.find((c) => clienteLabelBate(c.notion_cliente_label, demand.clienteLabel)) ||
          (demand.clienteLabel ? clientes.find((c) => correspondeClienteEnotionDb(c.nome, demand.clienteLabel)) : undefined);

        if (!clienteMatch) {
          totalUnmapped++;
          if (demand.clienteLabel) unmappedLabels.add(demand.clienteLabel);
          continue; // Não grava demanda sem cliente identificado com segurança.
        }

        // Verifica se o item já existe por notion_page_id (ou por título + cliente_id)
        let existingId: string | null = null;
        let existingLastEdited: string | null = null;
        try {
          const { data: existing } = await supabase
            .from('conteudo_items')
            .select('id, notion_last_edited')
            .eq('notion_page_id', demand.notionPageId)
            .maybeSingle();
          if (existing) {
            existingId = existing.id;
            existingLastEdited = existing.notion_last_edited;
          }
        } catch {
          const { data: existingByTitle } = await supabase
            .from('conteudo_items')
            .select('id')
            .eq('cliente_id', clienteMatch.id)
            .eq('titulo', demand.titulo)
            .maybeSingle();
          if (existingByTitle) existingId = existingByTitle.id;
        }

        // Página já sincronizada e sem edição desde a última vez: pula, sem gastar chamada na API do Notion.
        if (existingId && existingLastEdited && existingLastEdited === demand.lastEditedTime) {
          totalSemMudanca++;
          continue;
        }

        // Item novo ou mudou desde o último sync: respeita o teto de buscas detalhadas por execução,
        // pra não estourar o tempo máximo da função na Vercel. O que sobrar é pego na próxima execução.
        if (buscasDetalhadasFeitas >= LIMITE_BUSCAS_DETALHADAS_POR_EXECUCAO) {
          totalAdiadoPraProximaExecucao++;
          continue;
        }

        // Busca o corpo da página (onde vive a estrutura "Cena 1 / Cena 2..." e a "Legenda (pronta pra postar)")
        // e mescla com o que já veio das propriedades da tabela.
        // Pequena pausa entre requisições: sem espaçamento o sync estoura o limite de taxa (~3 req/s) do Notion.
        if (buscasDetalhadasFeitas > 0) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        buscasDetalhadasFeitas++;
        const bodyContent = await fetchNotionPageContent(page.id);
        if (bodyContent) {
          const { estrutura, legendaPronta } = splitEstruturaELegenda(bodyContent);
          if (estrutura) {
            demand.briefing = demand.briefing ? `${demand.briefing}\n\n${estrutura}` : estrutura;
          }
          if (legendaPronta && !demand.legenda) {
            demand.legenda = legendaPronta;
          }
        }

        // Prepara objeto dos arquivos no formato ArquivoConteudo[]
        const arquivos = demand.arquivosUrls.map((url, index) => ({
          id: `notion-file-${index}`,
          url,
          tipo: url.match(/\.(mp4|mov|webm)/i) ? 'video' : 'imagem',
          ordem: index,
        }));

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
            agencia_id: clienteMatch.agencia_id,
            cliente_id: clienteMatch.id,
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
      databasesScanned: databaseIds.length,
      totalSynced,
      totalCreated,
      totalUpdated,
      totalSemMudanca,
      totalUnmapped,
      unmappedLabels: Array.from(unmappedLabels),
      totalAdiadoPraProximaExecucao,
      mensagem:
        totalAdiadoPraProximaExecucao > 0
          ? `${totalAdiadoPraProximaExecucao} página(s) ficaram pra próxima sincronização (limite de ${LIMITE_BUSCAS_DETALHADAS_POR_EXECUCAO} buscas detalhadas por execução, pra não estourar o tempo da Vercel). Clique em Sincronizar de novo pra pegar o resto agora, ou espere o cron automático (roda 1x por dia, 12h UTC).`
          : undefined,
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
