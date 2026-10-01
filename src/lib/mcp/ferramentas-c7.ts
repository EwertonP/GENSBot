/**
 * Ferramentas do MCP — Onda C7: links UTM.
 *
 * Mesma lógica de `src/app/api/utm-links/route.ts` (buildUtmUrl, código curto
 * de 6 caracteres pro redirect `/r/[code]`), só que criável direto pelo
 * Claude — útil ao montar uma automação nova ou um post que precisa de um
 * link rastreável, sem depender da tela pra isso.
 */
import crypto from 'crypto';
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { str, automacaoDaAgencia, resolverConta } from './ferramentas-c3';
import { buildUtmUrl } from '../utm';
import type { ContextoMcp } from './oauth';

type Args = Record<string, unknown>;

/** Mesmo fallback usado pelos outros links gerados pelo MCP (ferramentas-c2.ts). */
function origem(ctx: ContextoMcp): string {
  return ctx.origem || 'https://allingens.vercel.app';
}

interface UtmLinkRow {
  id: string;
  name: string | null;
  base_url: string;
  generated_url: string;
  short_code: string | null;
  automation_id: string | null;
  click_count: number;
  created_at: string | null;
}

function comUrlCurta(ctx: ContextoMcp, link: UtmLinkRow) {
  return {
    id: link.id,
    nome: link.name,
    url_destino: link.base_url,
    url_com_utm: link.generated_url,
    url_curta: link.short_code ? `${origem(ctx)}/r/${link.short_code}` : null,
    cliques: link.click_count,
    automacao_id: link.automation_id,
    criado_em: link.created_at,
  };
}

export const FERRAMENTAS_C7: Ferramenta[] = [
  {
    name: 'criar_link_utm',
    title: 'Criar link UTM rastreável',
    description:
      'Gera um link rastreável (com parâmetros UTM e uma URL curta /r/código que conta cliques) pra usar numa automação, bio ou post. Mesmo gerador da tela de Links UTM.',
    inputSchema: {
      type: 'object',
      properties: {
        conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' },
        base_url: { type: 'string', description: 'URL de destino (a página real pra onde o link leva).' },
        nome: { type: 'string', description: 'Rótulo só pra identificar o link na tela (ex: "Raio-X PMPE - bio").' },
        utm_source: { type: 'string', description: 'Ex: instagram.' },
        utm_medium: { type: 'string', description: 'Ex: bio, dm, post.' },
        utm_campaign: { type: 'string', description: 'Ex: pmpe_raiox.' },
        utm_term: { type: 'string' },
        utm_content: { type: 'string' },
        automacao_id: { type: 'string', description: 'Opcional: liga o link a uma automação existente dessa mesma conta (ler_automacao/listar_automacoes).' },
      },
      required: ['conta', 'base_url'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta, 100));
      if (ctx.papel !== 'master' && conta.user_id !== ctx.membroId) throw new ErroFerramenta('Você só pode criar links nas contas que conectou.');

      const baseUrl = str(args.base_url, 2000);
      if (!baseUrl) throw new ErroFerramenta('"base_url" é obrigatória.');
      let generatedUrl: string;
      try {
        generatedUrl = buildUtmUrl(baseUrl, {
          utm_source: str(args.utm_source, 200),
          utm_medium: str(args.utm_medium, 200),
          utm_campaign: str(args.utm_campaign, 200),
          utm_term: str(args.utm_term, 200),
          utm_content: str(args.utm_content, 200),
        });
      } catch {
        throw new ErroFerramenta('"base_url" não é uma URL válida.');
      }

      const automacaoId = str(args.automacao_id, 64);
      if (automacaoId) {
        const automacao = await automacaoDaAgencia(ctx, automacaoId);
        if (automacao.instagram_user_id !== conta.instagram_user_id) {
          throw new ErroFerramenta(`A automação "${automacao.name}" é de outra conta — "automacao_id" precisa ser de uma automação de "${conta.instagram_username}".`);
        }
      }

      // Código curto de 6 caracteres pro redirect (src/app/r/[code]) — mesmo esquema e
      // mesmo retry em colisão (unique violation 23505) da rota web.
      let inserido: { data: UtmLinkRow | null; error: { message: string; code?: string } | null } | null = null;
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const shortCode = crypto.randomBytes(4).toString('hex').slice(0, 6);
        inserido = await db
          .from('utm_links')
          .insert({
            user_id: conta.user_id,
            instagram_user_id: conta.instagram_user_id,
            name: str(args.nome, 200) || null,
            base_url: baseUrl,
            utm_source: str(args.utm_source, 200) || null,
            utm_medium: str(args.utm_medium, 200) || null,
            utm_campaign: str(args.utm_campaign, 200) || null,
            utm_term: str(args.utm_term, 200) || null,
            utm_content: str(args.utm_content, 200) || null,
            generated_url: generatedUrl,
            short_code: shortCode,
            automation_id: automacaoId || null,
          })
          .select()
          .single();
        if (!inserido.error || inserido.error.code !== '23505') break;
      }
      if (!inserido || inserido.error || !inserido.data) throw new Error(inserido?.error?.message || 'Erro ao gerar o link.');

      return comUrlCurta(ctx, inserido.data);
    },
  },
  {
    name: 'listar_links_utm',
    title: 'Listar links UTM',
    description: 'Links UTM já criados numa conta (nome, URL rastreada, URL curta e quantos cliques cada um já teve). Evita gerar um link duplicado.',
    inputSchema: {
      type: 'object',
      properties: {
        conta: { type: 'string', description: 'username do Instagram.' },
        automacao_id: { type: 'string', description: 'Opcional: só os links ligados a essa automação.' },
      },
      required: ['conta'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args: Args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta, 100));
      let q = db
        .from('utm_links')
        .select('id, name, base_url, generated_url, short_code, automation_id, click_count, created_at')
        .eq('instagram_user_id', conta.instagram_user_id)
        .order('created_at', { ascending: false })
        .limit(100);
      const automacaoId = str(args.automacao_id, 64);
      if (automacaoId) q = q.eq('automation_id', automacaoId);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { conta: conta.instagram_username, links: (data || []).map((l) => comUrlCurta(ctx, l as UtmLinkRow)) };
    },
  },
];
