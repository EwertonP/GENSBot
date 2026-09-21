import type { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '@/lib/supabase';
import PaginaAprovacaoClient from './aprovacao-client';
import type { ConteudoItem } from '@/lib/conteudo';

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
      cliente:clientes(nome, foto_url)
    `)
    .eq('token_aprovacao', token)
    .maybeSingle();

  if (!item) {
    return {
      title: 'Aprovação de Conteúdo | Agência GENS',
      description: 'Acesse para visualizar a publicação e aprovar ou solicitar ajustes com 1 clique.',
    };
  }

  const clienteNome = (item.cliente as any)?.nome || 'Cliente';
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

  const titulo = `Aprovação de ${formato}: "${item.titulo || 'Nova Postagem'}" | ${clienteNome}`;
  const descricao = `Prévia visual oficial do ${formato} de ${clienteNome}. Navegue pelos slides, assista ao vídeo e aprove com 1 clique.`;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://allingens.vercel.app');

  const ogImageUrl = `${baseUrl}/api/aprovacao/${token}/og`;

  return {
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
