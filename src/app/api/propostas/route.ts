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

  try {
    let query = db
      .from('propostas')
      .select(`
        id, agencia_id, modelo_id, cliente_id, lead_id, titulo, status,
        valor_mensal, valor_setup, validade, conteudo_html, token_publico, itens,
        visualizada_em, aceita_em, recusada_em, motivo_recusa, contrato_gerado_id,
        criado_por, criado_em, atualizado_em,
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

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        // Tabela ainda não criada
        return NextResponse.json({ propostas: [] });
      }
      console.error('Erro ao buscar propostas:', error);
      return respostaErro('Não foi possível listar as propostas.', 500);
    }

    return NextResponse.json({ propostas: data || [] });
  } catch (err) {
    console.error('Erro na rota /api/propostas:', err);
    return NextResponse.json({ propostas: [] });
  }
}

export async function POST(req: Request) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    if (!body.titulo?.trim()) return respostaErro('Título da proposta é obrigatório.', 400);
    if (!body.conteudo_html?.trim()) return respostaErro('Conteúdo da proposta é obrigatório.', 400);

    const tokenPublico = gerarTokenPublico();

    const payload = {
      agencia_id: membro.agencia_id,
      modelo_id: body.modelo_id || null,
      cliente_id: body.cliente_id || null,
      lead_id: body.lead_id || null,
      titulo: body.titulo.trim(),
      status: body.status || 'rascunho',
      valor_mensal: Number(body.valor_mensal) || 0,
      valor_setup: Number(body.valor_setup) || 0,
      validade: body.validade || null,
      conteudo_html: body.conteudo_html,
      token_publico: tokenPublico,
      itens: body.itens || [],
      criado_por: membro.id,
    };

    const { data, error } = await db
      .from('propostas')
      .insert(payload)
      .select(`
        id, agencia_id, modelo_id, cliente_id, lead_id, titulo, status,
        valor_mensal, valor_setup, validade, conteudo_html, token_publico, itens,
        visualizada_em, aceita_em, recusada_em, motivo_recusa, contrato_gerado_id,
        criado_por, criado_em, atualizado_em,
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco, cor),
        lead:crm_negocios(id, titulo, nome_contato, empresa, telefone, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao inserir proposta:', error);
      return respostaErro('Não foi possível criar a proposta.', 500);
    }

    return NextResponse.json({ proposta: data }, { status: 201 });
  } catch (err) {
    console.error('Erro ao criar proposta:', err);
    return respostaErro('Erro ao processar dados da proposta.', 500);
  }
}
