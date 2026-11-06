import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  escolherMes,
  montarItemDoMes,
  ordenarItensDoMes,
  type ItemBrutoDoMes,
} from '@/lib/link-do-mes';

type Params = { params: Promise<{ token: string }> };

/**
 * Link do mês (público, sem login): o que a cliente precisa ver no mês.
 * O token é o mesmo do feed (`clientes.token_aprovacao_mes`). Só sai daqui o
 * que a regra de visibilidade permite (ver lib/link-do-mes).
 */
export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Token não fornecido.' }, { status: 400 });
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, cor, nicho, foto_url, instagram_accounts(instagram_username, profile_picture_url)')
    .eq('token_aprovacao_mes', token)
    .maybeSingle();

  if (!cliente) {
    return NextResponse.json({ error: 'Link não encontrado ou expirado.' }, { status: 404 });
  }

  const { data: brutos, error } = await supabase
    .from('conteudo_items')
    .select(
      'id, tipo, status, titulo, legenda, briefing, mes_referencia, data_programada, publicado_em, ordem, arquivos, cover_url, token_aprovacao, visivel_cliente, arquivada_em'
    )
    .eq('cliente_id', cliente.id)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar o mês.' }, { status: 500 });
  }

  const visiveis = ((brutos || []) as ItemBrutoDoMes[])
    .map((b) => ({ bruto: b, item: montarItemDoMes(b) }))
    .filter((x): x is { bruto: ItemBrutoDoMes; item: NonNullable<ReturnType<typeof montarItemDoMes>> } => !!x.item);

  // Meses que têm algo para mostrar (inclui pendências de meses anteriores).
  const contagemPorMes = new Map<string, number>();
  for (const { bruto } of visiveis) {
    contagemPorMes.set(bruto.mes_referencia, (contagemPorMes.get(bruto.mes_referencia) || 0) + 1);
  }
  const meses = [...contagemPorMes.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => b.mes.localeCompare(a.mes));

  const { searchParams } = new URL(req.url);
  const mes = escolherMes(searchParams.get('mes'), meses.map((m) => m.mes));

  const doMes = visiveis.filter((x) => x.bruto.mes_referencia === mes);
  const ordemPorId = new Map(doMes.map((x) => [x.bruto.id, x.bruto.ordem ?? 0]));
  const itens = ordenarItensDoMes(
    doMes.map((x) => x.item),
    ordemPorId
  );

  const ig = (cliente as { instagram_accounts?: { instagram_username?: string | null; profile_picture_url?: string | null } | null }).instagram_accounts;

  return NextResponse.json({
    cliente: {
      nome: cliente.nome,
      cor: cliente.cor,
      nicho: cliente.nicho,
      foto_url: cliente.foto_url || ig?.profile_picture_url || null,
      usuario: ig?.instagram_username || null,
    },
    mes,
    meses,
    itens,
    contagem: {
      para_voce: itens.filter((i) => i.aba === 'para_voce').length,
      publicados: itens.filter((i) => i.aba === 'publicados').length,
      total: itens.length,
    },
  });
}
