import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { gerarTokenPublico, interpolarVariaveis, MODELOS_CONTRATOS_PADRAO } from '@/lib/documentos-modelos';
import { respostaErro } from '@/lib/clientes-server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    // 1. Carrega proposta com cliente e lead
    const { data: proposta, error: erroProp } = await db
      .from('propostas')
      .select(`
        id, agencia_id, cliente_id, lead_id, titulo, valor_mensal, valor_setup,
        cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco, dia_vencimento),
        lead:crm_negocios(id, titulo, nome_contato, empresa, telefone, email)
      `)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .single();

    if (erroProp || !proposta) {
      return respostaErro('Proposta não encontrada.', 404);
    }

    // 2. Carrega dados da agência
    const { data: agencia } = await db
      .from('agencias')
      .select('nome, razao_social, cnpj_cpf, endereco, cidade_estado, chave_pix, telefone_contato, email_contato')
      .eq('id', membro.agencia_id)
      .maybeSingle();

    // 3. Escolhe modelo padrão de contrato
    const modeloPadrao = MODELOS_CONTRATOS_PADRAO[0];
    const hoje = new Date();
    const dataInicio = hoje.toISOString().slice(0, 10);
    const dataTermino = new Date(hoje.setFullYear(hoje.getFullYear() + 1)).toISOString().slice(0, 10);

    const clienteNome = (proposta.cliente as { nome?: string } | null)?.nome || (proposta.lead as { nome_contato?: string; empresa?: string } | null)?.empresa || (proposta.lead as { nome_contato?: string } | null)?.nome_contato || 'Cliente';
    const clienteDoc = (proposta.cliente as { cnpj_cpf?: string } | null)?.cnpj_cpf || 'A preencher';
    const clienteResp = (proposta.cliente as { responsavel_legal?: string } | null)?.responsavel_legal || (proposta.lead as { nome_contato?: string } | null)?.nome_contato || clienteNome;
    const clienteEnd = (proposta.cliente as { endereco?: string } | null)?.endereco || 'A preencher';
    const diaVenc = (proposta.cliente as { dia_vencimento?: number } | null)?.dia_vencimento || 10;

    const htmlContrato = interpolarVariaveis(modeloPadrao.conteudo_html, {
      agencia_nome: agencia?.nome || 'Agência',
      agencia_razao_social: agencia?.razao_social || agencia?.nome || 'Agência LTDA',
      agencia_cnpj: agencia?.cnpj_cpf || '00.000.000/0001-00',
      agencia_endereco: agencia?.endereco || 'Endereço da Agência',
      agencia_cidade_estado: agencia?.cidade_estado || 'São Paulo - SP',
      agencia_email: agencia?.email_contato || 'contato@agencia.com.br',
      agencia_telefone: agencia?.telefone_contato || '(11) 99999-9999',
      agencia_pix: agencia?.chave_pix || 'PIX da agência',
      cliente_nome: clienteNome,
      cliente_doc: clienteDoc,
      cliente_responsavel: clienteResp,
      cliente_endereco: clienteEnd,
      cliente_email: (proposta.lead as { email?: string } | null)?.email || '',
      cliente_telefone: (proposta.lead as { telefone?: string } | null)?.telefone || '',
      valor_mensal: proposta.valor_mensal ? `R$ ${Number(proposta.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00',
      valor_setup: proposta.valor_setup ? `R$ ${Number(proposta.valor_setup).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00',
      dia_vencimento: diaVenc,
      data_inicio: dataInicio,
      data_termino: dataTermino,
      vigencia: '12 meses',
      data_hoje: new Date().toLocaleDateString('pt-BR'),
    });

    const tokenContrato = gerarTokenPublico();

    // 4. Cria contrato
    const { data: contrato, error: erroContrato } = await db
      .from('contratos')
      .insert({
        agencia_id: membro.agencia_id,
        proposta_id: proposta.id,
        cliente_id: proposta.cliente_id,
        lead_id: proposta.lead_id,
        titulo: `Contrato - ${proposta.titulo}`,
        status: 'rascunho',
        valor_mensal: proposta.valor_mensal || 0,
        dia_vencimento: diaVenc,
        data_inicio: dataInicio,
        data_termino: dataTermino,
        renovacao_automatica: true,
        conteudo_html: htmlContrato,
        token_publico: tokenContrato,
        criado_por: membro.id,
      })
      .select()
      .single();

    if (erroContrato) {
      console.error('Erro ao gerar contrato:', erroContrato);
      return respostaErro('Não foi possível gerar o contrato a partir da proposta.', 500);
    }

    // 5. Atualiza proposta
    await db
      .from('propostas')
      .update({
        contrato_gerado_id: contrato.id,
        status: 'aceita',
        aceita_em: new Date().toISOString(),
      })
      .eq('id', proposta.id);

    return NextResponse.json({ contrato }, { status: 201 });
  } catch (err) {
    console.error('Erro ao gerar contrato:', err);
    return respostaErro('Erro ao processar criação do contrato.', 500);
  }
}
