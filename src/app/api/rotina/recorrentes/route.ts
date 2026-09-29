import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { hojeBrasilia, ocorreEm, somarDias, validarRegra } from '@/lib/rotina-recorrencia';

const SELECT_REGRA = `
  *,
  cliente:clientes(id, nome, cor),
  responsavel:membros!responsavel_id(id, nome)
`;
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];

/** GET /api/rotina/recorrentes — regras da agência (membro vê só as dele). */
export async function GET() {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const consultar = (db: typeof supabase) => {
    let q = db.from('tarefas_recorrentes').select(SELECT_REGRA).eq('agencia_id', membro.agencia_id).order('criado_em', { ascending: false });
    if (membro.papel !== 'master') q = q.eq('responsavel_id', membro.id);
    return q;
  };
  let { data, error } = await consultar(supabase);
  if (error) ({ data, error } = await consultar(serviceSupabase));
  if (error) return traduzirErroBanco(error, 'GET /api/rotina/recorrentes');
  return NextResponse.json({ regras: data || [] });
}

/**
 * POST /api/rotina/recorrentes — cria a regra. Se hoje já é um dia da regra,
 * a tarefa de hoje é criada na hora (o gerador diário roda de madrugada).
 */
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

  const titulo = String(body.titulo || '').trim().slice(0, 300);
  if (!titulo) return respostaErro('O título é obrigatório.', 400);
  const regra = validarRegra(body);
  if (!regra.ok) return respostaErro(regra.erro, 400);

  const responsavelId = (body.responsavel_id as string) || user.id;
  if (responsavelId !== membro.id && membro.papel !== 'master') {
    return respostaErro('Só administradores criam rotina recorrente para outra pessoa.', 403);
  }

  const hoje = hojeBrasilia();
  const estimativa = Number(body.estimativa_min);
  const prazoDias = Math.min(Math.max(Math.round(Number(body.prazo_dias) || 0), 0), 60);
  const linha = {
    agencia_id: membro.agencia_id,
    titulo,
    descricao: String(body.descricao || '').trim() || null,
    tipo: body.tipo === 'peca_avulsa' ? 'peca_avulsa' : 'interno',
    cliente_id: (body.cliente_id as string) || null,
    solicitante: String(body.solicitante || '').trim() || null,
    responsavel_id: responsavelId,
    prioridade: PRIORIDADES.includes(String(body.prioridade)) ? String(body.prioridade) : 'normal',
    estimativa_min: Number.isFinite(estimativa) && estimativa > 0 ? Math.round(estimativa) : null,
    frequencia: regra.frequencia,
    dias_semana: regra.dias_semana,
    dia_mes: regra.dia_mes,
    prazo_dias: prazoDias,
    inicio_em: hoje,
    criado_por: membro.id,
  };

  const inserir = (db: typeof supabase) => db.from('tarefas_recorrentes').insert(linha).select(SELECT_REGRA).single();
  let { data: criada, error } = await inserir(supabase);
  if (error) ({ data: criada, error } = await inserir(serviceSupabase));
  if (error || !criada) return traduzirErroBanco(error!, 'POST /api/rotina/recorrentes');

  let tarefaHoje = null;
  if (ocorreEm({ ...regra, inicio_em: hoje }, hoje)) {
    const tarefa = {
      agencia_id: membro.agencia_id,
      cliente_id: linha.cliente_id,
      responsavel_id: linha.responsavel_id,
      tipo: linha.tipo,
      titulo: linha.titulo,
      descricao: linha.descricao,
      solicitante: linha.solicitante,
      status: 'a_fazer',
      prioridade: linha.prioridade,
      prazo: somarDias(hoje, prazoDias),
      estimativa_min: linha.estimativa_min,
      origem: 'recorrente',
      recorrencia_id: criada.id,
      data_ocorrencia: hoje,
    };
    const gerar = (db: typeof supabase) => db.from('tarefas').insert(tarefa).select('id').single();
    let r = await gerar(supabase);
    if (r.error) r = await gerar(serviceSupabase);
    tarefaHoje = r.data?.id || null;
    await serviceSupabase.from('tarefas_recorrentes').update({ ultima_geracao: hoje }).eq('id', criada.id);
    // A lista mostra 'próxima' a partir de ultima_geracao: a de hoje já foi gerada.
    criada.ultima_geracao = hoje;
  }

  return NextResponse.json({ regra: criada, tarefa_de_hoje: tarefaHoje }, { status: 201 });
}
