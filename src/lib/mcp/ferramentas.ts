/**
 * Ferramentas do MCP do GENSBot — Onda C1: Contexto, Demandas e Rotina.
 *
 * Tudo roda com a service role, então CADA consulta filtra por ctx.agenciaId e
 * respeita o papel: membro só enxerga e mexe no que é dele; master vê a agência.
 */
import { supabase as db } from '../supabase';
import type { ContextoMcp } from './oauth';
import type { StatusConteudo } from '../conteudo';
import { ehResponsavel, normalizarCoResponsaveis } from '../conteudo';
import {
  camposDaTransicao,
  normalizarStatusTarefa,
  STATUS_TAREFA_VALIDOS,
  TIPOS_TAREFA_VALIDOS,
  type StatusTarefaBanco,
  type TipoTarefa,
} from '../rotina';

export class ErroFerramenta extends Error {}

type Args = Record<string, unknown>;

export interface Ferramenta {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  somenteLeitura: boolean;
  executar: (args: Args, ctx: ContextoMcp) => Promise<unknown>;
}

const ETAPAS: StatusConteudo[] = [
  'planejamento',
  'copy',
  'criacao_arte',
  'revisao_arte',
  'em_gravacao',
  'em_edicao',
  'revisao_interna',
  'revisao_cliente',
  'agendamento',
  'revisao_agendamento',
  'pronto_publicar',
  'publicado',
  'travado',
];
const ETAPAS_MOVIVEIS = ETAPAS.filter((e) => e !== 'publicado');
const TIPOS_DEMANDA = ['post', 'reel', 'story', 'avulso'];
const PRIORIDADES_DEMANDA = ['baixa', 'media', 'alta', 'urgente'];
const PRIORIDADES_TAREFA = ['baixa', 'normal', 'alta', 'urgente'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- helpers de validação ----------
function texto(args: Args, campo: string, obrigatorio = false, max = 5000): string | null {
  const v = args[campo];
  if (v === undefined || v === null || v === '') {
    if (obrigatorio) throw new ErroFerramenta(`"${campo}" é obrigatório.`);
    return null;
  }
  if (typeof v !== 'string') throw new ErroFerramenta(`"${campo}" precisa ser texto.`);
  return v.trim().slice(0, max);
}
function uuid(args: Args, campo: string, obrigatorio = false): string | null {
  const v = texto(args, campo, obrigatorio, 64);
  if (v && !UUID_RE.test(v)) throw new ErroFerramenta(`"${campo}" precisa ser um id (uuid) válido.`);
  return v;
}
function umDe<T extends string>(args: Args, campo: string, opcoes: readonly T[], padrao?: T): T | null {
  const v = texto(args, campo, false, 64);
  if (!v) return padrao ?? null;
  if (!opcoes.includes(v as T)) throw new ErroFerramenta(`"${campo}" deve ser um de: ${opcoes.join(', ')}.`);
  return v as T;
}
function data(args: Args, campo: string): string | null {
  const v = texto(args, campo, false, 40);
  if (!v) return null;
  if (Number.isNaN(Date.parse(v))) throw new ErroFerramenta(`"${campo}" precisa ser data ISO (ex.: 2026-10-15 ou 2026-10-15T14:00:00-03:00).`);
  return v;
}
function mesParaData(mes: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErroFerramenta('"mes" precisa estar no formato AAAA-MM.');
  return `${mes}-01`;
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}
function exigirMaster(ctx: ContextoMcp, acao: string) {
  if (ctx.papel !== 'master') throw new ErroFerramenta(`Só administradores (master) podem ${acao}.`);
}

async function membroDaAgencia(ctx: ContextoMcp, id: string | null, campo: string) {
  if (!id) return;
  const { data: m } = await db.from('membros').select('id').eq('id', id).eq('agencia_id', ctx.agenciaId).eq('ativo', true).maybeSingle();
  if (!m) throw new ErroFerramenta(`"${campo}" não é um membro ativo da agência. Use listar_membros.`);
}
async function clienteDaAgencia(ctx: ContextoMcp, id: string) {
  const { data: c } = await db.from('clientes').select('id, nome').eq('id', id).eq('agencia_id', ctx.agenciaId).maybeSingle();
  if (!c) throw new ErroFerramenta('Cliente não encontrado nesta agência. Use listar_clientes.');
  return c;
}
async function demandaAcessivel(ctx: ContextoMcp, id: string) {
  const { data: d } = await db
    .from('conteudo_items')
    .select('id, status, responsavel_id, co_responsaveis_ids, editor_id, historico_atividades, notion_page_id, titulo')
    .eq('id', id)
    .eq('agencia_id', ctx.agenciaId)
    .maybeSingle();
  if (!d) throw new ErroFerramenta('Demanda não encontrada nesta agência.');
  if (ctx.papel !== 'master' && !ehResponsavel(d, ctx.membroId) && d.editor_id !== ctx.membroId) {
    throw new ErroFerramenta('Você só pode mexer em demandas em que é responsável ou editor(a).');
  }
  return d;
}

/**
 * Trava do MetodoViral: conteúdo (post/reel/story) só entra com scorecard aprovado.
 * Média ≥ 9, nenhum critério < 7, conformidade ok e humanizer rodado.
 */
export function validarAvaliacao(tipo: string, avaliacao: unknown): Record<string, unknown> | null {
  if (tipo === 'avulso' && (avaliacao === undefined || avaliacao === null)) return null;
  if (!avaliacao || typeof avaliacao !== 'object') {
    throw new ErroFerramenta('Conteúdo (post/reel/story) precisa do scorecard "avaliacao" do MetodoViral.');
  }
  const a = avaliacao as Record<string, unknown>;
  const notas = a.notas && typeof a.notas === 'object' ? Object.values(a.notas as Record<string, unknown>).map(Number) : [];
  if (notas.length === 0 || notas.some((n) => !Number.isFinite(n) || n < 0 || n > 10)) {
    throw new ErroFerramenta('avaliacao.notas precisa ter as notas 0–10 de cada critério.');
  }
  const media = notas.reduce((s, n) => s + n, 0) / notas.length;
  const menor = Math.min(...notas);
  if (media < 9) throw new ErroFerramenta(`Média ${media.toFixed(2)} abaixo de 9. Refaça a peça antes de enviar.`);
  if (menor < 7) throw new ErroFerramenta(`Há critério com nota ${menor} (< 7). Refaça a peça antes de enviar.`);
  if (a.conformidade !== 'ok') throw new ErroFerramenta('avaliacao.conformidade precisa ser "ok".');
  if (a.humanizado !== true) throw new ErroFerramenta('Rode o humanizer antes de enviar (avaliacao.humanizado = true).');
  return { ...a, media: Math.round(media * 100) / 100, menor_nota: menor };
}

function evento(ctx: ContextoMcp, de: string, para: string) {
  return {
    id: crypto.randomUUID(),
    tipo: 'status',
    autor_nome: `Claude (via ${ctx.nome})`,
    autor_id: ctx.membroId,
    de_status: de,
    para_status: para,
    texto: `Status alterado para ${para.toUpperCase()}`,
    criado_em: new Date().toISOString(),
  };
}

// ---------- ferramentas ----------
const SELECT_DEMANDA =
  'id, cliente_id, tipo, status, titulo, legenda, briefing, mes_referencia, data_programada, prazo, prioridade, responsavel_id, co_responsaveis_ids, editor_id, origem, cliente:clientes(nome)';

export const FERRAMENTAS: Ferramenta[] = [
  {
    name: 'resumo_operacao',
    title: 'Resumo da operação',
    description:
      'Panorama rápido: demandas abertas por etapa, atrasadas, aguardando o cliente e tarefas da rotina. Membro vê só o que é dele; master vê a agência inteira. Use antes de planejar a semana.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    somenteLeitura: true,
    async executar(_args, ctx) {
      let dq = db.from('conteudo_items').select('status, prazo, data_programada').eq('agencia_id', ctx.agenciaId).neq('status', 'publicado');
      let tq = db.from('tarefas').select('status, prazo, responsavel_id').eq('agencia_id', ctx.agenciaId).neq('status', 'concluido');
      if (ctx.papel !== 'master') {
        dq = dq.or(`responsavel_id.eq.${ctx.membroId},co_responsaveis_ids.cs.{${ctx.membroId}},editor_id.eq.${ctx.membroId}`);
        tq = tq.eq('responsavel_id', ctx.membroId);
      }
      const [{ data: demandas }, { data: tarefas }] = await Promise.all([dq, tq]);
      const hoje = hojeISO();
      const porEtapa: Record<string, number> = {};
      let atrasadas = 0;
      for (const d of demandas || []) {
        porEtapa[d.status] = (porEtapa[d.status] || 0) + 1;
        const limite = (d.prazo || d.data_programada || '').slice(0, 10);
        if (limite && limite < hoje) atrasadas++;
      }
      const porStatusTarefa: Record<string, number> = {};
      let tarefasAtrasadas = 0;
      for (const t of tarefas || []) {
        const s = normalizarStatusTarefa(t.status);
        porStatusTarefa[s] = (porStatusTarefa[s] || 0) + 1;
        if (t.prazo && t.prazo.slice(0, 10) < hoje) tarefasAtrasadas++;
      }
      return {
        escopo: ctx.papel === 'master' ? 'agência inteira' : `só ${ctx.nome}`,
        demandas_abertas: (demandas || []).length,
        demandas_por_etapa: porEtapa,
        demandas_atrasadas: atrasadas,
        aguardando_cliente: porEtapa.revisao_cliente || 0,
        tarefas_abertas: (tarefas || []).length,
        tarefas_por_status: porStatusTarefa,
        tarefas_atrasadas: tarefasAtrasadas,
      };
    },
  },
  {
    name: 'listar_clientes',
    title: 'Listar clientes',
    description: 'Lista os clientes da agência (id, nome, nicho, etapa, volume contratado de posts/reels). Use o id nas outras ferramentas.',
    inputSchema: {
      type: 'object',
      properties: { incluir_inativos: { type: 'boolean', description: 'Inclui clientes inativos. Padrão: false.' } },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      let q = db
        .from('clientes')
        .select('id, nome, nicho, etapa, ativo, posts_mes, reels_mes, responsavel_fixo_id')
        .eq('agencia_id', ctx.agenciaId)
        .order('nome');
      if (args.incluir_inativos !== true) q = q.eq('ativo', true);
      const { data: clientes, error } = await q;
      if (error) throw new Error(error.message);
      return { clientes };
    },
  },
  {
    name: 'ler_cliente',
    title: 'Ler cliente',
    description:
      'Contexto completo de um cliente para criar conteúdo: nicho, briefing, observações (regras e restrições), concorrentes, volume contratado, contatos e as últimas demandas (para não repetir tema).',
    inputSchema: {
      type: 'object',
      properties: { cliente_id: { type: 'string', description: 'id do cliente (listar_clientes).' } },
      required: ['cliente_id'],
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      const id = uuid(args, 'cliente_id', true)!;
      const { data: cliente } = await db
        .from('clientes')
        .select('id, nome, nicho, etapa, ativo, briefing, observacoes, concorrentes, posts_mes, reels_mes, dia_revisao, contrato_inicio, responsavel_fixo_id')
        .eq('id', id)
        .eq('agencia_id', ctx.agenciaId)
        .maybeSingle();
      if (!cliente) throw new ErroFerramenta('Cliente não encontrado nesta agência.');
      const [{ data: contatos }, { data: ultimas }] = await Promise.all([
        db.from('cliente_contatos').select('nome, cargo, e_grupo_whatsapp').eq('cliente_id', id).eq('agencia_id', ctx.agenciaId),
        db
          .from('conteudo_items')
          .select('titulo, tipo, status, mes_referencia')
          .eq('cliente_id', id)
          .eq('agencia_id', ctx.agenciaId)
          .order('mes_referencia', { ascending: false })
          .limit(40),
      ]);
      return { cliente, contatos, ultimas_demandas: ultimas };
    },
  },
  {
    name: 'listar_membros',
    title: 'Listar equipe',
    description: 'Lista os membros ativos da agência (id, nome, cargo, papel) para atribuir responsáveis.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    somenteLeitura: true,
    async executar(_args, ctx) {
      const { data: membros, error } = await db
        .from('membros')
        .select('id, nome, cargo, papel')
        .eq('agencia_id', ctx.agenciaId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw new Error(error.message);
      return { membros, voce: { id: ctx.membroId, nome: ctx.nome, papel: ctx.papel } };
    },
  },
  {
    name: 'listar_demandas',
    title: 'Listar demandas',
    description: 'Lista demandas da esteira com filtros. Membro só vê as dele (responsável ou editor).',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string' },
        mes: { type: 'string', description: 'AAAA-MM (mês de referência).' },
        etapa: { type: 'string', enum: ETAPAS },
        responsavel_id: { type: 'string' },
        incluir_publicadas: { type: 'boolean', description: 'Padrão: false.' },
        limite: { type: 'number', description: 'Máx. 200. Padrão 100.' },
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      const clienteId = uuid(args, 'cliente_id');
      const responsavelId = uuid(args, 'responsavel_id');
      const etapa = umDe(args, 'etapa', ETAPAS);
      const mes = texto(args, 'mes', false, 7);
      const limite = Math.min(Math.max(Number(args.limite) || 100, 1), 200);

      let q = db
        .from('conteudo_items')
        .select(SELECT_DEMANDA)
        .eq('agencia_id', ctx.agenciaId)
        .order('mes_referencia', { ascending: false })
        .order('ordem')
        .limit(limite);
      if (clienteId) q = q.eq('cliente_id', clienteId);
      if (mes) q = q.eq('mes_referencia', mesParaData(mes));
      if (etapa) q = q.eq('status', etapa);
      else if (args.incluir_publicadas !== true) q = q.neq('status', 'publicado');
      if (ctx.papel !== 'master') q = q.or(`responsavel_id.eq.${ctx.membroId},co_responsaveis_ids.cs.{${ctx.membroId}},editor_id.eq.${ctx.membroId}`);
      else if (responsavelId) q = q.or(`responsavel_id.eq.${responsavelId},co_responsaveis_ids.cs.{${responsavelId}},editor_id.eq.${responsavelId}`);
      const { data: demandas, error } = await q;
      if (error) throw new Error(error.message);
      return { total: demandas?.length || 0, demandas };
    },
  },
  {
    name: 'criar_demandas_lote',
    title: 'Criar demandas em lote',
    description:
      'Cria várias demandas de um cliente num mês, direto em "planejamento" (só master). Post/reel/story exigem o scorecard do MetodoViral em "avaliacao" (média ≥ 9, nenhum critério < 7, conformidade "ok", humanizado true); sem isso nada é criado. Máx. 40 itens.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string' },
        mes: { type: 'string', description: 'AAAA-MM do ciclo.' },
        itens: {
          type: 'array',
          maxItems: 40,
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: TIPOS_DEMANDA },
              titulo: { type: 'string' },
              legenda: { type: 'string', description: 'Legenda final (já humanizada).' },
              briefing: { type: 'string', description: 'Texto da arte / roteiro cena a cena / observações.' },
              data_programada: { type: 'string', description: 'Data/hora ISO prevista de publicação.' },
              prazo: { type: 'string', description: 'Data ISO de entrega interna.' },
              responsavel_id: { type: 'string' },
              editor_id: { type: 'string' },
              prioridade: { type: 'string', enum: PRIORIDADES_DEMANDA },
              avaliacao: {
                type: 'object',
                description: 'Scorecard do MetodoViral: { rubrica, rodadas, notas: { criterio: nota }, conformidade: "ok", humanizado: true }.',
              },
            },
            required: ['tipo', 'titulo'],
          },
        },
      },
      required: ['cliente_id', 'mes', 'itens'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      exigirMaster(ctx, 'criar demandas em lote');
      const clienteId = uuid(args, 'cliente_id', true)!;
      const mesRef = mesParaData(texto(args, 'mes', true, 7)!);
      const cliente = await clienteDaAgencia(ctx, clienteId);
      const itens = Array.isArray(args.itens) ? (args.itens as Args[]) : [];
      if (itens.length === 0 || itens.length > 40) throw new ErroFerramenta('"itens" precisa ter de 1 a 40 demandas.');

      const { data: ultima } = await db
        .from('conteudo_items')
        .select('ordem')
        .eq('agencia_id', ctx.agenciaId)
        .eq('cliente_id', clienteId)
        .eq('mes_referencia', mesRef)
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle();
      let ordem = (ultima?.ordem ?? -1) + 1;

      const linhas = [];
      for (const [i, item] of itens.entries()) {
        try {
          const tipo = umDe(item, 'tipo', TIPOS_DEMANDA);
          if (!tipo) throw new ErroFerramenta('"tipo" é obrigatório.');
          const responsavelId = uuid(item, 'responsavel_id');
          const editorId = uuid(item, 'editor_id');
          await membroDaAgencia(ctx, responsavelId, 'responsavel_id');
          await membroDaAgencia(ctx, editorId, 'editor_id');
          linhas.push({
            agencia_id: ctx.agenciaId,
            cliente_id: clienteId,
            tipo,
            status: 'planejamento',
            titulo: texto(item, 'titulo', true, 300),
            legenda: texto(item, 'legenda', false, 5000),
            briefing: texto(item, 'briefing', false, 10000),
            mes_referencia: mesRef,
            ordem: ordem++,
            data_programada: data(item, 'data_programada'),
            prazo: data(item, 'prazo'),
            responsavel_id: responsavelId,
            editor_id: editorId,
            prioridade: umDe(item, 'prioridade', PRIORIDADES_DEMANDA, 'media'),
            avaliacao: validarAvaliacao(tipo, item.avaliacao),
            origem: 'claude',
            historico_atividades: [
              {
                id: crypto.randomUUID(),
                tipo: 'comentario',
                autor_nome: `Claude (via ${ctx.nome})`,
                autor_id: ctx.membroId,
                texto: 'Demanda criada pelo Claude (MetodoViral).',
                criado_em: new Date().toISOString(),
              },
            ],
          });
        } catch (e) {
          if (e instanceof ErroFerramenta) throw new ErroFerramenta(`Item ${i + 1}: ${e.message} Nada foi criado.`);
          throw e;
        }
      }

      const { data: criadas, error } = await db.from('conteudo_items').insert(linhas).select('id, tipo, titulo, status, ordem');
      if (error) throw new Error(error.message);
      return { cliente: cliente.nome, mes: mesRef.slice(0, 7), criadas: criadas?.length || 0, demandas: criadas };
    },
  },
  {
    name: 'atualizar_demanda',
    title: 'Atualizar demanda',
    description: 'Edita campos de uma demanda (título, legenda, briefing, datas, responsáveis, prioridade). Para trocar etapa use mover_etapa.',
    inputSchema: {
      type: 'object',
      properties: {
        demanda_id: { type: 'string' },
        titulo: { type: 'string' },
        legenda: { type: 'string' },
        briefing: { type: 'string' },
        data_programada: { type: 'string' },
        prazo: { type: 'string' },
        responsavel_id: { type: 'string' },
        co_responsaveis_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Demais responsáveis além do principal (substitui a lista atual; [] limpa).',
        },
        editor_id: { type: 'string' },
        prioridade: { type: 'string', enum: PRIORIDADES_DEMANDA },
      },
      required: ['demanda_id'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const id = uuid(args, 'demanda_id', true)!;
      await demandaAcessivel(ctx, id);
      const campos: Record<string, unknown> = {};
      if ('titulo' in args) campos.titulo = texto(args, 'titulo', true, 300);
      if ('legenda' in args) campos.legenda = texto(args, 'legenda', false, 5000);
      if ('briefing' in args) campos.briefing = texto(args, 'briefing', false, 10000);
      if ('data_programada' in args) campos.data_programada = data(args, 'data_programada');
      if ('prazo' in args) campos.prazo = data(args, 'prazo');
      if ('prioridade' in args) campos.prioridade = umDe(args, 'prioridade', PRIORIDADES_DEMANDA);
      for (const c of ['responsavel_id', 'editor_id'] as const) {
        if (c in args) {
          if (ctx.papel !== 'master') throw new ErroFerramenta('Só master reatribui responsáveis.');
          const v = uuid(args, c);
          await membroDaAgencia(ctx, v, c);
          campos[c] = v;
        }
      }
      if ('co_responsaveis_ids' in args) {
        if (ctx.papel !== 'master') throw new ErroFerramenta('Só master reatribui responsáveis.');
        const bruto = args.co_responsaveis_ids;
        if (!Array.isArray(bruto) || bruto.some((v) => typeof v !== 'string' || !UUID_RE.test(v))) {
          throw new ErroFerramenta('"co_responsaveis_ids" precisa ser uma lista de ids (uuid).');
        }
        const ids = normalizarCoResponsaveis(bruto, (campos.responsavel_id as string | null | undefined) ?? null);
        for (const idMembro of ids) await membroDaAgencia(ctx, idMembro, 'co_responsaveis_ids');
        campos.co_responsaveis_ids = ids;
      }
      if (Object.keys(campos).length === 0) throw new ErroFerramenta('Nenhum campo para atualizar.');
      campos.atualizado_em = new Date().toISOString();
      const { data: demanda, error } = await db
        .from('conteudo_items')
        .update(campos)
        .eq('id', id)
        .eq('agencia_id', ctx.agenciaId)
        .select(SELECT_DEMANDA)
        .single();
      if (error) throw new Error(error.message);
      return { demanda };
    },
  },
  {
    name: 'mover_etapa',
    title: 'Mover demanda de etapa',
    description: 'Move uma demanda para outra etapa da esteira e registra no histórico. Não publica: "publicado" só pela esteira/agendamento.',
    inputSchema: {
      type: 'object',
      properties: { demanda_id: { type: 'string' }, etapa: { type: 'string', enum: ETAPAS_MOVIVEIS } },
      required: ['demanda_id', 'etapa'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const id = uuid(args, 'demanda_id', true)!;
      const etapa = umDe(args, 'etapa', ETAPAS_MOVIVEIS);
      if (!etapa) throw new ErroFerramenta('"etapa" é obrigatória.');
      const atual = await demandaAcessivel(ctx, id);
      if (atual.status === 'publicado') throw new ErroFerramenta('Demanda já publicada não volta pela esteira via Claude.');
      if (atual.status === etapa) return { demanda_id: id, etapa, mudou: false };

      const historico = Array.isArray(atual.historico_atividades) ? [...atual.historico_atividades] : [];
      historico.push(evento(ctx, atual.status, etapa));
      const { error } = await db
        .from('conteudo_items')
        .update({ status: etapa, historico_atividades: historico, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .eq('agencia_id', ctx.agenciaId);
      if (error) throw new Error(error.message);

      // Mesmo espelhamento do Notion feito pela esteira (PATCH /api/conteudo/[id]).
      if (atual.notion_page_id) {
        const { updateNotionPageStatus } = await import('../notion');
        const alvo =
          etapa === 'agendamento' || etapa === 'pronto_publicar'
            ? ['Aprovado', 'Agendado', 'Pronto para Publicar', 'Pronto']
            : etapa === 'revisao_interna' || etapa === 'travado'
              ? ['Revisão', 'Ajuste', 'Revisão Interna', 'Em Revisão']
              : etapa === 'revisao_cliente'
                ? ['Revisão do Cliente', 'Aprovação', 'Aprovação Cliente']
                : null;
        if (alvo) await updateNotionPageStatus(atual.notion_page_id, alvo).catch(() => {});
      }
      return { demanda_id: id, titulo: atual.titulo, de: atual.status, para: etapa, mudou: true };
    },
  },
  {
    name: 'listar_tarefas',
    title: 'Listar tarefas da rotina',
    description: 'Tarefas da rotina (internas, peças avulsas, sub-tarefas). Membro vê só as dele; master pode pedir de outra pessoa ou "all".',
    inputSchema: {
      type: 'object',
      properties: {
        membro_id: { type: 'string', description: 'id do membro ou "all" (só master). Padrão: você.' },
        status: { type: 'string', enum: ['a_fazer', 'fazendo', 'aguardando', 'concluido', 'abertas'] },
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      const pedido = texto(args, 'membro_id', false, 64) || ctx.membroId;
      if (pedido !== 'all' && !UUID_RE.test(pedido)) throw new ErroFerramenta('"membro_id" precisa ser um id ou "all".');
      const alvo = ctx.papel === 'master' ? pedido : ctx.membroId;
      const status = texto(args, 'status', false, 20);

      let q = db
        .from('tarefas')
        .select(
          'id, titulo, tipo, status, prioridade, prazo, estimativa_min, aguardando_de, solicitante, responsavel_id, cliente:clientes(nome), demanda:conteudo_items!demanda_id(id, titulo, status)'
        )
        .eq('agencia_id', ctx.agenciaId)
        .order('criado_em', { ascending: false })
        .limit(200);
      if (alvo !== 'all') q = q.eq('responsavel_id', alvo);
      if (!status || status === 'abertas') q = q.neq('status', 'concluido');
      else if (status === 'a_fazer') q = q.in('status', ['a_fazer', 'pendente']);
      else q = q.eq('status', status);
      const { data: tarefas, error } = await q;
      if (error) throw new Error(error.message);
      return { total: tarefas?.length || 0, tarefas: (tarefas || []).map((t) => ({ ...t, status: normalizarStatusTarefa(t.status) })) };
    },
  },
  {
    name: 'criar_tarefa',
    title: 'Criar tarefa na rotina',
    description:
      'Cria uma tarefa na rotina. tipo: interno (agência), peca_avulsa (flyer, capa… — use cliente_id ou solicitante) ou sub_tarefa (exige demanda_id). Membro só cria para si; master pode atribuir a qualquer membro.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        tipo: { type: 'string', enum: TIPOS_TAREFA_VALIDOS },
        descricao: { type: 'string' },
        cliente_id: { type: 'string' },
        demanda_id: { type: 'string' },
        solicitante: { type: 'string' },
        responsavel_id: { type: 'string' },
        prioridade: { type: 'string', enum: PRIORIDADES_TAREFA },
        prazo: { type: 'string', description: 'AAAA-MM-DD' },
        estimativa_min: { type: 'number' },
        status: { type: 'string', enum: ['a_fazer', 'fazendo', 'aguardando'] },
      },
      required: ['titulo'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      let tipo = umDe<TipoTarefa>(args, 'tipo', TIPOS_TAREFA_VALIDOS, 'interno')!;
      const demandaId = uuid(args, 'demanda_id');
      let clienteId = uuid(args, 'cliente_id');
      const responsavelId = uuid(args, 'responsavel_id') || ctx.membroId;
      if (responsavelId !== ctx.membroId) {
        exigirMaster(ctx, 'criar tarefa para outra pessoa');
        await membroDaAgencia(ctx, responsavelId, 'responsavel_id');
      }
      if (demandaId) {
        tipo = 'sub_tarefa';
        const { data: d } = await db.from('conteudo_items').select('cliente_id').eq('id', demandaId).eq('agencia_id', ctx.agenciaId).maybeSingle();
        if (!d) throw new ErroFerramenta('Demanda não encontrada nesta agência.');
        clienteId = clienteId || d.cliente_id;
      } else if (tipo === 'sub_tarefa') {
        throw new ErroFerramenta('Sub-tarefa precisa de demanda_id.');
      }
      if (clienteId) await clienteDaAgencia(ctx, clienteId);
      const status = (umDe(args, 'status', ['a_fazer', 'fazendo', 'aguardando'] as const, 'a_fazer') || 'a_fazer') as StatusTarefaBanco;
      const estimativa = Number(args.estimativa_min);

      const { data: tarefa, error } = await db
        .from('tarefas')
        .insert({
          agencia_id: ctx.agenciaId,
          responsavel_id: responsavelId,
          cliente_id: clienteId,
          demanda_id: demandaId,
          tipo,
          titulo: texto(args, 'titulo', true, 300),
          descricao: texto(args, 'descricao'),
          solicitante: texto(args, 'solicitante', false, 200),
          prioridade: umDe(args, 'prioridade', PRIORIDADES_TAREFA, 'normal'),
          prazo: data(args, 'prazo'),
          estimativa_min: Number.isFinite(estimativa) && estimativa > 0 ? Math.round(estimativa) : null,
          status,
          iniciado_em: status === 'fazendo' ? new Date().toISOString() : null,
          origem: 'claude',
        })
        .select('id, titulo, tipo, status, responsavel_id, prazo')
        .single();
      if (error) throw new Error(error.message);
      return { tarefa };
    },
  },
  {
    name: 'atualizar_tarefa',
    title: 'Atualizar tarefa',
    description: 'Muda status (a_fazer, fazendo, aguardando, concluido) ou campos de uma tarefa. Membro só mexe nas próprias.',
    inputSchema: {
      type: 'object',
      properties: {
        tarefa_id: { type: 'string' },
        status: { type: 'string', enum: ['a_fazer', 'fazendo', 'aguardando', 'concluido'] },
        aguardando_de: { type: 'string', description: 'Quem está travando (quando status = aguardando).' },
        titulo: { type: 'string' },
        descricao: { type: 'string' },
        prioridade: { type: 'string', enum: PRIORIDADES_TAREFA },
        prazo: { type: 'string' },
        estimativa_min: { type: 'number' },
      },
      required: ['tarefa_id'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const id = uuid(args, 'tarefa_id', true)!;
      const { data: atual } = await db
        .from('tarefas')
        .select('id, responsavel_id, iniciado_em')
        .eq('id', id)
        .eq('agencia_id', ctx.agenciaId)
        .maybeSingle();
      if (!atual) throw new ErroFerramenta('Tarefa não encontrada nesta agência.');
      if (ctx.papel !== 'master' && atual.responsavel_id !== ctx.membroId) throw new ErroFerramenta('Você só pode mexer nas suas tarefas.');

      const campos: Record<string, unknown> = {};
      if ('titulo' in args) campos.titulo = texto(args, 'titulo', true, 300);
      if ('descricao' in args) campos.descricao = texto(args, 'descricao');
      if ('prioridade' in args) campos.prioridade = umDe(args, 'prioridade', PRIORIDADES_TAREFA);
      if ('prazo' in args) campos.prazo = data(args, 'prazo');
      if ('estimativa_min' in args) {
        const e = Number(args.estimativa_min);
        campos.estimativa_min = Number.isFinite(e) && e > 0 ? Math.round(e) : null;
      }
      if ('status' in args) {
        const s = umDe(
          args,
          'status',
          STATUS_TAREFA_VALIDOS.filter((x) => x !== 'pendente')
        );
        if (s) {
          const novo = normalizarStatusTarefa(s);
          campos.status = novo;
          Object.assign(campos, camposDaTransicao(novo, atual));
        }
      }
      if ('aguardando_de' in args) campos.aguardando_de = texto(args, 'aguardando_de', false, 200);
      if ('co_responsaveis_ids' in args) {
        if (ctx.papel !== 'master') throw new ErroFerramenta('Só master reatribui responsáveis.');
        const bruto = args.co_responsaveis_ids;
        if (!Array.isArray(bruto) || bruto.some((v) => typeof v !== 'string' || !UUID_RE.test(v))) {
          throw new ErroFerramenta('"co_responsaveis_ids" precisa ser uma lista de ids (uuid).');
        }
        const ids = normalizarCoResponsaveis(bruto, (campos.responsavel_id as string | null | undefined) ?? null);
        for (const idMembro of ids) await membroDaAgencia(ctx, idMembro, 'co_responsaveis_ids');
        campos.co_responsaveis_ids = ids;
      }
      if (Object.keys(campos).length === 0) throw new ErroFerramenta('Nenhum campo para atualizar.');
      campos.atualizado_em = new Date().toISOString();

      const { data: tarefa, error } = await db
        .from('tarefas')
        .update(campos)
        .eq('id', id)
        .eq('agencia_id', ctx.agenciaId)
        .select('id, titulo, status, aguardando_de, prazo')
        .single();
      if (error) throw new Error(error.message);
      return { tarefa };
    },
  },
];
