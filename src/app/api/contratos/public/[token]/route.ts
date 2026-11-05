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
    const { data: contrato, error } = await db
      .from('contratos')
      .select(`
        id, agencia_id, titulo, status, valor_mensal, dia_vencimento, data_inicio, data_termino,
        renovacao_automatica, conteudo_html, token_publico, itens,
        assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
        assinatura_cliente_ip, assinatura_cliente_data, assinatura_cliente_imagem,
        assinatura_agencia_nome, assinatura_agencia_data, criado_em,
        agencia:agencias(id, nome, razao_social, cnpj_cpf, endereco, cidade_estado, email_contato, telefone_contato, chave_pix),
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal),
        lead:crm_negocios(id, titulo, nome_contato, empresa)
      `)
      .eq('token_publico', token)
      .maybeSingle();

    if (error || !contrato) {
      return respostaErro('Contrato não encontrado ou link expirado.', 404);
    }

    return NextResponse.json({ contrato });
  } catch (err) {
    console.error('Erro ao buscar contrato público:', err);
    return respostaErro('Erro ao processar contrato.', 500);
  }
}
