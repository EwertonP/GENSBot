import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const { data, error } = await db
      .from('propostas')
      .select(`
        id, agencia_id, modelo_id, cliente_id, lead_id, titulo, status,
        valor_mensal, valor_setup, validade, conteudo_html, token_publico, itens,
        visualizada_em, aceita_em, recusada_em, motivo_recusa, contrato_gerado_id,
        criado_por, criado_em, atualizado_em,
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco, cor),
        lead:crm_negocios(id, titulo, nome_contato, empresa, telefone, email)
      `)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (error || !data) {
      return respostaErro('Proposta não encontrada.', 404);
    }

    return NextResponse.json({ proposta: data });
  } catch (err) {
    console.error('Erro ao buscar proposta:', err);
    return respostaErro('Erro ao carregar proposta.', 500);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const body = await req.json();

    const dadosAtualizar: Record<string, unknown> = {
      atualizado_em: new Date().toISOString(),
    };

    if (body.titulo !== undefined) dadosAtualizar.titulo = body.titulo.trim();
    if (body.status !== undefined) dadosAtualizar.status = body.status;
    if (body.valor_mensal !== undefined) dadosAtualizar.valor_mensal = Number(body.valor_mensal) || 0;
    if (body.valor_setup !== undefined) dadosAtualizar.valor_setup = Number(body.valor_setup) || 0;
    if (body.validade !== undefined) dadosAtualizar.validade = body.validade || null;
    if (body.conteudo_html !== undefined) dadosAtualizar.conteudo_html = body.conteudo_html;
    if (body.itens !== undefined) dadosAtualizar.itens = body.itens;
    if (body.cliente_id !== undefined) dadosAtualizar.cliente_id = body.cliente_id || null;
    if (body.lead_id !== undefined) dadosAtualizar.lead_id = body.lead_id || null;

    const { data, error } = await db
      .from('propostas')
      .update(dadosAtualizar)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
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
      console.error('Erro ao atualizar proposta:', error);
      return respostaErro('Não foi possível salvar alterações da proposta.', 400);
    }

    return NextResponse.json({ proposta: data });
  } catch (err) {
    console.error('Erro na rota PUT /api/propostas/[id]:', err);
    return respostaErro('Erro ao processar atualização.', 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const { error } = await db
      .from('propostas')
      .delete()
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (error) {
      console.error('Erro ao excluir proposta:', error);
      return respostaErro('Não foi possível excluir a proposta.', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro ao deletar proposta:', err);
    return respostaErro('Erro interno.', 500);
  }
}
