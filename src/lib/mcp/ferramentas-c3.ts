/**
 * Ferramentas do MCP — Onda C3: Automações de DM do Instagram.
 *
 * Regras (automação ativa responde gente real no Instagram):
 * - toda automação criada pelo Claude nasce PAUSADA; ativar é só pela tela;
 * - só dá para editar automação pausada (e a versão anterior vira histórico);
 * - pausar é permitido (é o lado seguro);
 * - a copy precisa ter passado pelo humanizer (copy_humanizada = true).
 * O fluxo é gerado pelo mesmo compilador do "formulário guiado" da tela.
 */
import { supabase as db } from '../supabase';
import type { ContextoMcp } from './oauth';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { buildFlowFromAdvancedForm, decompileFlow, type QualificationStep } from '../flow-engine/wizardCompiler';
import { defaultCaptureLeadConfig } from '../flow-engine/captureLeadDefaults';
import type { Automation, Followup } from '../../types/automation';

type Args = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GATILHOS = ['dm', 'comment', 'story', 'story_mention'] as const;
const MATCH = ['contains', 'exact', 'any'] as const;

function str(v: unknown, max = 1000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function lista(v: unknown, max = 20, tam = 300): string[] {
  return Array.isArray(v) ? v.map((x) => str(x, tam)).filter(Boolean).slice(0, max) : [];
}
function urlOuNull(v: unknown, campo: string): string | null {
  const s = str(v, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    return s;
  } catch {
    throw new ErroFerramenta(`"${campo}" precisa ser uma URL http(s) válida.`);
  }
}

async function membrosDaAgencia(ctx: ContextoMcp): Promise<string[]> {
  const { data } = await db.from('membros').select('id').eq('agencia_id', ctx.agenciaId);
  return (data || []).map((m) => m.id);
}

/** Contas de Instagram conectadas por membros da agência (sem token). */
async function contasDaAgencia(ctx: ContextoMcp) {
  const membros = await membrosDaAgencia(ctx);
  const { data } = await db
    .from('instagram_accounts')
    .select('id, user_id, instagram_user_id, instagram_username')
    .in('user_id', membros);
  return data || [];
}

async function resolverConta(ctx: ContextoMcp, conta: string) {
  const alvo = conta.replace(/^@/, '').toLowerCase();
  const contas = await contasDaAgencia(ctx);
  const achada = contas.find((c) => c.instagram_user_id === conta || (c.instagram_username || '').toLowerCase() === alvo);
  if (!achada) throw new ErroFerramenta(`Conta "${conta}" não está conectada ao GENSBot. Use listar_contas_instagram.`);
  return achada;
}

async function automacaoDaAgencia(ctx: ContextoMcp, id: string) {
  if (!UUID_RE.test(id)) throw new ErroFerramenta('"automacao_id" precisa ser um id (uuid) válido.');
  const membros = await membrosDaAgencia(ctx);
  const { data: a } = await db.from('automations').select('*').eq('id', id).maybeSingle();
  if (!a || !membros.includes(a.user_id)) throw new ErroFerramenta('Automação não encontrada.');
  if (ctx.papel !== 'master' && a.user_id !== ctx.membroId) throw new ErroFerramenta('Você só pode mexer nas automações que criou.');
  return a;
}

/** Converte os argumentos do Claude no formato do formulário guiado. */
export function montarFormulario(args: Args): { form: Automation; perguntas: QualificationStep[] } {
  if (args.copy_humanizada !== true) {
    throw new ErroFerramenta('Passe toda a copy (mensagens, perguntas, botões, follow-ups) pelo humanizer antes e envie copy_humanizada = true.');
  }
  const nome = str(args.nome, 120);
  if (!nome) throw new ErroFerramenta('"nome" é obrigatório.');

  const gatilhos = lista(args.gatilhos, 4, 20);
  if (gatilhos.length === 0 || gatilhos.some((g) => !GATILHOS.includes(g as (typeof GATILHOS)[number]))) {
    throw new ErroFerramenta(`"gatilhos" precisa ter um ou mais de: ${GATILHOS.join(', ')}.`);
  }
  const matchType = (str(args.tipo_correspondencia, 10) || 'contains') as Automation['match_type'];
  if (!MATCH.includes(matchType)) throw new ErroFerramenta(`"tipo_correspondencia" deve ser: ${MATCH.join(', ')}.`);
  const palavras = lista(args.palavras_chave, 20, 60);
  if (matchType !== 'any' && palavras.length === 0) throw new ErroFerramenta('Informe "palavras_chave" (ou use tipo_correspondencia "any").');

  const mensagemInicial = str(args.mensagem_inicial, 1000);
  if (!mensagemInicial) throw new ErroFerramenta('"mensagem_inicial" é obrigatória.');

  const perguntas: QualificationStep[] = (Array.isArray(args.perguntas) ? args.perguntas : []).slice(0, 10).map((p, i) => {
    const passo = (p || {}) as Args;
    const texto = str(passo.texto, 1000);
    if (!texto) throw new ErroFerramenta(`Pergunta ${i + 1}: "texto" é obrigatório.`);
    return {
      kind: 'question' as const,
      text: texto,
      buttons: lista(passo.botoes, 3, 20),
      timeoutMinutes: Math.min(Math.max(Number(passo.lembrete_apos_minutos) || 720, 5), 10080),
      reminderText: str(passo.texto_lembrete, 500) || 'Oi! Ainda estou por aqui, fico à disposição pra continuar quando você puder. 🙂',
      ...(str(passo.salvar_em_campo, 40) ? { saveReplyToField: str(passo.salvar_em_campo, 40) } : {}),
      ...(str(passo.tag_prefixo, 40) ? { saveReplyAsTagPrefix: str(passo.tag_prefixo, 40) } : {}),
    };
  });

  // Porteiro antes do material: pede e-mail/telefone e só segue com dado válido.
  // Sem posição, entra logo antes da mensagem de link (depois de todas as perguntas).
  if (args.capturar_lead) {
    const captura = args.capturar_lead as Args;
    const campos = lista(captura.campos, 2, 10);
    if (campos.length === 0 || campos.some((c) => c !== 'email' && c !== 'phone')) {
      throw new ErroFerramenta('"capturar_lead.campos" precisa ter "email" e/ou "phone".');
    }
    const posicao = captura.depois_da_pergunta === undefined ? perguntas.length : Math.min(Math.max(Number(captura.depois_da_pergunta) || 0, 0), perguntas.length);
    perguntas.splice(posicao, 0, { kind: 'capture', config: { ...defaultCaptureLeadConfig(), fields: campos as ('email' | 'phone')[] } });
  }

  const link = (args.link || {}) as Args;
  const followups: Followup[] = (Array.isArray(args.followups) ? args.followups : []).slice(0, 5).map((f, i) => {
    const fu = (f || {}) as Args;
    const texto = str(fu.texto, 1000);
    if (!texto) throw new ErroFerramenta(`Follow-up ${i + 1}: "texto" é obrigatório.`);
    return {
      id: crypto.randomUUID(),
      delay_minutes: Math.min(Math.max(Number(fu.apos_minutos) || 1440, 5), 43200),
      text: texto,
      link_url: urlOuNull(fu.link_url, `followups[${i}].link_url`),
      link_button_label: str(fu.link_botao, 20) || null,
    };
  });

  const form: Automation = {
    name: nome,
    active: false,
    triggers: gatilhos,
    keywords: palavras,
    match_type: matchType,
    specific_post_id: null,
    specific_story_id: null,
    public_replies: lista(args.respostas_publicas, 5, 300),
    welcome_dm: mensagemInicial,
    quick_reply_button: str(args.botao_inicial, 20) || null,
    link_text: str(link.texto, 1000) || null,
    link_url: urlOuNull(link.url, 'link.url'),
    link_button_label: str(link.botao, 20) || null,
    followups,
  };
  return { form, perguntas };
}

/** Palavras-chave que já disparam outra automação ATIVA na mesma conta (conflito de gatilho). */
async function conflitos(instagramUserId: string, palavras: string[], ignorarId?: string) {
  if (palavras.length === 0) return [];
  const { data } = await db.from('automations').select('id, name, keywords').eq('instagram_user_id', instagramUserId).eq('active', true);
  const minhas = new Set(palavras.map((p) => p.toLowerCase()));
  return (data || [])
    .filter((a) => a.id !== ignorarId)
    .map((a) => ({ automacao: a.name, palavras: (a.keywords || []).filter((k: string) => minhas.has(k.toLowerCase())) }))
    .filter((c) => c.palavras.length > 0);
}

const SCHEMA_FLUXO = {
  nome: { type: 'string' },
  gatilhos: {
    type: 'array',
    items: { type: 'string', enum: GATILHOS },
    description: 'dm, comment (comentário em post), story (resposta a story), story_mention.',
  },
  palavras_chave: { type: 'array', items: { type: 'string' } },
  tipo_correspondencia: { type: 'string', enum: MATCH, description: 'contains (padrão), exact ou any (qualquer mensagem).' },
  respostas_publicas: { type: 'array', items: { type: 'string' }, description: 'Respostas no comentário (sorteia uma). Só para gatilho comment.' },
  mensagem_inicial: { type: 'string', description: 'Primeira DM.' },
  botao_inicial: { type: 'string', description: 'Botão de resposta rápida da primeira DM (até 20 caracteres).' },
  perguntas: {
    type: 'array',
    maxItems: 10,
    items: {
      type: 'object',
      properties: {
        texto: { type: 'string' },
        botoes: { type: 'array', items: { type: 'string' }, maxItems: 3, description: '0 a 3 botões (até 20 caracteres). Vazio = resposta livre.' },
        lembrete_apos_minutos: { type: 'number', description: 'Padrão 720 (12h).' },
        texto_lembrete: { type: 'string' },
        salvar_em_campo: { type: 'string', description: 'email, phone, name ou um campo livre (ex.: cidade).' },
        tag_prefixo: { type: 'string', description: 'Vira tag no contato: prefixo + resposta.' },
      },
      required: ['texto'],
    },
  },
  capturar_lead: {
    type: 'object',
    properties: {
      campos: { type: 'array', items: { type: 'string', enum: ['email', 'phone'] }, description: 'Dados pedidos, na ordem.' },
      depois_da_pergunta: { type: 'number', description: 'Quantas perguntas vêm antes da captura. Padrão: todas (fica logo antes do link).' },
    },
    required: ['campos'],
    description: 'Pede e-mail/telefone pela DM, valida cada resposta e só entrega o link com os dados certos. Usa as mensagens padrão do bloco (editáveis depois no GENSBot).',
  },
  link: {
    type: 'object',
    properties: { texto: { type: 'string' }, url: { type: 'string' }, botao: { type: 'string' } },
    description: 'Mensagem final com botão de link (agenda, WhatsApp, página).',
  },
  followups: {
    type: 'array',
    maxItems: 5,
    items: {
      type: 'object',
      properties: { texto: { type: 'string' }, apos_minutos: { type: 'number' }, link_url: { type: 'string' }, link_botao: { type: 'string' } },
      required: ['texto'],
    },
  },
  copy_humanizada: { type: 'boolean', description: 'Obrigatório true: a copy já passou pelo humanizer.' },
};

export const FERRAMENTAS_C3: Ferramenta[] = [
  {
    name: 'listar_contas_instagram',
    title: 'Contas de Instagram conectadas',
    description: 'Contas de Instagram conectadas ao GENSBot pela agência (username e a qual cliente pertencem). Use o username em criar_automacao.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    somenteLeitura: true,
    async executar(_args, ctx) {
      const contas = await contasDaAgencia(ctx);
      const { data: clientes } = await db.from('clientes').select('nome, instagram_account_id').eq('agencia_id', ctx.agenciaId);
      return {
        contas: contas.map((c) => ({
          username: c.instagram_username,
          instagram_user_id: c.instagram_user_id,
          cliente: clientes?.find((cl) => cl.instagram_account_id === c.id)?.nome || null,
        })),
      };
    },
  },
  {
    name: 'listar_automacoes',
    title: 'Listar automações',
    description: 'Automações de DM (nome, conta, ativa/pausada, gatilhos, palavras-chave, versão). Membro vê só as que criou.',
    inputSchema: { type: 'object', properties: { conta: { type: 'string', description: 'username (opcional).' } }, additionalProperties: false },
    somenteLeitura: true,
    async executar(args, ctx) {
      const contas = await contasDaAgencia(ctx);
      const donos = ctx.papel === 'master' ? await membrosDaAgencia(ctx) : [ctx.membroId];
      let q = db
        .from('automations')
        .select('id, name, active, triggers, keywords, match_type, instagram_user_id, flow_version, updated_at, created_at')
        .in('user_id', donos)
        .order('updated_at', { ascending: false, nullsFirst: false });
      if (str(args.conta)) q = q.eq('instagram_user_id', (await resolverConta(ctx, str(args.conta))).instagram_user_id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return {
        automacoes: (data || []).map((a) => ({
          id: a.id,
          nome: a.name,
          status: a.active ? 'ativa' : 'pausada',
          conta: contas.find((c) => c.instagram_user_id === a.instagram_user_id)?.instagram_username || a.instagram_user_id,
          gatilhos: a.triggers,
          palavras_chave: a.keywords,
          tipo_correspondencia: a.match_type,
          versao: a.flow_version || 0,
          atualizada_em: a.updated_at || a.created_at,
        })),
      };
    },
  },
  {
    name: 'ler_automacao',
    title: 'Ler automação',
    description:
      'Mostra o passo a passo de uma automação (mensagem inicial, perguntas, link, follow-ups). Fluxos com ramificação só são editáveis pelo Canvas da tela.',
    inputSchema: { type: 'object', properties: { automacao_id: { type: 'string' } }, required: ['automacao_id'], additionalProperties: false },
    somenteLeitura: true,
    async executar(args, ctx) {
      const a = await automacaoDaAgencia(ctx, str(args.automacao_id, 64));
      const base = { id: a.id, nome: a.name, status: a.active ? 'ativa' : 'pausada', versao: a.flow_version || 0 };
      if (!a.flow_definition) {
        return {
          ...base,
          formato: 'legado',
          gatilhos: a.triggers,
          palavras_chave: a.keywords,
          mensagem_inicial: a.welcome_dm,
          link: { texto: a.link_text, url: a.link_url, botao: a.link_button_label },
          followups: a.followups,
        };
      }
      const d = decompileFlow(a.flow_definition);
      if (!d.compatible) return { ...base, formato: 'canvas', editavel_pelo_claude: false, motivo: d.reason };
      return {
        ...base,
        formato: 'guiado',
        editavel_pelo_claude: !d.condition,
        gatilhos: d.form.triggers,
        palavras_chave: d.form.keywords,
        tipo_correspondencia: d.form.match_type,
        respostas_publicas: d.form.public_replies,
        mensagem_inicial: d.form.welcome_dm,
        botao_inicial: d.form.quick_reply_button,
        perguntas: d.questions,
        link: { texto: d.form.link_text, url: d.form.link_url, botao: d.form.link_button_label },
        followups: d.form.followups,
        tem_condicao: !!d.condition,
      };
    },
  },
  {
    name: 'criar_automacao',
    title: 'Criar automação (pausada)',
    description:
      'Cria uma automação de DM no formato do formulário guiado: gatilho → mensagem inicial → perguntas → link → follow-ups. Nasce SEMPRE PAUSADA; a equipe revisa e ativa na tela de Automações. Exige copy_humanizada = true. Avisa se alguma palavra-chave já dispara outra automação ativa na conta.',
    inputSchema: {
      type: 'object',
      properties: { conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' }, ...SCHEMA_FLUXO },
      required: ['conta', 'nome', 'gatilhos', 'mensagem_inicial', 'copy_humanizada'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const conta = await resolverConta(ctx, str(args.conta, 100));
      if (ctx.papel !== 'master' && conta.user_id !== ctx.membroId) throw new ErroFerramenta('Você só pode criar automações nas contas que conectou.');
      const { form, perguntas } = montarFormulario(args);
      const flow = buildFlowFromAdvancedForm(form, perguntas);

      const { data: criada, error } = await db
        .from('automations')
        .insert({
          user_id: conta.user_id,
          instagram_user_id: conta.instagram_user_id,
          name: form.name,
          active: false,
          triggers: form.triggers,
          keywords: form.keywords,
          match_type: form.match_type,
          public_replies: form.public_replies,
          welcome_dm: form.welcome_dm,
          quick_reply_button: form.quick_reply_button,
          link_text: form.link_text,
          link_url: form.link_url,
          link_button_label: form.link_button_label,
          followups: form.followups,
          flow_definition: flow,
          flow_version: 1,
        })
        .select('id, name, active')
        .single();
      if (error) throw new Error(error.message);

      return {
        automacao_id: criada.id,
        nome: criada.name,
        status: 'pausada',
        conta: conta.instagram_username,
        passos: flow.nodes.length,
        conflitos_de_palavra_chave: await conflitos(conta.instagram_user_id, form.keywords),
        proximo_passo: 'Revisar e ativar na tela de Automações do GENSBot.',
      };
    },
  },
  {
    name: 'editar_automacao',
    title: 'Editar automação (só pausada)',
    description:
      'Reescreve uma automação PAUSADA no formato do formulário guiado (mesmos campos do criar_automacao, exceto a conta). A versão anterior vai para o histórico e pode ser restaurada na tela. Automação ativa precisa ser pausada antes (pausar_automacao). Exige copy_humanizada = true. Reescreve tudo: se a automação tem "Capturar Lead" (passo kind "capture" no ler_automacao), reenvie capturar_lead, senão a captura some.',
    inputSchema: {
      type: 'object',
      properties: { automacao_id: { type: 'string' }, ...SCHEMA_FLUXO },
      required: ['automacao_id', 'nome', 'gatilhos', 'mensagem_inicial', 'copy_humanizada'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const atual = await automacaoDaAgencia(ctx, str(args.automacao_id, 64));
      if (atual.active) throw new ErroFerramenta('A automação está ATIVA. Pause antes (pausar_automacao) para não mudar conversas em andamento sem revisão.');
      const { form, perguntas } = montarFormulario(args);
      const flow = buildFlowFromAdvancedForm(form, perguntas);
      const versaoAnterior = atual.flow_version || 0;

      // Mesmo padrão da tela: guarda o estado anterior como versão antes de sobrescrever.
      if (atual.flow_definition) {
        const { error: vErr } = await db.from('automation_versions').insert({
          automation_id: atual.id,
          user_id: atual.user_id,
          version_number: versaoAnterior,
          flow_definition: atual.flow_definition,
          label: `Antes da edição pelo Claude (via ${ctx.nome})`,
        });
        if (vErr) throw new Error(vErr.message);
      }

      const { error } = await db
        .from('automations')
        .update({
          name: form.name,
          triggers: form.triggers,
          keywords: form.keywords,
          match_type: form.match_type,
          public_replies: form.public_replies,
          welcome_dm: form.welcome_dm,
          quick_reply_button: form.quick_reply_button,
          link_text: form.link_text,
          link_url: form.link_url,
          link_button_label: form.link_button_label,
          followups: form.followups,
          flow_definition: flow,
          flow_version: versaoAnterior + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', atual.id)
        .eq('active', false);
      if (error) throw new Error(error.message);
      return {
        automacao_id: atual.id,
        nome: form.name,
        status: 'pausada',
        versao: versaoAnterior + 1,
        versao_anterior_salva: !!atual.flow_definition,
        conflitos_de_palavra_chave: await conflitos(atual.instagram_user_id, form.keywords, atual.id),
      };
    },
  },
  {
    name: 'pausar_automacao',
    title: 'Pausar automação',
    description: 'Pausa uma automação ativa (ela para de responder novas mensagens). Reativar só pela tela de Automações.',
    inputSchema: { type: 'object', properties: { automacao_id: { type: 'string' } }, required: ['automacao_id'], additionalProperties: false },
    somenteLeitura: false,
    async executar(args, ctx) {
      const a = await automacaoDaAgencia(ctx, str(args.automacao_id, 64));
      if (!a.active) return { automacao_id: a.id, nome: a.name, status: 'pausada', mudou: false };
      const { error } = await db.from('automations').update({ active: false, updated_at: new Date().toISOString() }).eq('id', a.id);
      if (error) throw new Error(error.message);
      return { automacao_id: a.id, nome: a.name, status: 'pausada', mudou: true };
    },
  },
];
