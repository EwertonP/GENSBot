import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { garantirPipelinePadrao } from '@/lib/crm';

// POST: Recebe leads de campanhas externas (Meta Ads, Webflow, Elementor, LPs)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      agencia_id: agenciaIdBody,
      cliente_id,
      pipeline_id: pipeIdBody,
      estagio_id: estagioIdBody,
      nome,
      nome_contato: nomeContatoBody,
      telefone,
      whatsapp,
      email,
      empresa,
      cargo,
      titulo: tituloBody,
      valor = 0,
      origem = 'webhook_ads',
      utm_source,
      utm_medium,
      utm_campaign,
      tags = [],
    } = body;

    const nomeLead = (nomeContatoBody || nome || '').trim();
    if (!nomeLead) {
      return NextResponse.json({ error: 'Nome do contato é obrigatório.' }, { status: 400 });
    }

    let agenciaId = agenciaIdBody;
    if (!agenciaId && cliente_id) {
      const { data: clienteRecord } = await serviceSupabase
        .from('clientes')
        .select('agencia_id')
        .eq('id', cliente_id)
        .maybeSingle();
      if (clienteRecord?.agencia_id) {
        agenciaId = clienteRecord.agencia_id;
      }
    }

    if (!agenciaId) {
      // Fallback para a agência principal cadastrada no sistema
      const { data: primeiraAgencia } = await serviceSupabase
        .from('agencias')
        .select('id')
        .limit(1)
        .maybeSingle();
      agenciaId = primeiraAgencia?.id || 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
    }

    const tel = (whatsapp || telefone || '').trim();

    // 1. Resolve o pipeline e estágio de destino
    let pipelineId = pipeIdBody;
    let estagioId = estagioIdBody;

    if (!pipelineId) {
      const pipePadrao = await garantirPipelinePadrao(agenciaId, cliente_id || null);
      if (pipePadrao) {
        pipelineId = pipePadrao.id;
        if (!estagioId && pipePadrao.estagios && pipePadrao.estagios.length > 0) {
          estagioId = pipePadrao.estagios[0].id;
        }
      }
    }

    if (!estagioId && pipelineId) {
      const { data: primeiroEstagio } = await serviceSupabase
        .from('crm_estagios')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle();
      estagioId = primeiroEstagio?.id;
    }

    if (!pipelineId || !estagioId) {
      return NextResponse.json({ error: 'Não foi possível resolver o pipeline ou estágio.' }, { status: 400 });
    }

    const tituloNegocio = (tituloBody || `Lead - ${nomeLead}`).trim();

    // 2. Cria o negócio no CRM
    const { data: negocio, error: negErr } = await serviceSupabase
      .from('crm_negocios')
      .insert({
        agencia_id: agenciaId,
        cliente_id: cliente_id || null,
        pipeline_id: pipelineId,
        estagio_id: estagioId,
        titulo: tituloNegocio,
        valor: Number(valor) || 0,
        status: 'aberto',
        nome_contato: nomeLead,
        telefone: tel || null,
        email: email ? email.trim().toLowerCase() : null,
        empresa: empresa ? empresa.trim() : null,
        cargo: cargo ? cargo.trim() : null,
        origem,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        prioridade: 'alta',
        tags: Array.isArray(tags) ? tags : ['Inbound Webhook'],
        ultimo_contato_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (negErr || !negocio) {
      console.error('Erro ao inserir negócio via webhook:', negErr);
      return NextResponse.json({ error: negErr?.message || 'Erro ao criar negócio.' }, { status: 500 });
    }

    // 3. Registra na timeline
    await serviceSupabase.from('crm_atividades').insert({
      negocio_id: negocio.id,
      agencia_id: agenciaId,
      tipo: 'criacao',
      descricao: `Lead recebido automaticamente via ${origem}`,
      dados_extras: { utm_source, utm_campaign, telefone: tel, email },
    });

    return NextResponse.json({ ok: true, negocioId: negocio.id }, { status: 201 });
  } catch (err: any) {
    console.error('Erro no webhook de entrada do CRM:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
