import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const { data: proposta, error } = await db
      .from('propostas')
      .select(`
        id, agencia_id, titulo, status, valor_mensal, valor_setup, validade,
        conteudo_html, token_publico, itens, visualizada_em, aceita_em, recusada_em,
        motivo_recusa, criado_em,
        agencia:agencias(id, nome, razao_social, cnpj_cpf, endereco, cidade_estado, email_contato, telefone_contato),
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal),
        lead:crm_negocios(id, titulo, nome_contato, empresa)
      `)
      .eq('token_publico', token)
      .maybeSingle();

    if (error || !proposta) {
      return respostaErro('Proposta não encontrada ou expirada.', 404);
    }

    // Registra visualização se ainda não registrada
    if (!proposta.visualizada_em) {
      await db
        .from('propostas')
        .update({ visualizada_em: new Date().toISOString() })
        .eq('id', proposta.id);
    }

    return NextResponse.json({ proposta });
  } catch (err) {
    console.error('Erro ao buscar proposta pública:', err);
    return respostaErro('Erro ao carregar proposta.', 500);
  }
}
