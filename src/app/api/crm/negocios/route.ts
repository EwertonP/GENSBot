import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
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
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get('pipeline_id');
  const clienteId = searchParams.get('cliente_id');
  const status = searchParams.get('status') || 'aberto';
  const responsavelId = searchParams.get('responsavel_id');
  const busca = searchParams.get('busca');

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

    const cleanInsta = instagram_username ? instagram_username.replace(/^@/, '').trim() : null;

    const { data: negocio, error } = await serviceSupabase
      .from('crm_negocios')
      .insert({
        agencia_id: membro.agencia_id,
        cliente_id: cliente_id || null,
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
        tags: Array.isArray(tags) ? tags : [],
        responsavel_id: responsavel_id || user.id,
        previsao_fechamento: previsao_fechamento || null,
        probabilidade: probabilidade ? Number(probabilidade) : null,
        ultimo_contato_em: new Date().toISOString(),
      })
      .select(SELECT_NEGOCIO)
      .single();

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
