/**
 * Ferramentas do MCP — Onda C2: Aprovações e Formulários.
 *
 * Aprovações: o Claude prepara link e mensagem, mas NUNCA envia ao cliente.
 * Formulários: nascem despublicados; publicar é decisão da equipe, na tela.
 * Formulários não têm agencia_id: pertencem à agência pelo autor (membro) ou pelo cliente.
 */
import { supabase as db } from '../supabase';
import type { ContextoMcp } from './oauth';
import { ehResponsavel, gerarLinkWhatsAppAprovacao, gerarMensagemAprovacao } from '../conteudo';
import { ErroFerramenta, type Ferramenta } from './ferramentas';

type Args = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TIPOS_CAMPO = ['welcome', 'text', 'textarea', 'email', 'whatsapp', 'choice', 'rating', 'nps', 'file', 'terms', 'thank_you'] as const;
type TipoCampo = (typeof TIPOS_CAMPO)[number];

function idArg(args: Args, campo: string, obrigatorio = true): string | null {
  const v = args[campo];
  if (v === undefined || v === null || v === '') {
    if (obrigatorio) throw new ErroFerramenta(`"${campo}" é obrigatório.`);
    return null;
  }
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new ErroFerramenta(`"${campo}" precisa ser um id (uuid) válido.`);
  return v;
}

function origem(ctx: ContextoMcp) {
  return ctx.origem || 'https://allingens.vercel.app';
}

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Quando a demanda entrou em revisao_cliente (último evento de status no histórico). */
export function entrouEmAprovacao(historico: unknown): string | null {
  if (!Array.isArray(historico)) return null;
  for (let i = historico.length - 1; i >= 0; i--) {
    const e = historico[i] as { tipo?: string; para_status?: string; criado_em?: string };
    if (e?.tipo === 'status' && e.para_status === 'revisao_cliente') return e.criado_em || null;
  }
  return null;
}

async function membrosDaAgencia(ctx: ContextoMcp): Promise<string[]> {
  const { data } = await db.from('membros').select('id').eq('agencia_id', ctx.agenciaId);
  return (data || []).map((m) => m.id);
}

async function formularioDaAgencia(ctx: ContextoMcp, formId: string) {
  const { data: form } = await db
    .from('forms')
    .select('id, user_id, cliente_id, slug, titulo, descricao, publicado, clientes(agencia_id, nome)')
    .eq('id', formId)
    .maybeSingle();
  if (!form) throw new ErroFerramenta('Formulário não encontrado.');
  const membros = await membrosDaAgencia(ctx);
  const cliente = form.clientes as unknown as { agencia_id: string; nome: string } | null;
  const daAgencia = membros.includes(form.user_id) || cliente?.agencia_id === ctx.agenciaId;
  if (!daAgencia) throw new ErroFerramenta('Formulário não encontrado.');
  if (ctx.papel !== 'master' && form.user_id !== ctx.membroId) {
    throw new ErroFerramenta('Você só pode mexer nos formulários que criou.');
  }
  return { ...form, cliente_nome: cliente?.nome || null };
}

/** Normaliza a lista de campos vinda do Claude para o formato de form_fields. */
export function montarCampos(formId: string, campos: unknown): Record<string, unknown>[] {
  if (!Array.isArray(campos) || campos.length === 0) throw new ErroFerramenta('"campos" precisa ter pelo menos uma pergunta.');
  if (campos.length > 40) throw new ErroFerramenta('Máximo de 40 campos por formulário.');

  const lista = campos.map((c, i) => {
    const campo = (c || {}) as Args;
    const tipo = String(campo.tipo || 'text') as TipoCampo;
    if (!TIPOS_CAMPO.includes(tipo)) throw new ErroFerramenta(`Campo ${i + 1}: tipo deve ser um de ${TIPOS_CAMPO.join(', ')}.`);
    const label = typeof campo.label === 'string' ? campo.label.trim().slice(0, 300) : '';
    if (!label) throw new ErroFerramenta(`Campo ${i + 1}: "label" (a pergunta) é obrigatório.`);
    const opcoesBrutas = Array.isArray(campo.opcoes) ? campo.opcoes : [];
    if (tipo === 'choice' && opcoesBrutas.length < 2) throw new ErroFerramenta(`Campo ${i + 1}: escolha precisa de ao menos 2 opções.`);
    return {
      tipo,
      label,
      descricao: typeof campo.descricao === 'string' ? campo.descricao.slice(0, 1000) : null,
      placeholder: typeof campo.placeholder === 'string' ? campo.placeholder.slice(0, 200) : null,
      obrigatorio: tipo === 'welcome' || tipo === 'thank_you' ? true : campo.obrigatorio !== false,
      opcoes: opcoesBrutas.map((o) => ({
        id: crypto.randomUUID(),
        label: String(typeof o === 'object' && o ? (o as Args).label : o).slice(0, 200),
      })),
    };
  });

  // Todo formulário abre com boas-vindas e fecha com agradecimento, como os criados pela tela.
  if (lista[0].tipo !== 'welcome') {
    lista.unshift({ tipo: 'welcome', label: 'Bem-vindo(a)!', descricao: 'Leva só um minutinho.', placeholder: null, obrigatorio: true, opcoes: [] });
  }
  if (lista[lista.length - 1].tipo !== 'thank_you') {
    lista.push({ tipo: 'thank_you', label: 'Muito obrigado!', descricao: 'Recebemos suas respostas.', placeholder: null, obrigatorio: true, opcoes: [] });
  }

  return lista.map((c, ordem) => ({ ...c, id: crypto.randomUUID(), form_id: formId, ordem, logica_pulo: [], validacoes: {} }));
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const SCHEMA_CAMPOS = {
  type: 'array',
  maxItems: 40,
  description: 'Perguntas em ordem. Boas-vindas e agradecimento são adicionados sozinhos se faltarem.',
  items: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: TIPOS_CAMPO },
      label: { type: 'string', description: 'A pergunta (ou título da tela de boas-vindas/agradecimento).' },
      descricao: { type: 'string' },
      placeholder: { type: 'string' },
      obrigatorio: { type: 'boolean' },
      opcoes: { type: 'array', items: { type: 'string' }, description: 'Obrigatório para tipo "choice".' },
    },
    required: ['tipo', 'label'],
  },
};

export const FERRAMENTAS_C2: Ferramenta[] = [
  // ---------------- Aprovações ----------------
  {
    name: 'listar_pendentes_aprovacao',
    title: 'Pendentes de aprovação do cliente',
    description:
      'Demandas paradas em "revisao_cliente", com há quantos dias estão esperando e o link de aprovação. Use para saber quem cobrar. Membro vê só as dele.',
    inputSchema: { type: 'object', properties: { cliente_id: { type: 'string' } }, additionalProperties: false },
    somenteLeitura: true,
    async executar(args, ctx) {
      const clienteId = idArg(args, 'cliente_id', false);
      let q = db
        .from('conteudo_items')
        .select('id, titulo, tipo, cliente_id, token_aprovacao, historico_atividades, atualizado_em, responsavel_id, co_responsaveis_ids, editor_id, cliente:clientes(nome)')
        .eq('agencia_id', ctx.agenciaId)
        .eq('status', 'revisao_cliente');
      if (clienteId) q = q.eq('cliente_id', clienteId);
      if (ctx.papel !== 'master') q = q.or(`responsavel_id.eq.${ctx.membroId},co_responsaveis_ids.cs.{${ctx.membroId}},editor_id.eq.${ctx.membroId}`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const pendentes = (data || [])
        .map((d) => {
          const desde = entrouEmAprovacao(d.historico_atividades) || d.atualizado_em;
          return {
            demanda_id: d.id,
            titulo: d.titulo,
            tipo: d.tipo,
            cliente: (d.cliente as unknown as { nome: string } | null)?.nome || null,
            aguardando_desde: desde,
            dias_esperando: diasDesde(desde),
            link_aprovacao: `${origem(ctx)}/aprovacao/${d.token_aprovacao}`,
          };
        })
        .sort((a, b) => (b.dias_esperando ?? 0) - (a.dias_esperando ?? 0));
      return { total: pendentes.length, pendentes };
    },
  },
  {
    name: 'preparar_aprovacao',
    title: 'Preparar mensagem de aprovação',
    description:
      'Gera o link de aprovação de uma demanda, o texto padrão da mensagem e o link do WhatsApp já preenchido para o contato do cliente. NÃO envia nada: devolve para a equipe enviar. Para o cliente conseguir aprovar, a demanda precisa estar em "revisao_cliente" (use mover_etapa).',
    inputSchema: {
      type: 'object',
      properties: { demanda_id: { type: 'string' } },
      required: ['demanda_id'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      const id = idArg(args, 'demanda_id')!;
      const { data: d } = await db
        .from('conteudo_items')
        .select('id, titulo, status, token_aprovacao, cliente_id, responsavel_id, co_responsaveis_ids, editor_id, cliente:clientes(nome)')
        .eq('id', id)
        .eq('agencia_id', ctx.agenciaId)
        .maybeSingle();
      if (!d) throw new ErroFerramenta('Demanda não encontrada nesta agência.');
      if (ctx.papel !== 'master' && !ehResponsavel(d, ctx.membroId) && d.editor_id !== ctx.membroId) {
        throw new ErroFerramenta('Você só pode preparar aprovação das suas demandas.');
      }
      const nomeCliente = (d.cliente as unknown as { nome: string } | null)?.nome || 'Cliente';

      const { data: contatos } = await db
        .from('cliente_contatos')
        .select('nome, telefone, e_grupo_whatsapp')
        .eq('cliente_id', d.cliente_id)
        .eq('agencia_id', ctx.agenciaId);
      // Prioriza o grupo de WhatsApp do cliente, depois o primeiro contato com telefone.
      const contato = (contatos || []).find((c) => c.e_grupo_whatsapp && c.telefone) || (contatos || []).find((c) => c.telefone) || null;

      const base = { nomeCliente, tituloPost: d.titulo || 'Conteúdo do mês', token: d.token_aprovacao, urlOrigem: origem(ctx) };
      const { texto, linkAprovacao } = gerarMensagemAprovacao(base);
      return {
        demanda: d.titulo,
        cliente: nomeCliente,
        etapa_atual: d.status,
        pronta_para_cliente: d.status === 'revisao_cliente',
        aviso: d.status === 'revisao_cliente' ? null : 'A demanda não está em "revisao_cliente": o cliente ainda não consegue aprovar pelo link.',
        link_aprovacao: linkAprovacao,
        mensagem: texto,
        contato: contato ? { nome: contato.nome, grupo: contato.e_grupo_whatsapp } : null,
        link_whatsapp: gerarLinkWhatsAppAprovacao({ ...base, telefone: contato?.telefone || null }),
      };
    },
  },
  {
    name: 'link_aprovacao_mes',
    title: 'Link de aprovação do feed do mês',
    description: 'Link público para o cliente aprovar a grade completa do feed do mês de uma vez (só master). Não envia nada.',
    inputSchema: { type: 'object', properties: { cliente_id: { type: 'string' } }, required: ['cliente_id'], additionalProperties: false },
    somenteLeitura: true,
    async executar(args, ctx) {
      if (ctx.papel !== 'master') throw new ErroFerramenta('Só administradores (master) geram o link do feed do mês.');
      const id = idArg(args, 'cliente_id')!;
      const { data: c } = await db.from('clientes').select('nome, token_aprovacao_mes').eq('id', id).eq('agencia_id', ctx.agenciaId).maybeSingle();
      if (!c) throw new ErroFerramenta('Cliente não encontrado nesta agência.');
      return { cliente: c.nome, link: `${origem(ctx)}/aprovacao/feed/${c.token_aprovacao_mes}` };
    },
  },

  // ---------------- Formulários ----------------
  {
    name: 'listar_formularios',
    title: 'Listar formulários',
    description: 'Formulários da agência com status (publicado ou rascunho), link público e total de respostas. Membro vê só os que criou.',
    inputSchema: { type: 'object', properties: { cliente_id: { type: 'string' } }, additionalProperties: false },
    somenteLeitura: true,
    async executar(args, ctx) {
      const clienteId = idArg(args, 'cliente_id', false);
      const membros = await membrosDaAgencia(ctx);
      let q = db
        .from('forms')
        .select('id, titulo, slug, publicado, cliente_id, user_id, created_at, clientes(nome)')
        .in('user_id', ctx.papel === 'master' ? membros : [ctx.membroId])
        .order('created_at', { ascending: false });
      if (clienteId) q = q.eq('cliente_id', clienteId);
      const { data: forms, error } = await q;
      if (error) throw new Error(error.message);

      const ids = (forms || []).map((f) => f.id);
      const contagem: Record<string, number> = {};
      if (ids.length) {
        const { data: resp } = await db.from('form_responses').select('form_id').in('form_id', ids);
        for (const r of resp || []) contagem[r.form_id] = (contagem[r.form_id] || 0) + 1;
      }
      return {
        formularios: (forms || []).map((f) => ({
          id: f.id,
          titulo: f.titulo,
          cliente: (f.clientes as unknown as { nome: string } | null)?.nome || null,
          status: f.publicado ? 'publicado' : 'rascunho',
          link_publico: `${origem(ctx)}/f/${f.slug}`,
          respostas: contagem[f.id] || 0,
          criado_em: f.created_at,
        })),
      };
    },
  },
  {
    name: 'criar_formulario',
    title: 'Criar formulário',
    description:
      'Cria um formulário (briefing de cliente novo, pesquisa de satisfação, captação de leads…) em RASCUNHO, com as perguntas informadas. Tipos: welcome, text, textarea, email, whatsapp, choice (com opcoes), rating, nps, file, terms, thank_you. Publicar fica com a equipe, na tela de Formulários.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        descricao: { type: 'string' },
        cliente_id: { type: 'string', description: 'Opcional: usa a cor do cliente no tema.' },
        campos: SCHEMA_CAMPOS,
      },
      required: ['titulo', 'campos'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const titulo = typeof args.titulo === 'string' ? args.titulo.trim().slice(0, 200) : '';
      if (!titulo) throw new ErroFerramenta('"titulo" é obrigatório.');
      const clienteId = idArg(args, 'cliente_id', false);
      let cor = '#d8ff3c';
      if (clienteId) {
        const { data: c } = await db.from('clientes').select('cor').eq('id', clienteId).eq('agencia_id', ctx.agenciaId).maybeSingle();
        if (!c) throw new ErroFerramenta('Cliente não encontrado nesta agência.');
        if (c.cor) cor = c.cor;
      }

      const formId = crypto.randomUUID();
      const campos = montarCampos(formId, args.campos); // valida antes de gravar qualquer coisa
      const slug = `${slugify(titulo) || 'formulario'}-${crypto.randomUUID().slice(0, 6)}`;

      const { error: formError } = await db.from('forms').insert({
        id: formId,
        user_id: ctx.membroId,
        cliente_id: clienteId,
        slug,
        titulo,
        descricao: typeof args.descricao === 'string' ? args.descricao.slice(0, 1000) : null,
        publicado: false,
        tema_config: { cor_primaria: cor, cor_fundo: '#09090b', cor_texto: '#f4f4f5', cor_card: '#141417', modo: 'dark' },
      });
      if (formError) throw new Error(formError.message);

      const { error: camposError } = await db.from('form_fields').insert(campos);
      if (camposError) {
        await db.from('forms').delete().eq('id', formId);
        throw new Error(camposError.message);
      }
      return {
        form_id: formId,
        titulo,
        status: 'rascunho',
        perguntas: campos.length,
        link_publico_apos_publicar: `${origem(ctx)}/f/${slug}`,
        proximo_passo: 'Revisar e publicar na tela de Formulários do GENSBot.',
      };
    },
  },
  {
    name: 'editar_campos_formulario',
    title: 'Editar perguntas do formulário',
    description:
      'Substitui TODAS as perguntas de um formulário pela lista informada (mesmo formato do criar_formulario). Recusado se o formulário já tiver respostas, para não embaralhar os dados coletados.',
    inputSchema: {
      type: 'object',
      properties: { form_id: { type: 'string' }, campos: SCHEMA_CAMPOS },
      required: ['form_id', 'campos'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const formId = idArg(args, 'form_id')!;
      const form = await formularioDaAgencia(ctx, formId);
      const { count } = await db.from('form_responses').select('id', { count: 'exact', head: true }).eq('form_id', formId);
      if ((count || 0) > 0) throw new ErroFerramenta(`O formulário já tem ${count} resposta(s). Crie um novo em vez de trocar as perguntas.`);

      const campos = montarCampos(formId, args.campos);
      const { data: antigos } = await db.from('form_fields').select('*').eq('form_id', formId);
      const { error: delError } = await db.from('form_fields').delete().eq('form_id', formId);
      if (delError) throw new Error(delError.message);
      const { error } = await db.from('form_fields').insert(campos);
      if (error) {
        // Devolve as perguntas antigas se a troca falhar no meio.
        if (antigos?.length) await db.from('form_fields').insert(antigos);
        throw new Error(error.message);
      }
      await db.from('forms').update({ updated_at: new Date().toISOString() }).eq('id', formId);
      return { form_id: formId, titulo: form.titulo, perguntas: campos.length, status: form.publicado ? 'publicado' : 'rascunho' };
    },
  },
  {
    name: 'ler_respostas_formulario',
    title: 'Ler respostas do formulário',
    description: 'Respostas de um formulário com as perguntas já legíveis (pergunta → resposta), mais recentes primeiro. Use para resumir briefings ou pesquisas.',
    inputSchema: {
      type: 'object',
      properties: { form_id: { type: 'string' }, limite: { type: 'number', description: 'Máx. 200. Padrão 50.' } },
      required: ['form_id'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      const formId = idArg(args, 'form_id')!;
      const form = await formularioDaAgencia(ctx, formId);
      const limite = Math.min(Math.max(Number(args.limite) || 50, 1), 200);
      const [{ data: campos }, { data: respostas, error }] = await Promise.all([
        db.from('form_fields').select('id, label, tipo, opcoes').eq('form_id', formId).order('ordem'),
        db
          .from('form_responses')
          .select('id, respostas, created_at, utm_source, utm_campaign')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
          .limit(limite),
      ]);
      if (error) throw new Error(error.message);

      const porId = new Map((campos || []).map((c) => [c.id, c]));
      const legivel = (valor: unknown, campo?: { opcoes?: unknown }) => {
        const opcoes = Array.isArray(campo?.opcoes) ? (campo.opcoes as { id: string; label: string }[]) : [];
        const traduz = (v: unknown) => opcoes.find((o) => o.id === v)?.label ?? v;
        return Array.isArray(valor) ? valor.map(traduz) : traduz(valor);
      };
      return {
        formulario: form.titulo,
        cliente: form.cliente_nome,
        total: respostas?.length || 0,
        respostas: (respostas || []).map((r) => ({
          recebida_em: r.created_at,
          origem: r.utm_source || null,
          campanha: r.utm_campaign || null,
          respostas: Object.fromEntries(
            Object.entries((r.respostas || {}) as Record<string, unknown>).map(([k, v]) => {
              const campo = porId.get(k);
              return [campo?.label || k, legivel(v, campo)];
            })
          ),
        })),
      };
    },
  },
];
