import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { garantirPipelinePadrao } from '@/lib/crm';

export const dynamic = 'force-dynamic';

export const LEADS_HUB_CENTRAL = [
  {
    titulo: 'Dr. Francisco Odílio de Melo e Dias - Cirurgia Plástica',
    nome_contato: 'Dr. Francisco Odílio de Melo e Dias',
    telefone: '+5583999090008',
    email: 'contato@franciscoodilio.com.br',
    empresa: 'Dr. Francisco Odílio Cirurgia Plástica',
    tipo_perfil: 'profissional' as const,
    cidade: 'João Pessoa',
    bairro: 'Cartaxo / Centro',
    nicho: 'Cirurgia Plástica',
    dor_principal: 'Site antigo estático; sem Meta Pixel; Google Analytics legado descontinuado (sem GA4)',
    url_site: 'http://www.franciscoodilio.com.br/',
    score_qualificacao: 8.5,
    valor: 4500,
    estagio_indice: 1, // 2. Abordagem Enviada
    tags: ['Eco Medical Center', 'Cirurgia Plástica', 'Score: 8.5', 'Tier A', 'João Pessoa'],
  },
  {
    titulo: 'Dra. Zuleika Andrade - Dermatologia',
    nome_contato: 'Dra. Zuleika Andrade',
    telefone: '+5583998009945',
    email: 'contato@zuleikaandrade.com.br',
    empresa: 'Dra. Zuleika Andrade Dermatologia',
    tipo_perfil: 'profissional' as const,
    cidade: 'João Pessoa',
    bairro: 'Cartaxo',
    nicho: 'Dermatologia',
    dor_principal: 'NÃO POSSUI rastreamento ativo de conversão (Meta Pixel/Google Tag); atendimento manual no WhatsApp',
    url_site: 'https://zuleikaandrade.com.br',
    score_qualificacao: 8.0,
    valor: 3500,
    estagio_indice: 2, // 3. Em Qualificação
    tags: ['Eco Medical Center', 'Dermatologia', 'Score: 8.0', 'Tier A', 'João Pessoa'],
  },
  {
    titulo: 'Dra. Larissa Wanderley - Dermatologia',
    nome_contato: 'Dra. Larissa Wanderley',
    telefone: '+5583998917353',
    email: null,
    empresa: 'Consultório Dra. Larissa Wanderley',
    tipo_perfil: 'profissional' as const,
    cidade: 'João Pessoa',
    bairro: 'Cartaxo',
    nicho: 'Dermatologia',
    dor_principal: 'NÃO TEM SITE PRÓPRIO (apenas Linktree); sem Pixel; sem Google Ads; link direto WhatsApp sem pré-qualificação',
    url_site: 'https://linktr.ee/dralarissawanderley',
    score_qualificacao: 7.5,
    valor: 3500,
    estagio_indice: 2, // 3. Em Qualificação
    tags: ['Eco Medical Center', 'Dermatologia', 'Score: 7.5', 'Tier B', 'João Pessoa'],
  },
  {
    titulo: 'CLINC - Clínica Integrada de Cardiologia',
    nome_contato: 'CLINC Cardiologia',
    telefone: '+558331910000',
    email: 'contato@clincpb.com.br',
    empresa: 'CLINC Cardiologia & Exames',
    tipo_perfil: 'empresa' as const,
    cidade: 'João Pessoa',
    bairro: 'Miramar / Eco Business',
    nicho: 'Cardiologia & Exames',
    dor_principal: 'Site institucional WordPress sem pixel de conversão ativo; sem Google Tag/conversões; atendimento sem IA',
    url_site: 'https://clincpb.com.br/',
    score_qualificacao: 8.0,
    valor: 5000,
    estagio_indice: 1, // 2. Abordagem Enviada
    tags: ['Eco Business Center', 'Cardiologia', 'Score: 8.0', 'Tier A', 'João Pessoa'],
  },
  {
    titulo: 'Clínica Kidscor - Cardiopediatria & Ecocardiografia Fetal',
    nome_contato: 'Equipe Kidscor',
    telefone: '+5583996733515',
    email: 'contato@kidscor.com.br',
    empresa: 'Clínica Kidscor',
    tipo_perfil: 'empresa' as const,
    cidade: 'João Pessoa',
    bairro: 'Cartaxo',
    nicho: 'Cardiopediatria & Exames',
    dor_principal: 'Site WordPress com layout estático; sem perfil institucional ativo; sem rastreamento de anúncios; sem GA4',
    url_site: 'https://www.kidscor.com.br',
    score_qualificacao: 7.8,
    valor: 4000,
    estagio_indice: 0, // 1. Minerado & Auditado
    tags: ['Eco Medical Center', 'Cardiopediatria', 'Score: 7.8', 'Tier B', 'João Pessoa'],
  },
  {
    titulo: 'Clínica Renovare - Especialidades Integradas',
    nome_contato: 'Recepção Clínica Renovare',
    telefone: '+5583991090619',
    email: null,
    empresa: 'Clínica Renovare',
    tipo_perfil: 'empresa' as const,
    cidade: 'João Pessoa',
    bairro: 'Cartaxo',
    nicho: 'Dermatologia & Cirurgia Vascular',
    dor_principal: 'Sem domínio próprio ativo (dependente de portais); presença diluída; recepção física e WhatsApp manual com fila',
    url_site: null,
    score_qualificacao: 7.5,
    valor: 4500,
    estagio_indice: 0, // 1. Minerado & Auditado
    tags: ['Eco Medical Center', 'Clínica Integrada', 'Score: 7.5', 'Tier B', 'João Pessoa'],
  },
  {
    titulo: 'Dra. Priscilla Kelly Soares Torres Brito - Vivapele',
    nome_contato: 'Dra. Priscilla Kelly Soares Torres Brito',
    telefone: '+5583998000000',
    email: null,
    empresa: 'Vivapele / Eco Medical Sul',
    tipo_perfil: 'profissional' as const,
    cidade: 'João Pessoa',
    bairro: 'Bancários',
    nicho: 'Dermatologia',
    dor_principal: 'Sem perfil profissional aberto indexado; sem site próprio (apenas Doctoralia); presença digital inexistente na Zona Sul',
    url_site: null,
    score_qualificacao: 7.0,
    valor: 3500,
    estagio_indice: 0, // 1. Minerado & Auditado
    tags: ['Eco Medical Sul', 'Dermatologia', 'Score: 7.0', 'Tier B', 'João Pessoa'],
  },
  {
    titulo: 'Dr. Ricardo Wanderley Queiroga - Cardiologia',
    nome_contato: 'Dr. Ricardo Wanderley Queiroga',
    telefone: '+558332213127',
    email: null,
    empresa: 'Cardio Medical PB',
    tipo_perfil: 'profissional' as const,
    cidade: 'João Pessoa',
    bairro: 'Cartaxo',
    nicho: 'Cardiologia',
    dor_principal: 'Apenas perfil institucional de terceiros; sem site pessoal de autoridade; agendamentos dispersos por secretárias',
    url_site: null,
    score_qualificacao: 7.5,
    valor: 3500,
    estagio_indice: 0, // 1. Minerado & Auditado
    tags: ['Eco Medical Center', 'Cardiologia', 'Score: 7.5', 'Tier B', 'João Pessoa'],
  },
];

export async function POST() {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro, user } = auth.ctx;

  try {
    const pipe = await garantirPipelinePadrao(membro.agencia_id, null);
    if (!pipe || !pipe.estagios || pipe.estagios.length === 0) {
      return respostaErro('Pipeline padrão não encontrado.', 400);
    }

    const estagios = pipe.estagios;
    let inseridos = 0;
    let pulados = 0;

    for (const lead of LEADS_HUB_CENTRAL) {
      // Verifica se já existe lead com mesmo telefone ou título
      const { data: existente } = await serviceSupabase
        .from('crm_negocios')
        .select('id')
        .eq('agencia_id', membro.agencia_id)
        .or(`titulo.eq."${lead.titulo}",nome_contato.eq."${lead.nome_contato}"`)
        .maybeSingle();

      if (existente) {
        pulados++;
        continue;
      }

      const estagioAlvo = estagios[lead.estagio_indice] || estagios[0];

      // Tenta inserir com colunas novas
      const payloadCompleto = {
        agencia_id: membro.agencia_id,
        cliente_id: null,
        pipeline_id: pipe.id,
        estagio_id: estagioAlvo.id,
        titulo: lead.titulo,
        nome_contato: lead.nome_contato,
        telefone: lead.telefone,
        email: lead.email,
        empresa: lead.empresa,
        tipo_perfil: lead.tipo_perfil,
        cidade: lead.cidade,
        bairro: lead.bairro,
        nicho: lead.nicho,
        dor_principal: lead.dor_principal,
        url_site: lead.url_site,
        score_qualificacao: lead.score_qualificacao,
        valor: lead.valor,
        origem: 'manual',
        prioridade: lead.score_qualificacao >= 8 ? 'alta' : 'media',
        responsavel_id: user.id || null,
        tags: lead.tags,
        status: 'aberto',
        ultimo_contato_em: new Date().toISOString(),
      };

      let { data: novoNegocio, error } = await serviceSupabase
        .from('crm_negocios')
        .insert(payloadCompleto)
        .select('id')
        .single();

      // Fallback se a tabela ainda não tiver as novas colunas
      if (error && (error.message.includes('column') || (error as any).code === '42703')) {
        const payloadFallback = {
          agencia_id: membro.agencia_id,
          cliente_id: null,
          pipeline_id: pipe.id,
          estagio_id: estagioAlvo.id,
          titulo: lead.titulo,
          nome_contato: lead.nome_contato,
          telefone: lead.telefone,
          email: lead.email,
          empresa: lead.empresa,
          valor: lead.valor,
          origem: 'manual',
          prioridade: lead.score_qualificacao >= 8 ? 'alta' : 'media',
          responsavel_id: user.id || null,
          tags: lead.tags,
          status: 'aberto',
          ultimo_contato_em: new Date().toISOString(),
        };

        const resFallback = await serviceSupabase
          .from('crm_negocios')
          .insert(payloadFallback)
          .select('id')
          .single();

        if (!resFallback.error && resFallback.data) {
          novoNegocio = resFallback.data;
          error = null;
        }
      }

      if (novoNegocio && !error) {
        inseridos++;
        await serviceSupabase.from('crm_atividades').insert({
          negocio_id: novoNegocio.id,
          agencia_id: membro.agencia_id,
          membro_id: user.id || null,
          tipo: 'criacao',
          descricao: `Prospect importado do Hub Central (Auditoria Técnica 360). Score: ${lead.score_qualificacao}/10. Gargalo: ${lead.dor_principal}`,
        });
      }
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `${inseridos} oportunidades importadas com sucesso (${pulados} já existiam).`,
      total_processados: LEADS_HUB_CENTRAL.length,
      inseridos,
      pulados,
    });
  } catch (err: any) {
    console.error('Erro ao importar prospecção do Hub Central:', err);
    return respostaErro('Falha interna ao importar leads do Hub Central.', 500);
  }
}
