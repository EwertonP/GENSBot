import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { postsDiretos, type PostDireto } from '@/lib/responsavel-entrega';

export interface ResumoProdutividadeMembro {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  papel: string;
  foto_url: string | null;
  total_demandas: number;
  total_entregues: number;
  como_principal: number;
  como_co_responsavel: number;
  total_em_andamento: number;
  /** Posts publicados sem demanda que contam como entrega deste membro. */
  posts_diretos: number;
  por_tipo: {
    post: number;
    reel: number;
    story: number;
    carrossel: number;
  };
  clientes: Array<{
    id: string;
    nome: string;
    cor: string | null;
    foto_url: string | null;
    total_entregues: number;
    total_demandas: number;
  }>;
}

export interface ResumoProdutividadeCliente {
  id: string;
  nome: string;
  cor: string | null;
  nicho: string | null;
  foto_url: string | null;
  total_demandas: number;
  total_entregues: number;
  total_em_andamento: number;
  taxa_entrega: number;
  por_tipo: {
    post: number;
    reel: number;
    story: number;
    carrossel: number;
  };
  membros: Array<{
    id: string;
    nome: string;
    foto_url: string | null;
    total_entregues: number;
  }>;
}

export interface ItemEntregueDetalhe {
  id: string;
  /** 'post_direto' = publicado sem demanda. */
  origem?: 'demanda' | 'post_direto';
  titulo: string | null;
  tipo: string;
  status: string;
  mes_referencia: string;
  data_programada: string | null;
  publicado_em: string | null;
  cliente: {
    id: string;
    nome: string;
    cor: string | null;
    foto_url: string | null;
  } | null;
  responsavel: {
    id: string;
    nome: string;
    foto_url: string | null;
  } | null;
  co_responsaveis: Array<{
    id: string;
    nome: string;
    foto_url: string | null;
  }>;
}

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  // Visão gerencial: apenas administradores / sócios
  if (membro.papel !== 'master') {
    return respostaErro('Apenas administradores e sócios podem visualizar métricas de produtividade.', 403);
  }

  const { searchParams } = new URL(req.url);
  const mesParam = searchParams.get('mes') || new Date().toISOString().slice(0, 7);
  const clienteIdParam = searchParams.get('cliente_id');
  const membroIdParam = searchParams.get('membro_id');

  try {
    // Helper para definir se a demanda já foi finalizada pela equipe
// Demandas agendadas ou com concluida = true já foram produzidas e aprovadas
function isDemandaEntregue(d: any): boolean {
  return (
    d?.concluida === true ||
    d?.status === 'publicado' ||
    d?.status === 'agendamento' ||
    d?.status === 'pronto_publicar'
  );
}
    const { data: membrosDb, error: errMembros } = await serviceSupabase
      .from('membros')
      .select('id, nome, email, papel, cargo, foto_url, ativo')
      .eq('agencia_id', membro.agencia_id)
      .order('nome', { ascending: true });

    if (errMembros) throw errMembros;

    // 2. Busca todos os clientes da agência
    const { data: clientesDb, error: errClientes } = await serviceSupabase
      .from('clientes')
      .select('id, nome, cor, nicho, foto_url, ativo, instagram_account_id')
      .eq('agencia_id', membro.agencia_id)
      .order('nome', { ascending: true });

    if (errClientes) throw errClientes;

    // 3. Busca demandas da agência
    let query = serviceSupabase
      .from('conteudo_items')
      .select(`
        id,
        titulo,
        tipo,
        status,
        concluida,
        mes_referencia,
        data_programada,
        prazo,
        publicado_em,
        responsavel_id,
        co_responsaveis_ids,
        cliente_id,
        criado_em
      `)
      .eq('agencia_id', membro.agencia_id);

    if (mesParam !== 'todos') {
      const parts = mesParam.split('-');
      const ano = parseInt(parts[0], 10);
      const mes = parseInt(parts[1], 10);
      if (!isNaN(ano) && !isNaN(mes)) {
        const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const proxAno = mes === 12 ? ano + 1 : ano;
        const proxMes = mes === 12 ? 1 : mes + 1;
        const inicioProxMes = `${proxAno}-${String(proxMes).padStart(2, '0')}-01`;
        query = query.gte('mes_referencia', inicioMes).lt('mes_referencia', inicioProxMes);
      } else {
        query = query.eq('mes_referencia', mesParam);
      }
    }

    if (clienteIdParam) {
      query = query.eq('cliente_id', clienteIdParam);
    }

    const { data: demandasDb, error: errDemandas } = await query;
    if (errDemandas) throw errDemandas;

    const demandas = demandasDb || [];

    // Posts publicados sem demanda: contam como entrega de quem os agendou/publicou.
    let diretos: PostDireto[] = [];
    try {
      const idsMembros = (membrosDb || []).map((m) => m.id);
      let qPosts = serviceSupabase
        .from('scheduled_posts')
        .select('id, user_id, responsavel_id, instagram_user_id, media_type, caption, status, published_at')
        .eq('status', 'published')
        .in('user_id', idsMembros);
      if (mesParam !== 'todos') {
        const [a, m] = mesParam.split('-').map((n) => parseInt(n, 10));
        if (!isNaN(a) && !isNaN(m)) {
          // Brasília: o mês começa 3h depois do UTC.
          const ini = new Date(Date.UTC(a, m - 1, 1, 3)).toISOString();
          const fim = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1, 3)).toISOString();
          qPosts = qPosts.gte('published_at', ini).lt('published_at', fim);
        }
      }
      const { data: postsDb } = await qPosts.limit(2000);
      const posts = postsDb || [];
      if (posts.length > 0) {
        const { data: vinculados } = await serviceSupabase.from('conteudo_items').select('scheduled_post_id').in('scheduled_post_id', posts.map((p) => p.id));
        const idsComDemanda = new Set((vinculados || []).map((v: { scheduled_post_id: string }) => v.scheduled_post_id));
        const { data: contas } = await serviceSupabase
          .from('instagram_accounts')
          .select('id, instagram_user_id')
          .in('instagram_user_id', [...new Set(posts.map((p) => p.instagram_user_id).filter(Boolean))]);
        const contaPorId = new Map((contas || []).map((c: { id: string; instagram_user_id: string }) => [c.id, c.instagram_user_id]));
        const clientePorConta = new Map<string, string>();
        for (const c of clientesDb || []) {
          const ig = c.instagram_account_id ? contaPorId.get(c.instagram_account_id) : null;
          if (ig) clientePorConta.set(ig, c.id);
        }
        diretos = postsDiretos(posts, idsComDemanda, clientePorConta);
        if (clienteIdParam) diretos = diretos.filter((d) => d.cliente_id === clienteIdParam);
      }
    } catch (e) {
      console.warn('[produtividade] não foi possível contar os posts diretos:', e);
    }
    const diretosDoMembro = (id: string) => diretos.filter((d) => d.responsavel_id === id);

    // Mapas para lookup rápido
    const membrosMap = new Map((membrosDb || []).map((m) => [m.id, m]));
    const clientesMap = new Map((clientesDb || []).map((c) => [c.id, c]));

    // Filtro por membro se solicitado
    const demandasFiltradas = membroIdParam
      ? demandas.filter(
          (d) =>
            d.responsavel_id === membroIdParam ||
            (Array.isArray(d.co_responsaveis_ids) && d.co_responsaveis_ids.includes(membroIdParam))
        )
      : demandas;

    // Métricas por Membro
    const produtividadePorMembro: ResumoProdutividadeMembro[] = (membrosDb || []).map((m) => {
      const demandasDoMembro = demandas.filter(
        (d) =>
          d.responsavel_id === m.id ||
          (Array.isArray(d.co_responsaveis_ids) && d.co_responsaveis_ids.includes(m.id))
      );

      const entregues = demandasDoMembro.filter((d) => isDemandaEntregue(d));
      const emAndamento = demandasDoMembro.filter((d) => !isDemandaEntregue(d));
      const postsDoMembro = diretosDoMembro(m.id);

      const porTipo = { post: 0, reel: 0, story: 0, carrossel: 0 };
      for (const d of entregues) {
        const t = d.tipo as keyof typeof porTipo;
        if (porTipo[t] !== undefined) porTipo[t]++;
      }
      for (const p of postsDoMembro) porTipo[p.tipo]++;

      // Clientes atendidos por este membro
      const clientesAtendidosMap = new Map<string, { total_entregues: number; total_demandas: number }>();
      for (const d of demandasDoMembro) {
        if (!d.cliente_id) continue;
        const cur = clientesAtendidosMap.get(d.cliente_id) || { total_entregues: 0, total_demandas: 0 };
        cur.total_demandas++;
        if (isDemandaEntregue(d)) cur.total_entregues++;
        clientesAtendidosMap.set(d.cliente_id, cur);
      }

      for (const p of postsDoMembro) {
        if (!p.cliente_id) continue;
        const cur = clientesAtendidosMap.get(p.cliente_id) || { total_entregues: 0, total_demandas: 0 };
        cur.total_demandas++;
        cur.total_entregues++;
        clientesAtendidosMap.set(p.cliente_id, cur);
      }

      const clientesAtendidos = Array.from(clientesAtendidosMap.entries())
        .map(([cId, stats]) => {
          const cli = clientesMap.get(cId);
          return {
            id: cId,
            nome: cli?.nome || 'Cliente',
            cor: cli?.cor || null,
            foto_url: cli?.foto_url || null,
            total_entregues: stats.total_entregues,
            total_demandas: stats.total_demandas,
          };
        })
        .sort((a, b) => b.total_entregues - a.total_entregues);

      return {
        id: m.id,
        nome: m.nome,
        email: m.email,
        cargo: m.cargo,
        papel: m.papel,
        foto_url: m.foto_url,
        total_demandas: demandasDoMembro.length + postsDoMembro.length,
        total_entregues: entregues.length + postsDoMembro.length,
        posts_diretos: postsDoMembro.length,
        como_principal: entregues.filter((d) => d.responsavel_id === m.id).length + postsDoMembro.length,
        como_co_responsavel: entregues.filter(
          (d) => Array.isArray(d.co_responsaveis_ids) && d.co_responsaveis_ids.includes(m.id)
        ).length,
        total_em_andamento: emAndamento.length,
        por_tipo: porTipo,
        clientes: clientesAtendidos,
      };
    });

    // Ordena membros pelos que mais entregaram
    produtividadePorMembro.sort((a, b) => b.total_entregues - a.total_entregues || b.total_demandas - a.total_demandas);

    // Métricas por Cliente
    const produtividadePorCliente: ResumoProdutividadeCliente[] = (clientesDb || [])
      .map((c) => {
        const demandasDoCliente = demandas.filter((d) => d.cliente_id === c.id);
        const entregues = demandasDoCliente.filter((d) => isDemandaEntregue(d));
        const emAndamento = demandasDoCliente.filter((d) => !isDemandaEntregue(d));

        const porTipo = { post: 0, reel: 0, story: 0, carrossel: 0 };
        for (const d of entregues) {
          const t = d.tipo as keyof typeof porTipo;
          if (porTipo[t] !== undefined) porTipo[t]++;
        }

        const postsDoCliente = diretos.filter((p) => p.cliente_id === c.id);
        for (const p of postsDoCliente) porTipo[p.tipo]++;

        const membrosEnvolvidosMap = new Map<string, number>();
        for (const p of postsDoCliente) membrosEnvolvidosMap.set(p.responsavel_id, (membrosEnvolvidosMap.get(p.responsavel_id) || 0) + 1);
        for (const d of entregues) {
          if (d.responsavel_id) {
            membrosEnvolvidosMap.set(d.responsavel_id, (membrosEnvolvidosMap.get(d.responsavel_id) || 0) + 1);
          }
          if (Array.isArray(d.co_responsaveis_ids)) {
            for (const coId of d.co_responsaveis_ids) {
              membrosEnvolvidosMap.set(coId, (membrosEnvolvidosMap.get(coId) || 0) + 1);
            }
          }
        }

        const membrosEnvolvidos = Array.from(membrosEnvolvidosMap.entries())
          .map(([mId, count]) => {
            const mem = membrosMap.get(mId);
            return {
              id: mId,
              nome: mem?.nome || 'Membro',
              foto_url: mem?.foto_url || null,
              total_entregues: count,
            };
          })
          .sort((a, b) => b.total_entregues - a.total_entregues);

        const totalCliente = demandasDoCliente.length + postsDoCliente.length;
        const entreguesCliente = entregues.length + postsDoCliente.length;
        const taxaEntrega = totalCliente > 0 ? Math.round((entreguesCliente / totalCliente) * 100) : 0;

        return {
          id: c.id,
          nome: c.nome,
          cor: c.cor,
          nicho: c.nicho,
          foto_url: c.foto_url,
          total_demandas: totalCliente,
          total_entregues: entreguesCliente,
          total_em_andamento: emAndamento.length,
          taxa_entrega: taxaEntrega,
          por_tipo: porTipo,
          membros: membrosEnvolvidos,
        };
      })
      .filter((c) => c.total_demandas > 0 || c.total_entregues > 0);

    // Ordena clientes pelos que tiveram mais entregas
    produtividadePorCliente.sort((a, b) => b.total_entregues - a.total_entregues || b.total_demandas - a.total_demandas);

    // Resumo Geral
    const diretosFiltrados = membroIdParam ? diretos.filter((d) => d.responsavel_id === membroIdParam) : diretos;
    const totalEntreguesGeral = demandasFiltradas.filter((d) => isDemandaEntregue(d)).length + diretosFiltrados.length;
    const totalEmAndamentoGeral = demandasFiltradas.filter((d) => !isDemandaEntregue(d)).length;
    const totalGeral = demandasFiltradas.length + diretosFiltrados.length;
    const taxaEntregaGeral = totalGeral > 0 ? Math.round((totalEntreguesGeral / totalGeral) * 100) : 0;

    // Entregas sem ninguém como responsável: não contam para ninguém até serem atribuídas.
    const semResponsavel = demandas.filter(
      (d) => isDemandaEntregue(d) && !d.responsavel_id && !(Array.isArray(d.co_responsaveis_ids) && d.co_responsaveis_ids.length > 0)
    );

    // Membro destaque do período
    const topProdutor = produtividadePorMembro.find((m) => m.total_entregues > 0) || null;

    // Cliente com mais entregas
    const topCliente = produtividadePorCliente.find((c) => c.total_entregues > 0) || null;

    // Lista detalhada das peças entregues no período
    const itensEntregues: ItemEntregueDetalhe[] = demandasFiltradas
      .filter((d) => isDemandaEntregue(d))
      .slice(0, 100)
      .map((d) => {
        const cli = d.cliente_id ? clientesMap.get(d.cliente_id) : null;
        const resp = d.responsavel_id ? membrosMap.get(d.responsavel_id) : null;
        const coResps = Array.isArray(d.co_responsaveis_ids)
          ? d.co_responsaveis_ids
              .map((id: string) => membrosMap.get(id))
              .filter(Boolean)
              .map((m: any) => ({ id: m.id, nome: m.nome, foto_url: m.foto_url }))
          : [];

        return {
          id: d.id,
          origem: 'demanda' as const,
          titulo: d.titulo,
          tipo: d.tipo,
          status: d.status,
          mes_referencia: d.mes_referencia,
          data_programada: d.data_programada,
          publicado_em: d.publicado_em,
          cliente: cli ? { id: cli.id, nome: cli.nome, cor: cli.cor, foto_url: cli.foto_url } : null,
          responsavel: resp ? { id: resp.id, nome: resp.nome, foto_url: resp.foto_url } : null,
          co_responsaveis: coResps,
        };
      });

    const itensDiretos: ItemEntregueDetalhe[] = diretosFiltrados.slice(0, 100).map((p) => {
      const cli = p.cliente_id ? clientesMap.get(p.cliente_id) : null;
      const resp = membrosMap.get(p.responsavel_id);
      return {
        id: p.id,
        origem: 'post_direto' as const,
        titulo: p.titulo,
        tipo: p.tipo,
        status: 'publicado',
        mes_referencia: p.publicado_em.slice(0, 7) + '-01',
        data_programada: null,
        publicado_em: p.publicado_em,
        cliente: cli ? { id: cli.id, nome: cli.nome, cor: cli.cor, foto_url: cli.foto_url } : null,
        responsavel: resp ? { id: resp.id, nome: resp.nome, foto_url: resp.foto_url } : null,
        co_responsaveis: [],
      };
    });

    const itensSemResponsavel: ItemEntregueDetalhe[] = semResponsavel.slice(0, 100).map((d) => {
      const cli = d.cliente_id ? clientesMap.get(d.cliente_id) : null;
      return {
        id: d.id,
        origem: 'demanda' as const,
        titulo: d.titulo,
        tipo: d.tipo,
        status: d.status,
        mes_referencia: d.mes_referencia,
        data_programada: d.data_programada,
        publicado_em: d.publicado_em,
        cliente: cli ? { id: cli.id, nome: cli.nome, cor: cli.cor, foto_url: cli.foto_url } : null,
        responsavel: null,
        co_responsaveis: [],
      };
    });

    return NextResponse.json({
      mes: mesParam,
      resumo: {
        total_posts_diretos: diretosFiltrados.length,
        total_sem_responsavel: semResponsavel.length,
        total_demandas: totalGeral,
        total_entregues: totalEntreguesGeral,
        total_em_andamento: totalEmAndamentoGeral,
        taxa_entrega: taxaEntregaGeral,
        top_produtor: topProdutor
          ? {
              id: topProdutor.id,
              nome: topProdutor.nome,
              foto_url: topProdutor.foto_url,
              cargo: topProdutor.cargo,
              total_entregues: topProdutor.total_entregues,
            }
          : null,
        top_cliente: topCliente
          ? {
              id: topCliente.id,
              nome: topCliente.nome,
              foto_url: topCliente.foto_url,
              cor: topCliente.cor,
              total_entregues: topCliente.total_entregues,
            }
          : null,
      },
      membros: produtividadePorMembro,
      clientes: produtividadePorCliente,
      itens_entregues: [...itensEntregues, ...itensDiretos],
      itens_sem_responsavel: itensSemResponsavel,
    });
  } catch (err: any) {
    console.error('Erro ao calcular produtividade da equipe:', err);
    return NextResponse.json({ error: err.message || 'Erro ao calcular métricas de produtividade.' }, { status: 500 });
  }
}
