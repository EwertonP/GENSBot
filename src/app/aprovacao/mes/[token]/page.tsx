import type { Metadata } from 'next';
import { carregarMesDoCliente } from '@/lib/link-do-mes-server';
import { descricaoDaMiniatura, identificacaoDoCliente, nomeDoMes, tituloDaMiniatura } from '@/lib/miniatura-mes';
import { normalizarMes } from '@/lib/link-do-mes';
import { obterUrlBaseApp } from '@/lib/relatorio-token';
import LinkDoMesClient from './mes-client';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mes?: string | string[] }>;
}

/**
 * Miniatura do link (WhatsApp, Telegram, redes): título, descrição e imagem com
 * o cliente, o mês e em que etapa estão os posts. Usa os mesmos números da página.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const { mes: mesParam } = await searchParams;
  const mesPedido = normalizarMes(Array.isArray(mesParam) ? mesParam[0] : mesParam);

  const r = await carregarMesDoCliente(token, mesPedido);
  if (!r.ok) {
    return {
      title: 'Conteúdo do mês | Agência GENS',
      description: 'Acompanhe o conteúdo do mês, aprove textos e artes e veja em que etapa está cada post.',
    };
  }

  const { cliente, mes, contagem } = r.dados;
  const titulo = tituloDaMiniatura(cliente, mes);
  const descricao = descricaoDaMiniatura({ mes, total: contagem.total, para_voce: contagem.para_voce });

  // Domínio público para os rastreadores do WhatsApp conseguirem baixar página e imagem.
  const baseUrl = obterUrlBaseApp();
  const ogImageUrl = `${baseUrl}/api/aprovacao/mes/${token}/og?mes=${mes.slice(0, 7)}`;
  const pagina = `${baseUrl}/aprovacao/mes/${token}?mes=${mes.slice(0, 7)}`;
  const m = nomeDoMes(mes);

  return {
    metadataBase: new URL(baseUrl),
    title: titulo,
    description: descricao,
    // Link com token privado: não indexar.
    robots: { index: false, follow: false },
    openGraph: {
      title: titulo,
      description: descricao,
      url: pagina,
      siteName: 'Agência GENS',
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630, type: 'image/png', alt: `Conteúdo de ${m.minusculo} de ${m.ano} de ${identificacaoDoCliente(cliente)}` }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao, images: [ogImageUrl] },
  };
}

export default function Page() {
  return <LinkDoMesClient />;
}
