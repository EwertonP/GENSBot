import type { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '@/lib/supabase';
import { obterUrlBaseApp } from '@/lib/relatorio-token';
import PaginaContratoClient, { type ContratoPublico } from './contrato-client';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { token } = await params;

  const { data: contrato } = await supabase
    .from('contratos')
    .select(`
      id,
      titulo,
      status,
      valor_mensal,
      dia_vencimento,
      cliente:clientes(nome),
      lead:crm_negocios(empresa, nome_contato)
    `)
    .eq('token_publico', token)
    .maybeSingle();

  if (!contrato) {
    return {
      title: 'Contrato de Prestação de Serviços | Agência GENS',
      description: 'Acesse o instrumento jurídico para conferência e assinatura digital.',
    };
  }

  const nomeCliente =
    (contrato.cliente as any)?.nome ||
    (contrato.lead as any)?.empresa ||
    (contrato.lead as any)?.nome_contato ||
    'Cliente';

  const titulo = `Contrato de Prestação de Serviços: ${nomeCliente} | Agência GENS`;
  const descricao = `Acesse o instrumento jurídico de Marketing Digital da ${nomeCliente} para conferência de cláusulas, escopo e assinatura digital certificada (MP 2.200-2/2001).`;

  const baseUrl = obterUrlBaseApp();
  const ogImageUrl = `${baseUrl}/api/contratos/public/${token}/og`;

  return {
    metadataBase: new URL(baseUrl),
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      url: `${baseUrl}/contrato/${token}`,
      siteName: 'Agência GENS • Sistema de Formalização Digital',
      type: 'article',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `Prévia do Contrato de Prestação de Serviços - ${nomeCliente}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: [ogImageUrl],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;

  // Busca inicial no servidor para carregamento instantâneo
  const { data: contrato } = await supabase
    .from('contratos')
    .select(`
      id, agencia_id, titulo, status, valor_mensal, dia_vencimento, data_inicio, data_termino,
      renovacao_automatica, conteudo_html, conteudo_final_html, hash_documento,
      enviado_em, visualizado_em, expira_em, revogado_em,
      token_publico, itens,
      assinatura_cliente_nome, assinatura_cliente_doc, assinatura_cliente_email,
      assinatura_cliente_ip, assinatura_cliente_data, assinatura_cliente_imagem,
      assinatura_agencia_nome, assinatura_agencia_data, assinatura_agencia_ip, criado_em,
      agencia:agencias(id, nome, razao_social, cnpj_cpf, endereco, cidade_estado, email_contato, telefone_contato, chave_pix),
      cliente:clientes(id, nome, cnpj_cpf, responsavel_legal, endereco),
      lead:crm_negocios(id, titulo, nome_contato, empresa)
    `)
    .eq('token_publico', token)
    .maybeSingle();

  // Usa o conteúdo congelado se houver
  const contratoFormatado: ContratoPublico | null = contrato
    ? ({
        ...contrato,
        conteudo_html: contrato.conteudo_final_html || contrato.conteudo_html,
      } as unknown as ContratoPublico)
    : null;

  return <PaginaContratoClient token={token} contratoInicial={contratoFormatado} />;
}
