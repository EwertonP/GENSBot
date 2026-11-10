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
    // 1. Busca dinamicamente o estágio "Novo Prospect" no pipeline de prospecção da agência
    const { data: estagio, error: erroEstagio } = await serviceSupabase
      .from('crm_estagios')
      .select('id, nome, ordem, pipeline_id')
      .eq('pipeline_id', PIPELINE_ID)
      .ilike('nome', 'Novo Prospect')
      .maybeSingle();

    if (erroEstagio || !estagio) {
      return NextResponse.json({
        erro: 'Estágio "Novo Prospect" não encontrado no pipeline.',
        detalhe: erroEstagio?.message
      }, { status: 404 });
    }

    let inseridos = 0;
    let atualizados = 0;
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

      // Verifica se já existe por telefone ou título exato
      const { data: existente } = await serviceSupabase
        .from('crm_negocios')
        .select('id, titulo, estagio_id')
        .eq('agencia_id', AGENCIA_ID)
        .eq('pipeline_id', PIPELINE_ID)
        .or(`telefone.ilike.%${telDigitos}%,titulo.eq."${lead.titulo.replace(/"/g, '')}"`)
        .maybeSingle();

      if (existente) {
        // Atualiza para garantir estágio Novo Prospect e dados ICP 360 completos
        const { error: erroUpd } = await serviceSupabase
          .from('crm_negocios')
          .update({
            estagio_id: estagio.id,
            status: 'aberto',
            valor: lead.valor,
            nome_contato: lead.nome_contato,
            telefone: lead.telefone,
            empresa: lead.empresa,
            tipo_perfil: lead.tipo_perfil,
            cidade: lead.cidade,
            bairro: lead.bairro,
            nicho: lead.nicho,
            dor_principal: lead.dor_principal,
            url_site: lead.url_site,
            score_qualificacao: lead.score_qualificacao,
            prioridade: lead.prioridade,
            tags: lead.tags,
            responsavel_id: RESPONSAVEL_ID,
            ordem_no_estagio: i + 1,
            ultimo_contato_em: new Date().toISOString()
          })
          .eq('id', existente.id);

        if (!erroUpd) {
          atualizados++;
          processados.push({ id: existente.id, titulo: lead.titulo, acao: 'atualizado', cidade: lead.cidade });
        }
      } else {
        // Insere novo registro completo na coluna Novo Prospect
        const { data: novo, error: erroIns } = await serviceSupabase
          .from('crm_negocios')
          .insert({
            agencia_id: AGENCIA_ID,
            pipeline_id: PIPELINE_ID,
            estagio_id: estagio.id,
            cliente_id: null, // Prospecção interna da agência
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
            tags: lead.tags,
            responsavel_id: RESPONSAVEL_ID,
            ordem_no_estagio: i + 1,
            ultimo_contato_em: new Date().toISOString()
          })
          .select('id, titulo')
          .single();

        if (!erroIns && novo) {
          inseridos++;
          processados.push({ id: novo.id, titulo: lead.titulo, acao: 'inserido', cidade: lead.cidade });

          // Registra a atividade inicial na timeline
          await serviceSupabase.from('crm_atividades').insert({
            negocio_id: novo.id,
            agencia_id: AGENCIA_ID,
            membro_id: RESPONSAVEL_ID,
            tipo: 'criacao',
            descricao: `Lead minerado e qualificado adicionado no estágio "Novo Prospect" — Score ${lead.score_qualificacao}/10 (Tier ${lead.tier}) — ICP ${lead.nicho} em ${lead.cidade}.`,
            dados_extras: {
              cidade: lead.cidade,
              nicho: lead.nicho,
              score: lead.score_qualificacao,
              tier: lead.tier,
              dor_principal: lead.dor_principal
            }
          });
        } else if (erroIns) {
          console.error(`Erro ao inserir lead ${lead.titulo}:`, erroIns);
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
        distribuicao_cidades: cidadesContagem
      },
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
  return processarImportacao(req);
}
