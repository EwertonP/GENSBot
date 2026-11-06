import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  escolherMes,
  itemNoFiltro,
  mesDoItem,
  montarItemDoMes,
  ordenarItensDoMes,
  type ItemBrutoDoMes,
} from '@/lib/link-do-mes';
import { dataLimiteTexto, diasRetencaoTexto } from '@/lib/retencao';

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
    // select('*'): colunas opcionais (visivel_cliente, arquivada_em) podem não existir em todos os bancos.
    .select('*')
    .eq('cliente_id', cliente.id)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar o mês.' }, { status: 500 });
  }

  const visiveis = ((brutos || []) as ItemBrutoDoMes[])
    .map((b) => ({ bruto: b, item: montarItemDoMes(b) }))
    .filter((x): x is { bruto: ItemBrutoDoMes; item: NonNullable<ReturnType<typeof montarItemDoMes>> } => !!x.item);

  // Mês de cada post: o da data programada (ou o de referência, sem data).
  const comMes = visiveis.map((x) => ({ ...x, mes: mesDoItem(x.bruto) }));

  // Meses que têm algo para mostrar (inclui pendências de meses anteriores).
  const contagemPorMes = new Map<string, number>();
  for (const x of comMes) {
    if (x.mes) contagemPorMes.set(x.mes, (contagemPorMes.get(x.mes) || 0) + 1);
  }
  const meses = [...contagemPorMes.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => b.mes.localeCompare(a.mes));

  const { searchParams } = new URL(req.url);
  const mes = escolherMes(searchParams.get('mes'), meses.map((m) => m.mes));

  const doMes = comMes.filter((x) => x.mes === mes);
  const ordemPorId = new Map(doMes.map((x) => [x.bruto.id, x.bruto.ordem ?? 0]));
  const itens = ordenarItensDoMes(
    doMes.map((x) => x.item),
    ordemPorId
  );

  // Prazo de retenção do texto (se a coluna ainda não existir, vale o padrão).
  const { data: ret } = await supabase.from('clientes').select('retencao_texto_dias').eq('id', cliente.id).maybeSingle();
  const diasTexto = diasRetencaoTexto((ret as { retencao_texto_dias?: number | null } | null)?.retencao_texto_dias);
  const publicadoEmPorId = new Map(doMes.map((x) => [x.bruto.id, x.bruto.status === 'publicado' ? x.bruto.publicado_em : null]));
  for (const it of itens) {
    if (it.etapa === 'publicado') it.texto_ate = dataLimiteTexto(publicadoEmPorId.get(it.id), diasTexto);
  }

  // Sugestões pendentes da cliente nos itens em planejamento.
  const idsTexto = itens.filter((i) => i.etapa === 'texto').map((i) => i.id);
  if (idsTexto.length) {
    const { data: sugs } = await supabase
      .from('conteudo_sugestoes_texto')
      .select('item_id, campo, texto_proposto')
      .in('item_id', idsTexto)
      .eq('status', 'pendente');
    for (const it of itens) {
      if (it.etapa !== 'texto') continue;
      it.sugestoes = (sugs || [])
        .filter((s) => s.item_id === it.id)
        .map((s) => ({ campo: s.campo as 'titulo' | 'briefing' | 'legenda', texto: s.texto_proposto as string }));
    }
  }

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
      para_voce: itens.filter((i) => itemNoFiltro(i, 'para_voce')).length,
      publicados: itens.filter((i) => itemNoFiltro(i, 'publicados')).length,
      total: itens.length,
    },
  });
}
