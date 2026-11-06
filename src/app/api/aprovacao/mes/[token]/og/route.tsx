import { carregarMesDoCliente } from '@/lib/link-do-mes-server';
import { normalizarMes } from '@/lib/link-do-mes';
import { identificacaoDoCliente, linhasDaImagem, nomeDoMes } from '@/lib/miniatura-mes';
import { imagemDoMes } from '@/lib/og-mes';

export const runtime = 'nodejs';

/** Baixa a foto do perfil e devolve como data URL; se falhar, a imagem usa a inicial. */
async function fotoComoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const tipo = res.headers.get('content-type') || 'image/jpeg';
    if (!tipo.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 2_000_000) return null;
    return `data:${tipo};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const mesPedido = normalizarMes(new URL(req.url).searchParams.get('mes'));

  try {
    const r = await carregarMesDoCliente(token, mesPedido);
    const dados = r.ok ? r.dados : null;

    const hoje = new Date();
    const m = nomeDoMes(dados?.mes || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`);
    const identificacao = dados ? identificacaoDoCliente(dados.cliente) : 'Agência GENS';
    const total = dados?.contagem.total ?? 0;
    const paraVoce = dados?.contagem.para_voce ?? 0;
    const resumo =
      total === 0
        ? 'Os posts aparecem conforme são planejados'
        : `${total} ${total === 1 ? 'post' : 'posts'}${paraVoce > 0 ? ` · ${paraVoce} ${paraVoce === 1 ? 'espera' : 'esperam'} você` : ''}`;

    return imagemDoMes({
      identificacao,
      mesNome: m.nome,
      ano: m.ano,
      resumo,
      linhas: dados ? linhasDaImagem(dados.por_etapa) : [],
      foto: await fotoComoDataUrl(dados?.cliente.foto_url ?? null),
      inicial: identificacao.replace('@', '').charAt(0).toUpperCase() || 'G',
    });
  } catch {
    return new Response('Erro ao gerar imagem de prévia', { status: 500 });
  }
}
