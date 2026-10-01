/**
 * Ferramentas do MCP — Onda C5: Métricas de automação.
 *
 * Só leitura. Mesmo funil já mostrado no dashboard da tela (comentário → DM
 * inicial → clique no link → lead capturado), por automação e por período.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { contasDaAgencia, resolverConta, membrosDaAgencia } from './ferramentas-c3';
import type { ContextoMcp } from './oauth';

type Args = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA_MS = 24 * 60 * 60 * 1000;

function str(v: unknown, max = 60): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** "2026-09-01" ou vazio → Date (ou null se inválida). Aceita qualquer formato que o JS entenda. */
function parseData(v: unknown): Date | null {
  const s = str(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pct(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}

interface Funil {
  comentarios: number;
  mensagens_iniciais: number;
  cliques_no_link: number;
  leads_capturados: number;
}

const funilVazio = (): Funil => ({ comentarios: 0, mensagens_iniciais: 0, cliques_no_link: 0, leads_capturados: 0 });

function somarEvento(funil: Funil, tipo: string) {
  if (tipo === 'comment') funil.comentarios++;
  else if (tipo === 'welcome_dm_sent') funil.mensagens_iniciais++;
  else if (tipo === 'link_clicked') funil.cliques_no_link++;
  else if (tipo === 'lead_captured') funil.leads_capturados++;
}

/** Mesmas três taxas do funil do dashboard, mais entrada→lead (o gatilho pode ser comentário ou DM direta, por isso o maior dos dois). */
function taxasDoFunil(f: Funil) {
  const entradas = Math.max(f.comentarios, f.mensagens_iniciais);
  return {
    comentario_para_dm: pct(f.mensagens_iniciais, f.comentarios),
    dm_para_clique: pct(f.cliques_no_link, f.mensagens_iniciais),
    clique_para_lead: pct(f.leads_capturados, f.cliques_no_link),
    entrada_para_lead: pct(f.leads_capturados, entradas),
  };
}

/** Automações que a agência enxerga numa conta — mesma regra de permissão do listar_automacoes (membro só vê as que criou). */
async function automacoesVisiveis(ctx: ContextoMcp, instagramUserId?: string) {
  const donos = ctx.papel === 'master' ? await membrosDaAgencia(ctx) : [ctx.membroId];
  let q = db.from('automations').select('id, name, active, user_id, instagram_user_id').in('user_id', donos);
  if (instagramUserId) q = q.eq('instagram_user_id', instagramUserId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

/** Uma automação específica, já checando se a agência (e o membro, quando não é master) pode vê-la. */
async function automacaoVisivel(ctx: ContextoMcp, id: string) {
  if (!UUID_RE.test(id)) throw new ErroFerramenta('"automacao_id" precisa ser um id (uuid) válido.');
  const donos = ctx.papel === 'master' ? await membrosDaAgencia(ctx) : [ctx.membroId];
  const { data: a } = await db.from('automations').select('id, name, active, user_id, instagram_user_id').eq('id', id).maybeSingle();
  if (!a || !donos.includes(a.user_id)) throw new ErroFerramenta('Automação não encontrada.');
  return a;
}

/** Contagem de leads e leads completos (e-mail + telefone) por automação — uma query, agregada em memória como o resto do MCP já faz. */
async function auditoriaDeLeads(automationIds: string[]) {
  const resultado = new Map<string, { leads_na_audiencia: number; com_email_e_telefone: number }>();
  if (automationIds.length === 0) return resultado;
  const { data, error } = await db.from('contacts').select('last_automation_id, email, phone').in('last_automation_id', automationIds);
  if (error) throw new Error(error.message);
  for (const c of data || []) {
    const id = c.last_automation_id as string;
    const entry = resultado.get(id) || { leads_na_audiencia: 0, com_email_e_telefone: 0 };
    entry.leads_na_audiencia++;
    if (c.email && c.phone) entry.com_email_e_telefone++;
    resultado.set(id, entry);
  }
  return resultado;
}

export const FERRAMENTAS_C5: Ferramenta[] = [
  {
    name: 'metricas_automacao',
    title: 'Métricas de automação',
    description:
      'Funil de uma automação (comentários → DM inicial → clique no link → lead capturado), com taxas de conversão entre cada etapa, num período. Sem "automacao_id", lista o ranking de todas as automações da conta por leads capturados — mesmo dado do painel de métricas da tela. "leads_na_audiencia" e "com_email_e_telefone" contam quem está hoje na Audiência com esta automação como origem (não é afetado pelo período).',
    inputSchema: {
      type: 'object',
      properties: {
        automacao_id: { type: 'string', description: 'Uma automação específica (ler_automacao/listar_automacoes). Sem isso, lista o ranking da conta.' },
        conta: { type: 'string', description: 'username do Instagram — obrigatório quando "automacao_id" não é informado.' },
        desde: { type: 'string', description: 'Data ISO (ex: "2026-09-01"). Padrão: 30 dias atrás.' },
        ate: { type: 'string', description: 'Data ISO. Padrão: agora.' },
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args: Args, ctx) {
      const automacaoId = str(args.automacao_id, 40);
      const conta = str(args.conta, 60);
      const agora = new Date();
      const desde = parseData(args.desde) || new Date(agora.getTime() - 30 * DIA_MS);
      const ate = parseData(args.ate) || agora;
      if (desde > ate) throw new ErroFerramenta('"desde" precisa ser antes de "ate".');
      const periodo = { desde: desde.toISOString(), ate: ate.toISOString() };

      if (automacaoId) {
        const a = await automacaoVisivel(ctx, automacaoId);

        const { data: eventos, error } = await db
          .from('analytics_events')
          .select('event_type')
          .eq('automation_id', a.id)
          .gte('created_at', periodo.desde)
          .lte('created_at', periodo.ate);
        if (error) throw new Error(error.message);

        const funil = funilVazio();
        for (const e of eventos || []) somarEvento(funil, e.event_type);

        const leads = await auditoriaDeLeads([a.id]);
        const contas = await contasDaAgencia(ctx);

        return {
          automacao: {
            id: a.id,
            nome: a.name,
            status: a.active ? 'ativa' : 'pausada',
            conta: contas.find((c) => c.instagram_user_id === a.instagram_user_id)?.instagram_username || a.instagram_user_id,
          },
          periodo,
          funil,
          taxas_de_conversao_percent: taxasDoFunil(funil),
          ...(leads.get(a.id) || { leads_na_audiencia: 0, com_email_e_telefone: 0 }),
        };
      }

      if (!conta) throw new ErroFerramenta('Informe "automacao_id" (uma automação) ou "conta" (ranking de todas as automações dela).');
      const contaResolvida = await resolverConta(ctx, conta);
      const automacoes = await automacoesVisiveis(ctx, contaResolvida.instagram_user_id);
      if (automacoes.length === 0) return { conta: contaResolvida.instagram_username, periodo, automacoes: [] };

      const ids = automacoes.map((a) => a.id);
      const { data: eventos, error } = await db
        .from('analytics_events')
        .select('automation_id, event_type')
        .in('automation_id', ids)
        .gte('created_at', periodo.desde)
        .lte('created_at', periodo.ate);
      if (error) throw new Error(error.message);

      const funis = new Map<string, Funil>();
      for (const e of eventos || []) {
        if (!e.automation_id) continue;
        const f = funis.get(e.automation_id) || funilVazio();
        somarEvento(f, e.event_type);
        funis.set(e.automation_id, f);
      }
      const leadsPorAutomacao = await auditoriaDeLeads(ids);

      const ranking = automacoes
        .map((a) => {
          const funil = funis.get(a.id) || funilVazio();
          return {
            id: a.id,
            nome: a.name,
            status: a.active ? 'ativa' : 'pausada',
            funil,
            taxas_de_conversao_percent: taxasDoFunil(funil),
            ...(leadsPorAutomacao.get(a.id) || { leads_na_audiencia: 0, com_email_e_telefone: 0 }),
          };
        })
        .sort((x, y) => y.funil.leads_capturados - x.funil.leads_capturados || y.funil.cliques_no_link - x.funil.cliques_no_link);

      return { conta: contaResolvida.instagram_username, periodo, automacoes: ranking };
    },
  },
];
