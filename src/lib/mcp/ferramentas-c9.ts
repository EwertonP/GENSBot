/**
 * Ferramentas do MCP — Onda C9: fila de publicação.
 *
 * Só leitura (por enquanto — agendar um post a partir de uma demanda aprovada
 * fica pra uma próxima etapa; publicar envolve upload de mídia e a Graph API,
 * fora do escopo de uma ferramenta simples de consulta). Mostra o que está
 * agendado, publicando ou falhou — mesma fila que `src/app/api/cron/publish-scheduled`
 * processa — e, quando o post veio de uma demanda da esteira, o título dela.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { resolverConta, str } from './ferramentas-c3';

type Args = Record<string, unknown>;
const STATUS = ['scheduled', 'publishing', 'published', 'failed'] as const;
const STATUS_PT: Record<string, string> = { scheduled: 'agendado', publishing: 'publicando', published: 'publicado', failed: 'falhou' };

function parseData(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const FERRAMENTAS_C9: Ferramenta[] = [
  {
    name: 'listar_fila_publicacao',
    title: 'Fila de publicação',
    description:
      'Posts agendados, publicando ou que falharam numa conta — a mesma fila que o cron de publicação processa. Padrão: só o que ainda não publicou (agendado/publicando/falhou); passe "status" pra ver outro conjunto, inclusive "published". Quando o post veio de uma demanda da esteira, devolve o título dela.',
    inputSchema: {
      type: 'object',
      properties: {
        conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' },
        status: { type: 'array', items: { type: 'string', enum: STATUS }, description: 'Padrão: scheduled, publishing e failed (tudo que ainda não publicou).' },
        desde: { type: 'string', description: 'Data ISO — filtra scheduled_at. Padrão: sem limite.' },
        ate: { type: 'string', description: 'Data ISO — filtra scheduled_at.' },
        limite: { type: 'number', description: 'Máx. 200. Padrão 50.' },
      },
      required: ['conta'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args: Args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta, 100));
      const limite = Math.min(Math.max(Math.trunc(Number(args.limite)) || 50, 1), 200);

      const statusArray = Array.isArray(args.status) ? (args.status as unknown[]).map((s) => str(s, 20)) : [];
      const statusInvalido = statusArray.find((s) => !STATUS.includes(s as (typeof STATUS)[number]));
      if (statusInvalido) throw new ErroFerramenta(`"status" inválido: "${statusInvalido}". Use: ${STATUS.join(', ')}.`);
      const statusFiltro = statusArray.length > 0 ? statusArray : ['scheduled', 'publishing', 'failed'];

      const desde = parseData(args.desde);
      const ate = parseData(args.ate);
      if (args.desde !== undefined && !desde) throw new ErroFerramenta('"desde" não é uma data válida.');
      if (args.ate !== undefined && !ate) throw new ErroFerramenta('"ate" não é uma data válida.');

      let q = db
        .from('scheduled_posts')
        .select('id, media_type, caption, scheduled_at, status, approval_status, error_message, published_at, location_name, created_at')
        .eq('instagram_user_id', conta.instagram_user_id)
        .in('status', statusFiltro)
        .order('scheduled_at', { ascending: true })
        .limit(limite);
      if (desde) q = q.gte('scheduled_at', desde);
      if (ate) q = q.lte('scheduled_at', ate);

      const { data: posts, error } = await q;
      if (error) throw new Error(error.message);

      const ids = (posts || []).map((p) => p.id);
      const { data: demandas } = ids.length ? await db.from('conteudo_items').select('titulo, scheduled_post_id').in('scheduled_post_id', ids) : { data: [] as { titulo: string; scheduled_post_id: string }[] };
      const tituloPorPost = new Map((demandas || []).map((d) => [d.scheduled_post_id, d.titulo]));

      return {
        conta: conta.instagram_username,
        total: posts?.length || 0,
        posts: (posts || []).map((p) => ({
          id: p.id,
          tipo_midia: p.media_type,
          legenda: p.caption,
          agendado_para: p.scheduled_at,
          status: STATUS_PT[p.status] || p.status,
          status_aprovacao: p.approval_status,
          erro: p.error_message,
          publicado_em: p.published_at,
          localizacao: p.location_name,
          demanda: tituloPorPost.get(p.id) || null,
        })),
      };
    },
  },
];
