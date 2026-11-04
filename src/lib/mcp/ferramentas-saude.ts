/**
 * Ferramentas do MCP — Saúde da operação.
 *
 * Só leitura. Varre a agência atrás do que está quebrado ou prestes a quebrar e
 * devolve uma lista curta e priorizada, em vez de a pessoa abrir várias telas:
 * - acesso ao Instagram vencendo (a renovação automática falhou);
 * - posts que falharam, atrasaram ou travaram na fila de publicação;
 * - automações ativas que mandam a 1ª mensagem mas ninguém clica no link;
 * - demandas atrasadas ou travadas;
 * - clientes com Instagram conectado e nada agendado para a próxima semana.
 *
 * Master only: mistura contas, tokens e clientes da agência inteira. Quem não é
 * master continua com `resumo_operacao`, que respeita o escopo de cada membro.
 * Nunca lê nem devolve o access_token das contas.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { membrosDaAgencia } from './ferramentas-c3';

const DIA_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

// Limiares. O cron do Postgres roda a cada minuto, então 10 min de atraso já é anormal.
export const LIMIARES = {
  /** A renovação automática começa com 30 dias de folga; chegar a 10 significa ~20 dias de falha seguida. */
  tokenAtencaoDias: 10,
  tokenCriticoDias: 3,
  postAtrasadoMin: 10,
  postPublicandoTravadoMin: 20,
  postFalhouJanelaDias: 14,
  automacaoJanelaDias: 14,
  /** Menos mensagens que isso não prova nada (pouca gente chegou ao link ainda). */
  automacaoMinMensagens: 5,
  agendaDias: 7,
  demandaClienteParadaDias: 5,
} as const;

type Severidade = 'critico' | 'atencao';
type Area = 'instagram' | 'publicacao' | 'automacoes' | 'demandas' | 'agenda';

export interface Problema {
  severidade: Severidade;
  area: Area;
  onde: string;
  problema: string;
  sugestao: string;
}

const MAX_PROBLEMAS = 60;

function dataBR(iso: string | null | undefined): string {
  if (!iso) return 'data desconhecida';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'data desconhecida' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'data desconhecida'
    : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

// ---------- verificações (funções puras, testáveis sem banco) ----------

export function problemaDeToken(username: string, venceEm: string | null, agora: number): Problema | null {
  const onde = `@${username}`;
  const venceMs = venceEm ? new Date(venceEm).getTime() : NaN;
  if (Number.isNaN(venceMs)) {
    return {
      severidade: 'atencao',
      area: 'instagram',
      onde,
      problema: 'A conta não tem data de vencimento do acesso registrada, então a renovação automática pode não estar cobrindo ela.',
      sugestao: 'Reconecte a conta em Clientes para registrar o acesso de novo.',
    };
  }
  const dias = Math.floor((venceMs - agora) / DIA_MS);
  if (venceMs <= agora) {
    return {
      severidade: 'critico',
      area: 'instagram',
      onde,
      problema: `O acesso ao Instagram venceu em ${dataBR(venceEm)}. Publicação e automações dessa conta não funcionam.`,
      sugestao: 'Reconecte a conta em Clientes.',
    };
  }
  if (dias <= LIMIARES.tokenCriticoDias) {
    return {
      severidade: 'critico',
      area: 'instagram',
      onde,
      problema: `O acesso ao Instagram vence em ${plural(Math.max(dias, 0), 'dia', 'dias')} (${dataBR(venceEm)}) e a renovação automática não deu certo.`,
      sugestao: 'Reconecte a conta em Clientes antes de vencer.',
    };
  }
  if (dias <= LIMIARES.tokenAtencaoDias) {
    return {
      severidade: 'atencao',
      area: 'instagram',
      onde,
      problema: `O acesso ao Instagram vence em ${dias} dias (${dataBR(venceEm)}). Era para ter renovado sozinho bem antes disso.`,
      sugestao: 'Confira se a renovação diária está rodando; se continuar assim, reconecte a conta.',
    };
  }
  return null;
}

interface PostFila {
  id: string;
  instagram_user_id: string;
  status: string;
  scheduled_at: string;
  created_at: string | null;
  error_message: string | null;
}

export function problemasDePosts(posts: PostFila[], usernamePorConta: Map<string, string>, agora: number): Problema[] {
  const saida: Problema[] = [];
  const onde = (p: PostFila) => `@${usernamePorConta.get(p.instagram_user_id) || p.instagram_user_id}`;

  for (const p of posts) {
    const programado = new Date(p.scheduled_at).getTime();
    if (p.status === 'failed') {
      const criado = new Date(p.created_at || p.scheduled_at).getTime();
      if (agora - criado > LIMIARES.postFalhouJanelaDias * DIA_MS) continue;
      saida.push({
        severidade: 'critico',
        area: 'publicacao',
        onde: onde(p),
        problema: `Post de ${dataHoraBR(p.scheduled_at)} falhou: ${(p.error_message || 'sem detalhe do erro').slice(0, 200)}`,
        sugestao: 'Veja o motivo, corrija e agende de novo (listar_fila_publicacao mostra o post). Ignore se já foi refeito.',
      });
    } else if (p.status === 'scheduled' && agora - programado > LIMIARES.postAtrasadoMin * MIN_MS) {
      const minutos = Math.round((agora - programado) / MIN_MS);
      saida.push({
        severidade: 'critico',
        area: 'publicacao',
        onde: onde(p),
        problema: `Post marcado para ${dataHoraBR(p.scheduled_at)} ainda não saiu (${minutos} min de atraso).`,
        sugestao: 'O cron de publicação deveria ter pegado. Confira o acesso da conta e se o job do Postgres está ativo.',
      });
    } else if (p.status === 'publishing' && agora - programado > LIMIARES.postPublicandoTravadoMin * MIN_MS) {
      saida.push({
        severidade: 'critico',
        area: 'publicacao',
        onde: onde(p),
        problema: `Post de ${dataHoraBR(p.scheduled_at)} está preso em "publicando" há mais de ${LIMIARES.postPublicandoTravadoMin} min.`,
        sugestao: 'Confira no Instagram se saiu. Se não saiu, cancele e agende de novo.',
      });
    }
  }
  return saida;
}

export interface AutomacaoAtiva {
  id: string;
  name: string;
  instagram_user_id: string;
}

export function problemaDeAutomacao(a: AutomacaoAtiva, mensagens: number, cliques: number, username: string): Problema | null {
  if (mensagens < LIMIARES.automacaoMinMensagens || cliques > 0) return null;
  return {
    severidade: 'atencao',
    area: 'automacoes',
    onde: `${a.name} (@${username})`,
    problema: `Mandou ${mensagens} mensagens iniciais nos últimos ${LIMIARES.automacaoJanelaDias} dias e ninguém clicou no link. Pode estar parando na 1ª mensagem, sem botão ou link.`,
    sugestao: 'Abra a automação (ler_automacao) e confira se a 1ª mensagem tem botão e se o link está certo.',
  };
}

export interface DemandaAberta {
  id: string;
  cliente_id: string | null;
  titulo: string | null;
  status: string;
  prazo: string | null;
  data_programada: string | null;
  atualizado_em: string | null;
}

export function problemasDeDemandas(demandas: DemandaAberta[], nomeCliente: Map<string, string>, agora: number): Problema[] {
  const hoje = new Date(agora).toISOString().slice(0, 10);
  const atrasadasPorCliente = new Map<string, DemandaAberta[]>();
  const travadasPorCliente = new Map<string, DemandaAberta[]>();
  const paradasPorCliente = new Map<string, DemandaAberta[]>();

  const juntar = (mapa: Map<string, DemandaAberta[]>, d: DemandaAberta) => {
    const chave = d.cliente_id || 'sem-cliente';
    mapa.set(chave, [...(mapa.get(chave) || []), d]);
  };

  for (const d of demandas) {
    if (d.status === 'travado') {
      juntar(travadasPorCliente, d);
      continue;
    }
    const limite = (d.prazo || d.data_programada || '').slice(0, 10);
    if (limite && limite < hoje) juntar(atrasadasPorCliente, d);
    if (d.status === 'revisao_cliente' && d.atualizado_em && agora - new Date(d.atualizado_em).getTime() > LIMIARES.demandaClienteParadaDias * DIA_MS) {
      juntar(paradasPorCliente, d);
    }
  }

  const saida: Problema[] = [];
  const nome = (id: string) => nomeCliente.get(id) || 'Sem cliente';
  const exemplos = (lista: DemandaAberta[]) =>
    lista
      .slice(0, 3)
      .map((d) => `"${(d.titulo || 'sem título').slice(0, 50)}"`)
      .join(', ');

  for (const [cid, lista] of atrasadasPorCliente) {
    saida.push({
      severidade: 'atencao',
      area: 'demandas',
      onde: nome(cid),
      problema: `${plural(lista.length, 'demanda atrasada', 'demandas atrasadas')} (ex.: ${exemplos(lista)}).`,
      sugestao: 'Veja quem é o responsável e renegocie o prazo ou destrave.',
    });
  }
  for (const [cid, lista] of travadasPorCliente) {
    saida.push({
      severidade: 'atencao',
      area: 'demandas',
      onde: nome(cid),
      problema: `${plural(lista.length, 'demanda travada', 'demandas travadas')} (ex.: ${exemplos(lista)}).`,
      sugestao: 'Descubra o que está impedindo e mova a demanda de etapa.',
    });
  }
  for (const [cid, lista] of paradasPorCliente) {
    saida.push({
      severidade: 'atencao',
      area: 'demandas',
      onde: nome(cid),
      problema: `${plural(lista.length, 'demanda esperando o cliente', 'demandas esperando o cliente')} há mais de ${LIMIARES.demandaClienteParadaDias} dias (ex.: ${exemplos(lista)}).`,
      sugestao: 'Cobre a aprovação do cliente (link_aprovacao_mes gera o link e a mensagem).',
    });
  }
  return saida;
}

export interface ClienteComConta {
  id: string;
  nome: string;
  instagram_user_id: string;
  username: string;
}

export function problemasDeAgenda(clientes: ClienteComConta[], posts: PostFila[], demandasAbertasPorCliente: Map<string, number>, agora: number): Problema[] {
  const fim = agora + LIMIARES.agendaDias * DIA_MS;
  const comAgenda = new Set(
    posts
      .filter((p) => p.status === 'scheduled' && new Date(p.scheduled_at).getTime() >= agora && new Date(p.scheduled_at).getTime() <= fim)
      .map((p) => p.instagram_user_id),
  );
  const saida: Problema[] = [];
  for (const c of clientes) {
    if (comAgenda.has(c.instagram_user_id)) continue;
    const abertas = demandasAbertasPorCliente.get(c.id) || 0;
    saida.push({
      severidade: 'atencao',
      area: 'agenda',
      onde: `${c.nome} (@${c.username})`,
      problema: `Nada agendado no Instagram para os próximos ${LIMIARES.agendaDias} dias. ${abertas > 0 ? `Há ${plural(abertas, 'demanda aberta', 'demandas abertas')} na esteira.` : 'Não há demandas abertas na esteira.'}`,
      sugestao: abertas > 0 ? 'Veja em que etapa as demandas estão e adiante o que der.' : 'Planeje o próximo ciclo de conteúdo deste cliente.',
    });
  }
  return saida;
}

// ---------- ferramenta ----------

export const FERRAMENTAS_SAUDE: Ferramenta[] = [
  {
    name: 'saude_da_operacao',
    title: 'Saúde da operação',
    description:
      'Varredura da agência atrás do que está quebrado ou prestes a quebrar: acesso do Instagram vencendo, posts que falharam/atrasaram/travaram na fila, automações ativas sem nenhum clique no link, demandas atrasadas ou travadas e clientes sem nada agendado para a próxima semana. Devolve uma lista priorizada (crítico primeiro) com o que fazer em cada item. Só leitura; não devolve tokens. Só master. Use no começo da semana ou quando algo parecer estranho.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    somenteLeitura: true,
    async executar(_args, ctx) {
      if (ctx.papel !== 'master') throw new ErroFerramenta('Só o master vê a saúde da operação. Use resumo_operacao para o seu panorama.');

      const agora = Date.now();
      const membros = await membrosDaAgencia(ctx);

      const { data: contas, error: erroContas } = await db
        .from('instagram_accounts')
        .select('id, instagram_user_id, instagram_username, token_expires_at')
        .in('user_id', membros);
      if (erroContas) throw new Error(erroContas.message);

      const usernamePorConta = new Map<string, string>();
      for (const c of contas || []) usernamePorConta.set(c.instagram_user_id, c.instagram_username || c.instagram_user_id);
      const idsInstagram = (contas || []).map((c) => c.instagram_user_id);

      const [{ data: clientes }, { data: demandas }, { data: automacoes }, postsResp] = await Promise.all([
        db.from('clientes').select('id, nome, ativo, instagram_account_id').eq('agencia_id', ctx.agenciaId).eq('ativo', true),
        db
          .from('conteudo_items')
          .select('id, cliente_id, titulo, status, prazo, data_programada, atualizado_em')
          .eq('agencia_id', ctx.agenciaId)
          .neq('status', 'publicado'),
        db.from('automations').select('id, name, active, instagram_user_id').in('user_id', membros).eq('active', true),
        idsInstagram.length
          ? db
              .from('scheduled_posts')
              .select('id, instagram_user_id, status, scheduled_at, created_at, error_message')
              .in('instagram_user_id', idsInstagram)
              .in('status', ['scheduled', 'publishing', 'failed'])
              .order('scheduled_at', { ascending: true })
              .limit(500)
          : Promise.resolve({ data: [] as PostFila[], error: null }),
      ]);
      if (postsResp.error) throw new Error(postsResp.error.message);
      const posts = (postsResp.data || []) as PostFila[];

      const problemas: Problema[] = [];

      // 1. Acesso do Instagram
      for (const c of contas || []) {
        const p = problemaDeToken(c.instagram_username || c.instagram_user_id, c.token_expires_at, agora);
        if (p) problemas.push(p);
      }

      // 2. Fila de publicação
      problemas.push(...problemasDePosts(posts, usernamePorConta, agora));

      // 3. Automações ativas sem cliques (uma contagem por automação: a lista de eventos passaria do limite de linhas da consulta)
      const desde = new Date(agora - LIMIARES.automacaoJanelaDias * DIA_MS).toISOString();
      const contar = async (automationId: string, tipo: string) => {
        const { count, error } = await db
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('automation_id', automationId)
          .eq('event_type', tipo)
          .gte('created_at', desde);
        if (error) throw new Error(error.message);
        return count || 0;
      };
      await Promise.all(
        ((automacoes || []) as AutomacaoAtiva[]).map(async (a) => {
          const mensagens = await contar(a.id, 'welcome_dm_sent');
          if (mensagens < LIMIARES.automacaoMinMensagens) return;
          const cliques = await contar(a.id, 'link_clicked');
          const p = problemaDeAutomacao(a, mensagens, cliques, usernamePorConta.get(a.instagram_user_id) || a.instagram_user_id);
          if (p) problemas.push(p);
        }),
      );

      // 4. Demandas
      const nomeCliente = new Map((clientes || []).map((c) => [c.id, c.nome]));
      problemas.push(...problemasDeDemandas((demandas || []) as DemandaAberta[], nomeCliente, agora));

      // 5. Agenda da semana (só clientes ativos com Instagram conectado)
      const contaPorId = new Map((contas || []).map((c) => [c.id, c]));
      const clientesComConta: ClienteComConta[] = [];
      for (const cl of clientes || []) {
        const conta = cl.instagram_account_id ? contaPorId.get(cl.instagram_account_id) : null;
        if (conta) clientesComConta.push({ id: cl.id, nome: cl.nome, instagram_user_id: conta.instagram_user_id, username: conta.instagram_username || conta.instagram_user_id });
      }
      const abertasPorCliente = new Map<string, number>();
      for (const d of demandas || []) if (d.cliente_id) abertasPorCliente.set(d.cliente_id, (abertasPorCliente.get(d.cliente_id) || 0) + 1);
      problemas.push(...problemasDeAgenda(clientesComConta, posts, abertasPorCliente, agora));

      // Crítico primeiro; dentro da mesma severidade, mantém a ordem das verificações.
      const ordem: Record<Severidade, number> = { critico: 0, atencao: 1 };
      problemas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

      const criticos = problemas.filter((p) => p.severidade === 'critico').length;
      const atencao = problemas.length - criticos;

      return {
        situacao: criticos > 0 ? 'critico' : atencao > 0 ? 'atencao' : 'tudo_certo',
        gerado_em: new Date(agora).toISOString(),
        resumo: {
          criticos,
          atencao,
          verificado: {
            contas_instagram: (contas || []).length,
            clientes_ativos: (clientes || []).length,
            posts_na_fila: posts.filter((p) => p.status !== 'failed').length,
            automacoes_ativas: (automacoes || []).length,
            demandas_abertas: (demandas || []).length,
          },
        },
        problemas: problemas.slice(0, MAX_PROBLEMAS),
        problemas_omitidos: Math.max(problemas.length - MAX_PROBLEMAS, 0),
      };
    },
  },
];
