import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { gerarTokenPublico } from '@/lib/documentos-modelos';
import { respostaErro } from '@/lib/clientes-server';

export async function GET(req: Request) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const clienteId = searchParams.get('cliente_id');
  const busca = searchParams.get('busca');
  const filtro = searchParams.get('filtro'); // 'renovando' | 'vencidos'

  try {
    let query = db
      .from('contratos')
      .select(`
        id, agencia_id, proposta_id, modelo_id, cliente_id, lead_id, titulo, status,
        valor_mensal, dia_vencimento, data_inicio, data_termino, renovacao_automatica,
        conteudo_html, token_publico, itens,
        assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
        assinatura_cliente_ip, assinatura_cliente_data, assinatura_cliente_imagem,
        assinatura_agencia_nome, assinatura_agencia_data, criado_por, criado_em, atualizado_em,
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco, cor),
        lead:crm_negocios(id, titulo, nome_contato, empresa, telefone, email)
      `)
      .eq('agencia_id', membro.agencia_id)
      .order('criado_em', { ascending: false });

    if (status && status !== 'todos') {
      query = query.eq('status', status);
    }
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }
    if (busca?.trim()) {
      query = query.ilike('titulo', `%${busca.trim()}%`);
    }

    // Filtro especial: vencendo nos próximos 30 dias
    if (filtro === 'renovando') {
      const hoje = new Date().toISOString().slice(0, 10);
      const em30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      query = query.gte('data_termino', hoje).lte('data_termino', em30Dias).eq('status', 'assinado');
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ contratos: [] });
      }
      console.error('Erro ao listar contratos:', error);
      return respostaErro('Não foi possível carregar contratos.', 500);
    }

    return NextResponse.json({ contratos: data || [] });
  } catch (err) {
    console.error('Erro na rota /api/contratos:', err);
    return NextResponse.json({ contratos: [] });
  }
}

export async function POST(req: Request) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    if (!body.titulo?.trim()) return respostaErro('Título do contrato é obrigatório.', 400);
    if (!body.conteudo_html?.trim()) return respostaErro('Conteúdo do contrato é obrigatório.', 400);

    const tokenPublico = gerarTokenPublico();

    const payload = {
      agencia_id: membro.agencia_id,
      proposta_id: body.proposta_id || null,
      modelo_id: body.modelo_id || null,
      cliente_id: body.cliente_id || null,
      lead_id: body.lead_id || null,
      titulo: body.titulo.trim(),
      status: body.status || 'aguardando_assinatura',
      valor_mensal: Number(body.valor_mensal) || 0,
      dia_vencimento: body.dia_vencimento ? Number(body.dia_vencimento) : 10,
      data_inicio: body.data_inicio || null,
      data_termino: body.data_termino || null,
      renovacao_automatica: body.renovacao_automatica !== false,
      conteudo_html: body.conteudo_html,
      token_publico: tokenPublico,
      itens: body.itens || [],
      criado_por: membro.id,
    };

    const { data, error } = await db
      .from('contratos')
      .insert(payload)
      .select(`
        id, agencia_id, proposta_id, modelo_id, cliente_id, lead_id, titulo, status,
        valor_mensal, dia_vencimento, data_inicio, data_termino, renovacao_automatica,
        conteudo_html, token_publico, itens,
        assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
        assinatura_cliente_ip, assinatura_cliente_data, assinatura_cliente_imagem,
        assinatura_agencia_nome, assinatura_agencia_data, criado_por, criado_em, atualizado_em,
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco, cor),
        lead:crm_negocios(id, titulo, nome_contato, empresa, telefone, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar contrato:', error);
      return respostaErro('Não foi possível salvar o contrato.', 500);
    }

    return NextResponse.json({ contrato: data }, { status: 201 });
  } catch (err) {
    console.error('Erro ao postar contrato:', err);
    return respostaErro('Erro ao processar dados.', 500);
  }
}
