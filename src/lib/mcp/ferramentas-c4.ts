/**
 * Ferramentas do MCP — Onda C4: Audiência (leads que entraram nas automações).
 *
 * Só leitura. Entrega a mesma coisa que o "Exportar CSV" da tela de Audiência:
 * mesmas colunas, uma coluna por resposta de pergunta, mesmos filtros.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { resolverConta } from './ferramentas-c3';
import { respostasDe } from '../contact-format';

type Args = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POR_PAGINA = 500;

function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

interface LinhaContato {
  instagram_id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[] | null;
  flow_state: unknown;
  last_response_at: string | null;
  first_contact_at: string | null;
  origem: { name: string | null } | null;
}

/** Mesmas colunas do CSV da tela (contacts-tab.tsx), com as respostas entre as tags e as observações. */
export function linhasDaAudiencia(contatos: LinhaContato[]) {
  const respostas = contatos.map((c) => respostasDe(c.flow_state));
  const campos = Array.from(new Set(respostas.flatMap((r) => Object.keys(r)))).sort();
  const linhas: Record<string, string>[] = contatos.map((c, i) => ({
    nome: c.name || '',
    instagram: c.username && c.username !== c.instagram_id ? `@${c.username}` : '',
    email: c.email || '',
    telefone: c.phone || '',
    origem: c.origem?.name || '',
    tags: (c.tags || []).join('; '),
    ...Object.fromEntries(campos.map((campo) => [campo, respostas[i][campo] || ''])),
    observacoes: c.notes || '',
    ultima_interacao: c.last_response_at || '',
    primeiro_contato: c.first_contact_at || '',
    instagram_id: c.instagram_id,
  }));
  return { campos, linhas };
}

export function paraCsv(linhas: Record<string, string>[]): string {
  if (linhas.length === 0) return '';
  const headers = Object.keys(linhas[0]);
  const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...linhas.map((l) => headers.map((h) => cel(l[h])).join(','))].join('\n');
}

export const FERRAMENTAS_C4: Ferramenta[] = [
  {
    name: 'listar_audiencia',
    title: 'Listar audiência (leads)',
    description:
      'Leads que entraram nas automações de uma conta de Instagram — o mesmo conteúdo do "Exportar CSV" da tela de Audiência: nome, @, e-mail, telefone, automação de origem, tags, uma coluna por resposta de pergunta (ex.: cargo), observações e datas. Filtra por busca, tag, automação e "só quem deixou e-mail e telefone". Paginado (até 500 por página); use formato "csv" para receber o texto pronto da planilha.',
    inputSchema: {
      type: 'object',
      properties: {
        conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' },
        busca: { type: 'string', description: 'Trecho de nome, @, e-mail ou telefone.' },
        tag: { type: 'string' },
        automacao_id: { type: 'string', description: 'Só quem entrou por essa automação (listar_automacoes).' },
        so_com_contato: { type: 'boolean', description: 'true = só leads com e-mail E telefone.' },
        pagina: { type: 'number', description: 'Padrão 1.' },
        por_pagina: { type: 'number', description: 'Padrão 200, máximo 500.' },
        formato: { type: 'string', enum: ['json', 'csv'], description: 'json (padrão) ou csv.' },
      },
      required: ['conta'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args: Args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta));
      const pagina = Math.max(1, Math.floor(Number(args.pagina) || 1));
      const porPagina = Math.min(MAX_POR_PAGINA, Math.max(1, Math.floor(Number(args.por_pagina) || 200)));
      const formato = args.formato === 'csv' ? 'csv' : 'json';

      // Mesma regra da tela: só quem de fato entrou numa automação. Tipo frouxo de
      // propósito: encadear os filtros opcionais no builder tipado estoura o TS (TS2589).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db
        .from('contacts')
        .select(
          'instagram_id, name, username, email, phone, notes, tags, flow_state, last_response_at, first_contact_at, origem:automations!contacts_last_automation_id_fkey(name)',
          { count: 'exact' },
        )
        .eq('instagram_user_id', conta.instagram_user_id)
        .not('last_automation_id', 'is', null)
        .order('updated_at', { ascending: false })
        .range((pagina - 1) * porPagina, pagina * porPagina - 1);

      const tag = str(args.tag, 60);
      if (tag) q = q.contains('tags', [tag]);

      const automacaoId = str(args.automacao_id, 40);
      if (automacaoId) {
        if (!UUID_RE.test(automacaoId)) throw new ErroFerramenta('"automacao_id" precisa ser um id (uuid) válido.');
        q = q.eq('last_automation_id', automacaoId);
      }

      if (args.so_com_contato === true) q = q.not('email', 'is', null).not('phone', 'is', null);

      // Igual à busca da tela: tira o que quebraria o or() do PostgREST.
      const busca = str(args.busca, 80).replace(/[%,()*\\]/g, ' ').replace(/^@/, '').trim();
      if (busca) {
        const digitos = busca.replace(/\D/g, '');
        const clausulas = [`name.ilike.%${busca}%`, `username.ilike.%${busca}%`, `email.ilike.%${busca}%`];
        if (digitos.length >= 4) clausulas.push(`phone.ilike.%${digitos}%`);
        q = q.or(clausulas.join(','));
      }

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);

      const { campos, linhas } = linhasDaAudiencia((data || []) as unknown as LinhaContato[]);
      const total = count || 0;
      const base = {
        conta: conta.instagram_username,
        total,
        pagina,
        total_paginas: Math.max(1, Math.ceil(total / porPagina)),
        colunas_de_respostas: campos,
      };
      return formato === 'csv' ? { ...base, csv: paraCsv(linhas) } : { ...base, leads: linhas };
    },
  },
];
