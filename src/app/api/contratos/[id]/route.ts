import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';

const CONTRATOS_SELECT = `
  id, agencia_id, proposta_id, modelo_id, cliente_id, lead_id, titulo, status,
  valor_mensal, dia_vencimento, data_inicio, data_termino, renovacao_automatica,
  conteudo_html, conteudo_final_html, hash_documento, enviado_em, visualizado_em, expira_em, revogado_em,
  token_publico, itens,
  assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
  assinatura_cliente_ip, assinatura_cliente_data, assinatura_cliente_imagem,
  assinatura_agencia_nome, assinatura_agencia_data, assinatura_agencia_membro_id, assinatura_agencia_ip,
  pdf_url, pdf_hash, criado_por, criado_em, atualizado_em,
  cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco, cor),
  lead:crm_negocios(id, titulo, nome_contato, empresa, telefone, email)
`;

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
      .from('contratos')
      .select(CONTRATOS_SELECT)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (error || !data) {
      return respostaErro('Contrato não encontrado.', 404);
    }

    return NextResponse.json({ contrato: data });
  } catch (err) {
    console.error('Erro ao buscar contrato:', err);
    return respostaErro('Erro ao carregar contrato.', 500);
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
    if (body.dia_vencimento !== undefined) dadosAtualizar.dia_vencimento = Number(body.dia_vencimento) || 10;
    if (body.data_inicio !== undefined) dadosAtualizar.data_inicio = body.data_inicio || null;
    if (body.data_termino !== undefined) dadosAtualizar.data_termino = body.data_termino || null;
    if (body.renovacao_automatica !== undefined) dadosAtualizar.renovacao_automatica = body.renovacao_automatica;
    if (body.conteudo_html !== undefined) dadosAtualizar.conteudo_html = body.conteudo_html;
    if (body.itens !== undefined) dadosAtualizar.itens = body.itens;
    if (body.cliente_id !== undefined) dadosAtualizar.cliente_id = body.cliente_id || null;
    if (body.lead_id !== undefined) dadosAtualizar.lead_id = body.lead_id || null;

    const { data, error } = await db
      .from('contratos')
      .update(dadosAtualizar)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .select(CONTRATOS_SELECT)
      .single();

    if (error) {
      console.error('Erro ao salvar contrato:', error);
      return respostaErro('Não foi possível salvar alterações do contrato.', 400);
    }

    return NextResponse.json({ contrato: data });
  } catch (err) {
    console.error('Erro na rota PUT /api/contratos/[id]:', err);
    return respostaErro('Erro ao atualizar contrato.', 500);
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
      .from('contratos')
      .delete()
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id);

    if (error) {
      console.error('Erro ao deletar contrato:', error);
      return respostaErro('Não foi possível excluir o contrato.', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro ao deletar contrato:', err);
    return respostaErro('Erro interno.', 500);
  }
}
