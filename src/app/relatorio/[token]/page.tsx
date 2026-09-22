import type { Metadata, ResolvingMetadata } from 'next';
import PaginaRelatorioClient from './relatorio-client';
import { decodificarTokenRelatorio } from '@/lib/relatorio-token';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { token } = await params;
  const tokenData = decodificarTokenRelatorio(token);

  const clienteNome = tokenData.clienteNome || 'Cliente';
  const titulo = `Relatório Executivo de Performance | ${clienteNome} · Agência GENS`;
  const descricao = `Acesse o relatório de desempenho e comparativo interativo do Instagram para ${clienteNome}.`;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      siteName: 'Agência GENS • Relatórios Executivos',
      type: 'article',
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;

  return <PaginaRelatorioClient token={token} />;
}
