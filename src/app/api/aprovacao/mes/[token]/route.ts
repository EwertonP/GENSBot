import { NextResponse } from 'next/server';
import { carregarMesDoCliente } from '@/lib/link-do-mes-server';

type Params = { params: Promise<{ token: string }> };

/**
 * Link do mês (público, sem login): todos os posts do mês, cada um na sua etapa
 * do processo. O token é o mesmo do feed (`clientes.token_aprovacao_mes`). O mês
 * de cada post é o da data programada. Só sai daqui o que a regra de
 * visibilidade permite (ver lib/link-do-mes).
 */
export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Token não fornecido.' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const r = await carregarMesDoCliente(token, searchParams.get('mes'));
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status });

  const { cliente, mes, meses, itens, contagem } = r.dados;
  return NextResponse.json({
    cliente: { nome: cliente.nome, cor: cliente.cor, nicho: cliente.nicho, foto_url: cliente.foto_url, usuario: cliente.usuario },
    mes,
    meses,
    itens,
    contagem,
  });
}
