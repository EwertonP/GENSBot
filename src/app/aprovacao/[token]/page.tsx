import type { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '@/lib/supabase';
import PaginaAprovacaoClient from './aprovacao-client';
import type { ConteudoItem } from '@/lib/conteudo';
import { obterUrlBaseApp } from '@/lib/relatorio-token';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { token } = await params;

  const { data: item } = await supabase
    .from('conteudo_items')
    .select(`
      titulo,
      tipo,
      legenda,
      arquivos,
      cliente:clientes(
        nome,
        foto_url,
        instagram_account_id
      )
    `)
    .eq('token_aprovacao', token)
    .maybeSingle();

  if (!item) {
    return {
      title: 'Aprovação de Conteúdo | Agência GENS',
      description: 'Acesse para visualizar a publicação e aprovar ou solicitar ajustes com 1 clique.',
    };
  }

  // Se o cliente tem conta do Instagram vinculada, resolve o @username
  let clienteHandle = (item.cliente as any)?.nome || 'Cliente';
  if ((item.cliente as any)?.instagram_account_id) {
    const { data: conta } = await supabase
      .from('instagram_accounts')
      .select('instagram_username')
      .eq('id', (item.cliente as any).instagram_account_id)
      .maybeSingle();
    if (conta?.instagram_username) {
      clienteHandle = `@${conta.instagram_username}`;
    }
  } else if (clienteHandle && !clienteHandle.startsWith('@') && !clienteHandle.includes(' ')) {
    clienteHandle = `@${clienteHandle}`;
  }

  const tipo = item.tipo;
  const arquivos = Array.isArray(item.arquivos) ? item.arquivos : [];
  const formato =
    tipo === 'reel'
      ? 'Reels'
      : tipo === 'story'
      ? 'Story'
      : arquivos.length > 1
      ? 'Carrossel'
      : 'Publicação';

  const titulo = `Aprovação de ${formato}: "${item.titulo || 'Nova Postagem'}" | ${clienteHandle}`;
  const descricao = `Prévia visual oficial do ${formato} de ${clienteHandle}. Navegue pelos slides, assista ao vídeo e aprove com 1 clique.`;

  // Domínio público de produção para garantir que crawlers do WhatsApp/Facebook
  // consigam baixar a página e a imagem OG sem restrições.
  const baseUrl = obterUrlBaseApp();
  const ogImageUrl = `${baseUrl}/api/aprovacao/${token}/og`;

  return {
    metadataBase: new URL(baseUrl),
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      url: `${baseUrl}/aprovacao/${token}`,
      siteName: 'Agência GENS • Sistema de Aprovação',
      type: 'article',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `Prévia da publicação ${item.titulo || ''}`,
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

  // Busca o item no servidor para renderização imediata (sem spinner de carregamento inicial)
  const { data: item } = await supabase
    .from('conteudo_items')
    .select(`
      id,
      tipo,
      status,
      titulo,
      legenda,
      mes_referencia,
      data_programada,
      arquivos,
      token_aprovacao,
      comentarios_revisao,
      cliente:clientes(
        id,
        nome,
        cor,
        nicho,
        foto_url,
        instagram_account_id
      )
    `)
    .eq('token_aprovacao', token)
    .maybeSingle();

  return <PaginaAprovacaoClient itemInicial={item as unknown as ConteudoItem | null} token={token} />;
}
