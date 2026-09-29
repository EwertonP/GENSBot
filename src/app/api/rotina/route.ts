import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import {
  DIAS_CONCLUIDO_VISIVEL,
  STATUS_TAREFA_VALIDOS,
  TIPOS_TAREFA_VALIDOS,
  type StatusTarefaBanco,
  type TipoTarefa,
} from '@/lib/rotina';

export type { TarefaRotina } from '@/lib/rotina';

const SELECT_TAREFA = `
  *,
  cliente:clientes(id, nome, cor, foto_url),
  responsavel:membros!responsavel_id(id, nome, email, cargo),
  demanda:conteudo_items!demanda_id(id, titulo, status)
`;

const SELECT_DEMANDA = `
  id, cliente_id, tipo, titulo, status, prioridade, prazo, data_programada,
  responsavel_id, co_responsaveis_ids, editor_id, publicado_em,
  cliente:clientes(id, nome, cor, foto_url)
`;

const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/rotina — feed "Meu trabalho".
 *
 * ?membro_id=<id>  de quem é o quadro (padrão: quem está logado).
 *                  'all' = equipe inteira. Ver outra pessoa ou a equipe é só para master.
 * ?status=pendente compatibilidade com o dashboard: tarefas ainda não concluídas.
 * ?cliente_id=<id> filtra por cliente.
 *
 * Retorna { tarefas, demandas, eu, alvo }. Concluídos só dos últimos 14 dias.
 */
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const clienteId = searchParams.get('cliente_id');
  const pedido = searchParams.get('membro_id') || searchParams.get('responsavel_id') || membro.id;
  // O id entra num filtro .or() do PostgREST: só aceita 'all' ou UUID.
  if (pedido !== 'all' && !UUID_RE.test(pedido)) return respostaErro('membro_id inválido.', 400);
  const alvo = membro.papel === 'master' ? pedido : membro.id;

  const limiteConcluido = new Date(Date.now() - DIAS_CONCLUIDO_VISIVEL * 24 * 60 * 60 * 1000).toISOString();

  // Mesmo padrão das rotas de conteúdo/clientes: se a sessão do usuário falhar no
  // PostgREST (ex.: PGRST303), refaz com a service role, sempre filtrando pela agência.
  const consultar = (db: typeof supabase) => {
    let tarefasQuery = db
      .from('tarefas')
      .select(SELECT_TAREFA)
      .eq('agencia_id', membro.agencia_id)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: false });

    if (alvo !== 'all') tarefasQuery = tarefasQuery.eq('responsavel_id', alvo);
    if (clienteId) tarefasQuery = tarefasQuery.eq('cliente_id', clienteId);
    if (status === 'pendente') {
      tarefasQuery = tarefasQuery.neq('status', 'concluido');
    } else if (status && STATUS_TAREFA_VALIDOS.includes(status as StatusTarefaBanco)) {
      tarefasQuery = tarefasQuery.eq('status', status);
    } else {
      tarefasQuery = tarefasQuery.or(`status.neq.concluido,concluido_em.gte.${limiteConcluido}`);
    }

    let demandasQuery = db
      .from('conteudo_items')
      .select(SELECT_DEMANDA)
      .eq('agencia_id', membro.agencia_id)
      .or(`status.neq.publicado,publicado_em.gte.${limiteConcluido}`)
      .order('prazo', { ascending: true, nullsFirst: false });

    if (alvo !== 'all') demandasQuery = demandasQuery.or(`responsavel_id.eq.${alvo},co_responsaveis_ids.cs.{${alvo}},editor_id.eq.${alvo}`);
    if (clienteId) demandasQuery = demandasQuery.eq('cliente_id', clienteId);

    return Promise.all([tarefasQuery, demandasQuery]);
  };

  let [tarefasRes, demandasRes] = await consultar(supabase);
  if (tarefasRes.error) {
    console.warn('GET /api/rotina: fallback service role:', tarefasRes.error.message);
    [tarefasRes, demandasRes] = await consultar(serviceSupabase);
  }

  if (tarefasRes.error) return traduzirErroBanco(tarefasRes.error, 'GET /api/rotina');
  // Demandas são complemento: se a consulta falhar, o quadro de tarefas continua funcionando.
  if (demandasRes.error) console.error('GET /api/rotina (demandas):', demandasRes.error.message);

  return NextResponse.json({
    tarefas: tarefasRes.data || [],
    demandas: status === 'pendente' ? [] : demandasRes.data || [],
    eu: { id: membro.id, papel: membro.papel },
    alvo,
  });
}

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user, membro } = auth.ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  const titulo = String(body.titulo || '').trim();
  if (!titulo) return respostaErro('O título da tarefa é obrigatório.', 400);

  const prioridade = PRIORIDADES.includes(String(body.prioridade)) ? String(body.prioridade) : 'normal';
  const status: StatusTarefaBanco = STATUS_TAREFA_VALIDOS.includes(body.status as StatusTarefaBanco) ? (body.status as StatusTarefaBanco) : 'a_fazer';
  let tipo: TipoTarefa = TIPOS_TAREFA_VALIDOS.includes(body.tipo as TipoTarefa) ? (body.tipo as TipoTarefa) : 'interno';
  let clienteId = (body.cliente_id as string | undefined) || null;
  const demandaId = (body.demanda_id as string | undefined) || null;

  // Sub-tarefa herda o cliente da demanda.
  if (demandaId) {
    tipo = 'sub_tarefa';
    const buscarDemanda = (db: typeof supabase) =>
      db.from('conteudo_items').select('id, cliente_id').eq('id', demandaId).eq('agencia_id', membro.agencia_id).maybeSingle();
    let { data: demanda } = await buscarDemanda(supabase);
    if (!demanda) ({ data: demanda } = await buscarDemanda(serviceSupabase));
    if (!demanda) return respostaErro('Demanda vinculada não encontrada.', 400);
    clienteId = clienteId || demanda.cliente_id;
  } else if (tipo === 'sub_tarefa') {
    return respostaErro('Sub-tarefa precisa estar ligada a uma demanda.', 400);
  }

  const estimativa = Number(body.estimativa_min);
  const agora = new Date().toISOString();

  const linha = {
    agencia_id: membro.agencia_id,
    cliente_id: clienteId,
    responsavel_id: (body.responsavel_id as string | undefined) || user.id,
    demanda_id: demandaId,
    tipo,
    titulo,
    descricao: String(body.descricao || '').trim() || null,
    status,
    prioridade,
    prazo: (body.prazo as string | undefined) || null,
    solicitante: String(body.solicitante || '').trim() || null,
    aguardando_de: status === 'aguardando' ? String(body.aguardando_de || '').trim() || null : null,
    estimativa_min: Number.isFinite(estimativa) && estimativa > 0 ? Math.round(estimativa) : null,
    origem: body.origem === 'claude' ? 'claude' : 'manual',
    iniciado_em: status === 'fazendo' || status === 'concluido' ? agora : null,
    concluido_em: status === 'concluido' ? agora : null,
  };

  let { data, error } = await supabase.from('tarefas').insert(linha).select(SELECT_TAREFA).single();
  if (error) {
    console.warn('POST /api/rotina: fallback service role:', error.message);
    ({ data, error } = await serviceSupabase.from('tarefas').insert(linha).select(SELECT_TAREFA).single());
  }

  if (error) return traduzirErroBanco(error, 'POST /api/rotina');

  return NextResponse.json({ tarefa: data }, { status: 201 });
}
