import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { LEADS_60_DATASET } from '@/lib/leads-60-dataset';

const PIPELINE_ID = '6c88940b-a0f3-4569-a285-6cadc922eee3';
const AGENCIA_ID = 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
const RESPONSAVEL_ID = '62bdb1bc-84de-4688-a560-7a4deb75a2be';
const IMPORT_KEY = 'gensbot-import-60-leads-2026';

async function processarImportacao(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyParam = searchParams.get('key');
  const keyHeader = req.headers.get('x-import-key');

  if (keyParam !== IMPORT_KEY && keyHeader !== IMPORT_KEY) {
    return NextResponse.json({ erro: 'Não autorizado. Chave de importação inválida.' }, { status: 401 });
  }

  try {
    // 1. Busca dinamicamente o estágio "A Iniciar" no pipeline de prospecção da agência
    let { data: estagio, error: erroEstagio } = await serviceSupabase
      .from('crm_estagios')
      .select('id, nome, ordem, pipeline_id')
      .eq('pipeline_id', PIPELINE_ID)
      .ilike('nome', '%A Iniciar%')
      .maybeSingle();

    if (!estagio) {
      const { data: estagioFallback, error: erroFallback } = await serviceSupabase
        .from('crm_estagios')
        .select('id, nome, ordem, pipeline_id')
        .eq('pipeline_id', PIPELINE_ID)
        .ilike('nome', '%Novo Prospect%')
        .maybeSingle();

      estagio = estagioFallback;
      if (erroFallback) erroEstagio = erroFallback;
    }

    if (!estagio) {
      return NextResponse.json({
        erro: 'Estágio de entrada ("A Iniciar" / "Novo Prospect") não encontrado no pipeline.',
        detalhe: erroEstagio?.message
      }, { status: 404 });
    }

    let inseridos = 0;
    let atualizados = 0;
    const erros: any[] = [];
    const cidadesContagem: Record<string, number> = {
      'João Pessoa': 0,
      'Campina Grande': 0,
      'Recife': 0
    };
    const processados: any[] = [];

    // 2. Itera sobre os 60 leads minerados e qualificados
    for (let i = 0; i < LEADS_60_DATASET.length; i++) {
      const lead = LEADS_60_DATASET[i];
      cidadesContagem[lead.cidade] = (cidadesContagem[lead.cidade] || 0) + 1;

      // Normaliza telefone para busca e armazenamento
      const telDigitos = lead.telefone.replace(/\D/g, '');

      // Verifica se já existe por título exato ou pelos últimos 8 dígitos do telefone
      let { data: existente } = await serviceSupabase
        .from('crm_negocios')
        .select('id, titulo, estagio_id')
        .eq('agencia_id', AGENCIA_ID)
        .eq('pipeline_id', PIPELINE_ID)
        .eq('titulo', lead.titulo)
        .maybeSingle();

      if (!existente && telDigitos.length >= 8) {
        const { data: existenteTel } = await serviceSupabase
          .from('crm_negocios')
          .select('id, titulo, estagio_id')
          .eq('agencia_id', AGENCIA_ID)
          .eq('pipeline_id', PIPELINE_ID)
          .ilike('telefone', `%${telDigitos.slice(-8)}%`)
          .maybeSingle();
        existente = existenteTel;
      }

      const tagsCompletas = Array.from(new Set([
        ...(lead.tags || []),
        `cidade:${lead.cidade}`,
        `bairro:${lead.bairro}`,
        `nicho:${lead.nicho}`,
        `score:${lead.score_qualificacao}`,
        `tier:${lead.tier}`,
        `perfil:${lead.tipo_perfil}`
      ]));

      const payloadCompleto = {
        agencia_id: AGENCIA_ID,
        pipeline_id: PIPELINE_ID,
        estagio_id: estagio.id,
        cliente_id: null,
        titulo: lead.titulo,
        valor: lead.valor,
        status: 'aberto',
        nome_contato: lead.nome_contato,
        telefone: lead.telefone,
        email: lead.email,
        empresa: lead.empresa,
        cargo: lead.tipo_perfil === 'profissional' ? 'Especialista / Titular' : 'Diretoria / Gestão',
        tipo_perfil: lead.tipo_perfil,
        cidade: lead.cidade,
        bairro: lead.bairro,
        nicho: lead.nicho,
        dor_principal: lead.dor_principal,
        url_site: lead.url_site,
        score_qualificacao: lead.score_qualificacao,
        origem: 'manual',
        prioridade: lead.prioridade,
        tags: tagsCompletas,
        responsavel_id: RESPONSAVEL_ID,
        ordem_no_estagio: i + 1,
        ultimo_contato_em: new Date().toISOString()
      };

      const payloadBase = {
        agencia_id: AGENCIA_ID,
        pipeline_id: PIPELINE_ID,
        estagio_id: estagio.id,
        cliente_id: null,
        titulo: lead.titulo,
        valor: lead.valor,
        status: 'aberto',
        nome_contato: lead.nome_contato,
        telefone: lead.telefone,
        email: lead.email,
        empresa: lead.empresa,
        cargo: lead.tipo_perfil === 'profissional' ? 'Especialista / Titular' : 'Diretoria / Gestão',
        origem: 'manual',
        prioridade: lead.prioridade,
        tags: tagsCompletas,
        responsavel_id: RESPONSAVEL_ID,
        ordem_no_estagio: i + 1,
        ultimo_contato_em: new Date().toISOString()
      };

      if (existente) {
        // Tenta atualizar com colunas específicas
        let { error: erroUpd } = await serviceSupabase
          .from('crm_negocios')
          .update(payloadCompleto)
          .eq('id', existente.id);

        // Se falhar por coluna ausente no Postgres, usa payloadBase com dados em tags
        if (erroUpd && (erroUpd.message?.includes('column') || (erroUpd as any).code === '42703')) {
          const resRetry = await serviceSupabase
            .from('crm_negocios')
            .update(payloadBase)
            .eq('id', existente.id);
          erroUpd = resRetry.error;
        }

        if (!erroUpd) {
          atualizados++;
          processados.push({ id: existente.id, titulo: lead.titulo, acao: 'atualizado', cidade: lead.cidade });
        } else {
          erros.push({ lead: lead.titulo, operacao: 'update', erro: erroUpd });
        }
      } else {
        // Tenta inserir com colunas dedicadas
        let { data: novo, error: erroIns } = await serviceSupabase
          .from('crm_negocios')
          .insert(payloadCompleto)
          .select('id, titulo')
          .single();

        // Fallback se colunas dedicadas não estiverem migradas no banco
        if (erroIns && (erroIns.message?.includes('column') || (erroIns as any).code === '42703')) {
          const resRetry = await serviceSupabase
            .from('crm_negocios')
            .insert(payloadBase)
            .select('id, titulo')
            .single();
          novo = resRetry.data;
          erroIns = resRetry.error;
        }

        if (!erroIns && novo) {
          inseridos++;
          processados.push({ id: novo.id, titulo: lead.titulo, acao: 'inserido', cidade: lead.cidade });

          // Registra a atividade completa com histórico e diagnóstico na timeline
          await serviceSupabase.from('crm_atividades').insert({
            negocio_id: novo.id,
            agencia_id: AGENCIA_ID,
            membro_id: RESPONSAVEL_ID,
            tipo: 'criacao',
            descricao: `Lead minerado e qualificado adicionado no estágio "${estagio.nome}"\n\n• Contato: ${lead.nome_contato}\n• Empresa: ${lead.empresa}\n• Nicho: ${lead.nicho} | ${lead.cidade} (${lead.bairro})\n• Score ICP: ${lead.score_qualificacao}/10 (Tier ${lead.tier})\n• Site: ${lead.url_site}\n• Diagnóstico Técnico / Dor: ${lead.dor_principal}\n• WhatsApp: https://wa.me/${telDigitos}`,
            dados_extras: {
              cidade: lead.cidade,
              bairro: lead.bairro,
              nicho: lead.nicho,
              score: lead.score_qualificacao,
              tier: lead.tier,
              dor_principal: lead.dor_principal,
              url_site: lead.url_site,
              tipo_perfil: lead.tipo_perfil
            }
          });
        } else {
          erros.push({ lead: lead.titulo, operacao: 'insert', erro: erroIns });
        }
      }
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `${LEADS_60_DATASET.length} leads processados com sucesso no estágio "${estagio.nome}".`,
      estagio_destino: {
        id: estagio.id,
        nome: estagio.nome,
        ordem: estagio.ordem
      },
      metricas: {
        total_esperado: LEADS_60_DATASET.length,
        inseridos,
        atualizados,
        total_processados: inseridos + atualizados,
        total_erros: erros.length,
        distribuicao_cidades: cidadesContagem
      },
      erros: erros.length > 0 ? erros : undefined,
      detalhes: processados
    });
  } catch (err: any) {
    console.error('Falha interna ao importar 60 leads:', err);
    return NextResponse.json({ erro: 'Erro interno ao importar leads.', detalhe: err?.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return processarImportacao(req);
}

export async function POST(req: Request) {

    const bodyText = await req.text();
    let body: any = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}

    if (body.action === "delete") {
      const ids = body.ids || [];
      await serviceSupabase.from("crm_atividades").delete().in("negocio_id", ids);
      const { data: deletados, error } = await serviceSupabase
        .from("crm_negocios")
        .delete()
        .in("id", ids)
        .select("id, titulo");
      if (error) {
        return NextResponse.json({ erro: error.message }, { status: 500 });
      }
      return NextResponse.json({ sucesso: true, total: deletados?.length || 0, deletados });
    }

  return processarImportacao(req);
}


export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (key !== IMPORT_KEY) {
      return NextResponse.json({ erro: "Chave inválida" }, { status: 401 });
    }

    const body = await req.json();
    const ids = body.ids || [];
    if (!ids.length) {
      return NextResponse.json({ erro: "Nenhum ID fornecido" }, { status: 400 });
    }

    await serviceSupabase.from("crm_atividades").delete().in("negocio_id", ids);
    const { data: deletados, error } = await serviceSupabase
      .from("crm_negocios")
      .delete()
      .in("id", ids)
      .select("id, titulo");

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ sucesso: true, total: deletados?.length || 0, deletados });
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 });
  }
}
