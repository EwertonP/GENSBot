import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { garantirPipelinePadrao, normalizarWhatsApp } from '@/lib/crm';
import { segredoConfere } from '@/lib/segredos';

// POST: recebe o formulário de pré-qualificação do Typebot (bloco HTTP Request) e vira lead no CRM.
// Separado de /api/crm/inbound/webhook (sem senha, usado por anúncios) para não quebrar quem já o chama.
// Cabeçalho obrigatório: x-gens-secret (ou Authorization: Bearer) igual a CRM_INBOUND_TYPEBOT_SECRET.
// O Typebot guarda tudo como texto, por isso todos os campos chegam como string.

const texto = (v: unknown, max = 1000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  const esperado = process.env.CRM_INBOUND_TYPEBOT_SECRET;
  if (!esperado) return NextResponse.json({ error: 'CRM_INBOUND_TYPEBOT_SECRET não configurado' }, { status: 503 });
  const recebido = req.headers.get('x-gens-secret') || req.headers.get('authorization');
  if (!segredoConfere(recebido, esperado)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nome = texto(body.nome, 200);
  const tel = normalizarWhatsApp(texto(body.whatsapp || body.telefone, 40));
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (tel.length < 12) return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 });

  const q = {
    dor: texto(body.dor),
    nicho: texto(body.nicho, 200),
    faturamento: texto(body.faturamento, 200),
    investimento: texto(body.investimento, 200),
    como_conheceu: texto(body.como_conheceu, 200),
    servico: texto(body.servico, 200),
    tempo_empresa: texto(body.tempo_empresa, 200),
    tamanho_empresa: texto(body.tamanho_empresa, 200),
    experiencia: texto(body.experiencia, 200),
    instagram: texto(body.instagram, 200),
    site: texto(body.site, 300),
  };
  const nota = [
    'Pré-qualificação (Typebot)',
    q.dor && `Dor: ${q.dor}`,
    q.nicho && `Nicho: ${q.nicho}`,
    q.faturamento && `Faturamento: ${q.faturamento}`,
    q.investimento && `Quer investir: ${q.investimento}`,
    q.como_conheceu && `Conheceu por: ${q.como_conheceu}`,
    q.servico && `Serviço: ${q.servico}`,
    q.tempo_empresa && `Tempo da empresa: ${q.tempo_empresa}`,
    q.tamanho_empresa && `Tamanho da empresa: ${q.tamanho_empresa}`,
    q.experiencia && `Já trabalhou com agência: ${q.experiencia}`,
    q.instagram && `Instagram: ${q.instagram}`,
    q.site && `Site: ${q.site}`,
  ].filter(Boolean).join('\n');
  const utm = { utm_source: texto(body.utm_source, 200), utm_medium: texto(body.utm_medium, 200), utm_campaign: texto(body.utm_campaign, 200) };
  const extras = { fonte: 'typebot', qualificacao: q, ...utm, result_id: texto(body.result_id, 100) || null };

  try {
    let agenciaId = process.env.CRM_INBOUND_AGENCIA_ID || '';
    if (!agenciaId) {
      const { data: ag } = await supabase.from('agencias').select('id').limit(1).maybeSingle();
      agenciaId = ag?.id || '';
    }
    if (!agenciaId) return NextResponse.json({ error: 'Agência não encontrada.' }, { status: 500 });

    // Mesmo telefone (com ou sem DDI 55) em negócio aberto: atualiza em vez de duplicar.
    const variantes = [tel, tel.startsWith('55') ? tel.slice(2) : tel];
    const { data: existentes } = await supabase
      .from('crm_negocios')
      .select('id, tags')
      .eq('agencia_id', agenciaId)
      .eq('status', 'aberto')
      .in('telefone', variantes)
      .order('criado_em', { ascending: false })
      .limit(1);
    const existente = existentes?.[0];

    if (existente) {
      const tags = Array.from(new Set([...(existente.tags || []), 'Typebot']));
      await supabase.from('crm_negocios').update({ tags, ultimo_contato_em: new Date().toISOString() }).eq('id', existente.id);
      await supabase.from('crm_atividades').insert({ negocio_id: existente.id, agencia_id: agenciaId, tipo: 'nota', descricao: nota, dados_extras: extras });
      return NextResponse.json({ ok: true, negocioId: existente.id, duplicado: true }, { status: 200 });
    }

    const pipe = await garantirPipelinePadrao(agenciaId, null);
    const estagioId = pipe?.estagios?.[0]?.id;
    if (!pipe || !estagioId) return NextResponse.json({ error: 'Não foi possível resolver o pipeline ou estágio.' }, { status: 500 });

    const tags = ['Typebot', ...(q.nicho ? [`Nicho: ${q.nicho.slice(0, 40)}`] : [])];
    const { data: negocio, error } = await supabase
      .from('crm_negocios')
      .insert({
        agencia_id: agenciaId,
        pipeline_id: pipe.id,
        estagio_id: estagioId,
        titulo: `Lead Typebot - ${nome}`.slice(0, 200),
        status: 'aberto',
        nome_contato: nome,
        telefone: tel,
        email: texto(body.email, 200).toLowerCase() || null,
        empresa: texto(body.empresa, 200) || null,
        instagram_username: q.instagram.replace(/^@/, '').slice(0, 100) || null,
        origem: 'site',
        utm_source: utm.utm_source || null,
        utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null,
        prioridade: 'alta',
        tags,
        ultimo_contato_em: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !negocio) return NextResponse.json({ error: error?.message || 'Erro ao criar negócio.' }, { status: 500 });

    await supabase.from('crm_atividades').insert([
      { negocio_id: negocio.id, agencia_id: agenciaId, tipo: 'criacao', descricao: 'Lead recebido do formulário Typebot', dados_extras: extras },
      { negocio_id: negocio.id, agencia_id: agenciaId, tipo: 'nota', descricao: nota, dados_extras: extras },
    ]);
    return NextResponse.json({ ok: true, negocioId: negocio.id, duplicado: false }, { status: 201 });
  } catch (err) {
    console.error('Erro no webhook do Typebot:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
