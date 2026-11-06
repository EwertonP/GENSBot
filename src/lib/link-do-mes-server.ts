import { supabase } from './supabase';
import {
  escolherMes,
  ETAPAS_PROCESSO,
  itemNoFiltro,
  mesDoItem,
  montarItemDoMes,
  ordenarItensDoMes,
  type EtapaMes,
  type ItemBrutoDoMes,
  type ItemDoMes,
} from './link-do-mes';
import { dataLimiteTexto, diasRetencaoTexto } from './retencao';

export interface MesDoCliente {
  cliente: { id: string; nome: string; cor: string | null; nicho: string | null; foto_url: string | null; usuario: string | null };
  mes: string;
  meses: { mes: string; total: number }[];
  itens: ItemDoMes[];
  contagem: { para_voce: number; publicados: number; total: number };
  /** Quantos posts do mês estão em cada etapa do processo. */
  por_etapa: Record<EtapaMes, number>;
}

export type ResultadoMes = { ok: true; dados: MesDoCliente } | { ok: false; status: 404 | 500; erro: string };

/**
 * Lê o mês de um cliente pelo token do link: todos os posts, cada um na sua
 * etapa. Usada pela API do link, pelo título da página e pela imagem de prévia,
 * para os três mostrarem os mesmos números.
 */
export async function carregarMesDoCliente(token: string, mesPedido: string | null): Promise<ResultadoMes> {
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, cor, nicho, foto_url, instagram_accounts(instagram_username, profile_picture_url)')
    .eq('token_aprovacao_mes', token)
    .maybeSingle();

  if (!cliente) return { ok: false, status: 404, erro: 'Link não encontrado ou expirado.' };

  const { data: brutos, error } = await supabase
    .from('conteudo_items')
    // select('*'): colunas opcionais (visivel_cliente, arquivada_em, texto_aprovado_em) podem não existir em todos os bancos.
    .select('*')
    .eq('cliente_id', cliente.id)
    .limit(500);

  if (error) return { ok: false, status: 500, erro: 'Não foi possível carregar o mês.' };

  const visiveis = ((brutos || []) as ItemBrutoDoMes[])
    .map((b) => ({ bruto: b, item: montarItemDoMes(b) }))
    .filter((x): x is { bruto: ItemBrutoDoMes; item: ItemDoMes } => !!x.item);

  // Mês de cada post: o da data programada (ou o de referência, sem data).
  const comMes = visiveis.map((x) => ({ ...x, mes: mesDoItem(x.bruto) }));

  // Meses que têm algo para mostrar (inclui pendências de meses anteriores).
  const contagemPorMes = new Map<string, number>();
  for (const x of comMes) {
    if (x.mes) contagemPorMes.set(x.mes, (contagemPorMes.get(x.mes) || 0) + 1);
  }
  const meses = [...contagemPorMes.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => b.mes.localeCompare(a.mes));

  const mes = escolherMes(mesPedido, meses.map((m) => m.mes));

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

  const por_etapa = Object.fromEntries(ETAPAS_PROCESSO.map((e) => [e.etapa, itens.filter((i) => i.etapa === e.etapa).length])) as Record<EtapaMes, number>;

  return {
    ok: true,
    dados: {
      cliente: {
        id: cliente.id,
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
      por_etapa,
    },
  };
}
