import type { Metadata } from 'next';
import PaginaRelatorioClient from './relatorio-client';
import { verificarTokenRelatorio } from '@/lib/relatorio-token';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const data = verificarTokenRelatorio(token);
  if (!data) return { title: 'Relatório indisponível · Agência GENS', robots: { index: false } };

  const titulo = `Relatório de desempenho no Instagram | ${data.clienteNome} · Agência GENS`;
  const descricao = `Resultados dos últimos ${data.period} dias no Instagram de ${data.clienteNome}.`;
  return {
    title: titulo,
    description: descricao,
    robots: { index: false },
    openGraph: { title: titulo, description: descricao, siteName: 'Agência GENS', type: 'article' },
  };
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;
  const data = verificarTokenRelatorio(token);
  return (
    <PaginaRelatorioClient
      token={token}
      valido={!!data}
      clienteNome={data?.clienteNome ?? ''}
      period={data?.period ?? 30}
    />
  );
}
