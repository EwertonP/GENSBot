/**
 * Ferramentas do MCP — Onda C8: ficha de um lead.
 *
 * Mesmo conteúdo da ficha que abre ao clicar numa linha da Audiência
 * (GET /api/contacts/[id]): dados do lead, respostas das perguntas, jornada
 * pelas automações e últimas mensagens — só que localizado por @ ou pelo ID
 * do Instagram (o que listar_audiencia já devolve), não pelo uuid interno da
 * ficha, que o MCP não expõe.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { resolverConta, str } from './ferramentas-c3';
import { respostasDe } from '../contact-format';

type Args = Record<string, unknown>;

const EVENT_LABELS: Record<string, string> = {
  comment: 'Comentou no post',
  welcome_dm_sent: 'Recebeu a DM inicial',
  link_clicked: 'Tocou no botão da DM',
  lead_captured: 'Deixou e-mail e telefone',
  reminder_sent: 'Recebeu um lembrete',
  sequence_sent: 'Recebeu um follow-up',
};

export const FERRAMENTAS_C8: Ferramenta[] = [
  {
    name: 'ler_contato',
    title: 'Ficha de um lead',
    description:
      'A ficha completa de uma pessoa que entrou numa automação: dados (nome, @, e-mail, telefone, tags, observações), respostas das perguntas, jornada pelas automações (comentou → recebeu DM → deixou e-mail e telefone → ...) e as últimas mensagens trocadas. Localiza pelo @ do Instagram ou pelo "instagram_id" (ambos vêm em listar_audiencia).',
    inputSchema: {
      type: 'object',
      properties: {
        conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' },
        pessoa: { type: 'string', description: '@ do Instagram (com ou sem @) ou o instagram_id (ID numérico) da pessoa, como aparece em listar_audiencia.' },
      },
      required: ['conta', 'pessoa'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args: Args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta, 100));
      const alvo = str(args.pessoa, 200).replace(/^@/, '').replace(/[%,()*\\]/g, ' ').trim();
      if (!alvo) throw new ErroFerramenta('"pessoa" é obrigatório — o @ ou o ID do Instagram da pessoa.');

      const { data: contatos, error: erroContato } = await db
        .from('contacts')
        .select('*')
        .eq('instagram_user_id', conta.instagram_user_id)
        .or(`instagram_id.eq.${alvo},username.ilike.${alvo}`)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (erroContato) throw new Error(erroContato.message);
      const contato = (contatos || [])[0];
      if (!contato) throw new ErroFerramenta(`Nenhum lead "${alvo}" encontrado em "${conta.instagram_username}". Confira em listar_audiencia.`);

      const igsid = contato.instagram_id as string;
      const [{ data: eventos }, { data: mensagens }] = await Promise.all([
        db
          .from('analytics_events')
          .select('event_type, automation_id, created_at')
          .eq('instagram_user_id', conta.instagram_user_id)
          .eq('contact_id', igsid)
          .order('created_at', { ascending: false })
          .limit(100),
        db
          .from('messages')
          .select('id, direction, text, created_at')
          .eq('instagram_user_id', conta.instagram_user_id)
          .eq('contact_id', igsid)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const automationIds = Array.from(new Set([contato.last_automation_id as string | null, ...(eventos || []).map((e) => e.automation_id)].filter(Boolean) as string[]));
      const { data: automacoes } = automationIds.length ? await db.from('automations').select('id, name').in('id', automationIds) : { data: [] as { id: string; name: string }[] };
      const nomeAutomacao = new Map((automacoes || []).map((a) => [a.id, a.name as string]));

      // Jornada agrupada por automação, mais recente primeiro — mesmo agrupamento da ficha na tela.
      const grupos = new Map<string, { automacao: string; eventos: { evento: string; quando: string | null }[] }>();
      for (const e of eventos || []) {
        const chave = e.automation_id || 'sem-automacao';
        if (!grupos.has(chave)) grupos.set(chave, { automacao: e.automation_id ? nomeAutomacao.get(e.automation_id) || 'Automação excluída' : 'Sem automação', eventos: [] });
        grupos.get(chave)!.eventos.push({ evento: EVENT_LABELS[e.event_type] || e.event_type, quando: e.created_at });
      }

      const temArroba = !!contato.username && contato.username !== igsid;
      return {
        lead: {
          nome: contato.name,
          instagram: temArroba ? `@${contato.username}` : null,
          arroba_pendente: !temArroba,
          instagram_id: igsid,
          email: contato.email,
          telefone: contato.phone,
          tags: contato.tags || [],
          observacoes: contato.notes,
          primeiro_contato: contato.first_contact_at,
          ultima_interacao: contato.last_response_at,
          origem: contato.last_automation_id ? nomeAutomacao.get(contato.last_automation_id as string) || null : null,
        },
        conta: conta.instagram_username,
        respostas: respostasDe(contato.flow_state),
        jornada: Array.from(grupos.values()),
        ultimas_mensagens: (mensagens || []).reverse().map((m) => ({ direcao: m.direction === 'outbound' ? 'enviada' : 'recebida', texto: m.text, quando: m.created_at })),
      };
    },
  },
];
