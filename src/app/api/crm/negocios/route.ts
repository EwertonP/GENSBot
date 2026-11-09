import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

const SELECT_NEGOCIO = `
  *,
  responsavel:membros!responsavel_id(id, nome, email, cargo),
  estagio:crm_estagios!estagio_id(id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado),
  cliente:clientes!cliente_id(id, nome, cor)
`;

// GET: Lista os negócios/oportunidades com filtros
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get('pipeline_id');
  let clienteId = searchParams.get('cliente_id');
  const status = searchParams.get('status') || 'aberto';
  const responsavelId = searchParams.get('responsavel_id');
  const busca = searchParams.get('busca');
  const cidade = searchParams.get('cidade');
  const nicho = searchParams.get('nicho');
  const tier = searchParams.get('tier');
  const scoreMinimo = searchParams.get('score_minimo');

  // Isolamento estrito para usuários com perfil de cliente/secretária
  if (membro.papel === 'cliente') {
    if (!membro.cliente_id) {
      return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
    }
    clienteId = membro.cliente_id;
  }

  try {
    let query = serviceSupabase
      .from('crm_negocios')
      .select(SELECT_NEGOCIO)
      .eq('agencia_id', membro.agencia_id)
      .order('ordem_no_estagio', { ascending: true })
      .order('criado_em', { ascending: false });

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId);
    }

    if (clienteId && clienteId !== 'all') {
      if (clienteId === 'agencia' || clienteId === 'null') {
        query = query.is('cliente_id', null);
      } else {
        query = query.eq('cliente_id', clienteId);
      }
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (responsavelId && responsavelId !== 'all') {
      query = query.eq('responsavel_id', responsavelId);
    }

    if (cidade && cidade.trim()) {
      query = query.ilike('cidade', `%${cidade.trim()}%`);
    }

    if (nicho && nicho.trim()) {
      query = query.ilike('nicho', `%${nicho.trim()}%`);
    }

    if (scoreMinimo !== null && scoreMinimo !== '' && !isNaN(Number(scoreMinimo))) {
      query = query.gte('score_qualificacao', Number(scoreMinimo));
    }

    if (tier && tier !== 'all') {
      if (tier === 'A') {
        query = query.gte('score_qualificacao', 8.0);
      } else if (tier === 'B') {
        query = query.gte('score_qualificacao', 5.0).lt('score_qualificacao', 8.0);
      } else if (tier === 'C') {
        query = query.lt('score_qualificacao', 5.0);
      }
    }

    if (busca && busca.trim()) {
      const termo = busca.trim().replace(/[%,()*\\]/g, ' ');
      query = query.or(
        `titulo.ilike.%${termo}%,nome_contato.ilike.%${termo}%,empresa.ilike.%${termo}%,instagram_username.ilike.%${termo}%,email.ilike.%${termo}%,telefone.ilike.%${termo}%`
      );
    }

    const { data, error } = await query;
    if (error) return traduzirErroBanco(error, 'GET /api/crm/negocios');

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Erro ao listar negócios:', err);
    return respostaErro('Falha interna ao carregar negócios.', 500);
  }
}

// POST: Cria um novo negócio e registra a atividade de criação
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { user, membro } = auth.ctx;

  try {
    const body = await req.json();
    const {
      pipeline_id,
      estagio_id: estagioIdInformado,
      cliente_id,
      titulo,
      valor = 0,
      nome_contato: nomeContatoRaw,
      contato_nome,
      telefone: telefoneRaw,
      contato_whatsapp,
      email: emailRaw,
      contato_email,
      instagram_username,
      empresa: empresaRaw,
      empresa_nome,
      cargo,
      tipo_perfil,
      cidade,
      bairro,
      nicho,
      dor_principal,
      url_site,
      score_qualificacao,
      data_proximo_followup,
      origem = 'manual',
      prioridade = 'media',
      tags = [],
      responsavel_id,
      previsao_fechamento,
      probabilidade,
      descricao,
    } = body;

    const nomeContatoFinal = (nomeContatoRaw || contato_nome || '').trim();
    const telefoneFinal = (telefoneRaw || contato_whatsapp || '').trim();
    const emailFinal = (emailRaw || contato_email || '').trim().toLowerCase();
    const empresaFinal = (empresaRaw || empresa_nome || '').trim();

    if (!pipeline_id) {
      return respostaErro('O pipeline_id é obrigatório.', 400);
    }
    if (!titulo?.trim()) {
      return respostaErro('O título do negócio é obrigatório.', 400);
    }
    if (!nomeContatoFinal) {
      return respostaErro('O nome do contato é obrigatório.', 400);
    }

    // Se não informou o estágio, usa o primeiro estágio do pipeline
    let estagioId = estagioIdInformado;
    if (!estagioId) {
      const { data: primeiroEstagio } = await serviceSupabase
        .from('crm_estagios')
        .select('id')
        .eq('pipeline_id', pipeline_id)
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!primeiroEstagio) {
        return respostaErro('Pipeline não possui estágios configurados.', 400);
      }
      estagioId = primeiroEstagio.id;
    }

    let clienteIdFinal = cliente_id;
    if (membro.papel === 'cliente') {
      if (!membro.cliente_id) {
        return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
      }
      clienteIdFinal = membro.cliente_id;
    }

    const cleanInsta = instagram_username ? instagram_username.replace(/^@/, '').trim() : null;

    let { data: negocio, error } = await serviceSupabase
      .from('crm_negocios')
      .insert({
        agencia_id: membro.agencia_id,
        cliente_id: clienteIdFinal || null,
        pipeline_id,
        estagio_id: estagioId,
        titulo: titulo.trim(),
        valor: Number(valor) || 0,
        status: 'aberto',
        nome_contato: nomeContatoFinal,
        telefone: telefoneFinal || null,
        email: emailFinal || null,
        instagram_username: cleanInsta,
        empresa: empresaFinal || null,
        cargo: cargo ? cargo.trim() : null,
        tipo_perfil: tipo_perfil || null,
        cidade: cidade ? String(cidade).trim() : null,
        bairro: bairro ? String(bairro).trim() : null,
        nicho: nicho ? String(nicho).trim() : null,
        dor_principal: dor_principal ? String(dor_principal).trim() : null,
        url_site: url_site ? String(url_site).trim() : null,
        score_qualificacao: score_qualificacao !== undefined && score_qualificacao !== null && !isNaN(Number(score_qualificacao)) ? Number(score_qualificacao) : null,
        data_proximo_followup: data_proximo_followup ? String(data_proximo_followup) : null,
        origem,
        prioridade,
        tags: Array.isArray(tags) ? tags : [],
        responsavel_id: responsavel_id || user.id,
        previsao_fechamento: previsao_fechamento || null,
        probabilidade: probabilidade ? Number(probabilidade) : null,
        ultimo_contato_em: new Date().toISOString(),
      })
      .select(SELECT_NEGOCIO)
      .single();

    // Fallback gracioso se a migration ainda não foi rodada no banco
    if (error && (error.message.includes('column') || (error as any).code === '42703')) {
      const tagsExtras: string[] = Array.isArray(tags) ? [...tags] : [];
      if (cidade) tagsExtras.push(`cidade:${cidade}`);
      if (nicho) tagsExtras.push(`nicho:${nicho}`);
      if (score_qualificacao !== undefined && score_qualificacao !== null) tagsExtras.push(`score:${score_qualificacao}`);
      if (tipo_perfil) tagsExtras.push(`perfil:${tipo_perfil}`);

      const retry = await serviceSupabase
        .from('crm_negocios')
        .insert({
          agencia_id: membro.agencia_id,
          cliente_id: clienteIdFinal || null,
          pipeline_id,
          estagio_id: estagioId,
          titulo: titulo.trim(),
          valor: Number(valor) || 0,
          status: 'aberto',
          nome_contato: nomeContatoFinal,
          telefone: telefoneFinal || null,
          email: emailFinal || null,
          instagram_username: cleanInsta,
          empresa: empresaFinal || null,
          cargo: cargo ? cargo.trim() : null,
          origem,
          prioridade,
          tags: tagsExtras,
          responsavel_id: responsavel_id || user.id,
          previsao_fechamento: previsao_fechamento || null,
          probabilidade: probabilidade ? Number(probabilidade) : null,
          ultimo_contato_em: new Date().toISOString(),
        })
        .select(SELECT_NEGOCIO)
        .single();

      if (!retry.error && retry.data) {
        negocio = retry.data;
        error = null;
      }
    }

    if (error || !negocio) {
      return traduzirErroBanco(error || { message: 'Falha ao criar negócio' }, 'POST /api/crm/negocios');
    }

    // Registra a atividade cronológica inicial
    await serviceSupabase.from('crm_atividades').insert({
      negocio_id: negocio.id,
      agencia_id: membro.agencia_id,
      membro_id: user.id,
      tipo: 'criacao',
      descricao: `Oportunidade criada na etapa "${negocio.estagio?.nome || 'Inicial'}"${descricao ? ` — Detalhes: ${descricao}` : ''}`,
      dados_extras: { valor: negocio.valor, origem: negocio.origem },
    });

    // Retorna com retrocompatibilidade tanto para quem lê objeto direto quanto data.negocio
    return NextResponse.json({ ...negocio, negocio }, { status: 201 });
  } catch (err: any) {
    console.error('Erro ao criar negócio:', err);
    return respostaErro('Falha interna ao criar oportunidade.', 500);
  }
}
