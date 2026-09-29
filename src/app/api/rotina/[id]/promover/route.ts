import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };
const TIPOS = ['post', 'reel', 'story', 'avulso'];
const PRIORIDADE_DEMANDA: Record<string, string> = { baixa: 'baixa', normal: 'media', alta: 'alta', urgente: 'urgente' };

/**
 * POST /api/rotina/[id]/promover — a tarefa cresceu e vira demanda da esteira.
 * Cria a demanda em "planejamento" (título, descrição→briefing, prazo, responsável)
 * e conclui a tarefa, ligada à demanda nova.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tipo = TIPOS.includes(String(body.tipo)) ? String(body.tipo) : 'avulso';

  const { data: tarefa } = await serviceSupabase
    .from('tarefas')
    .select('id, titulo, descricao, prazo, prioridade, cliente_id, responsavel_id, demanda_id, tipo, status')
    .eq('id', id)
    .eq('agencia_id', membro.agencia_id)
    .maybeSingle();
  if (!tarefa) return respostaErro('Tarefa não encontrada.', 404);
  if (membro.papel !== 'master' && tarefa.responsavel_id !== membro.id) return respostaErro('Você só pode promover as suas tarefas.', 403);
  if (tarefa.tipo === 'sub_tarefa' || tarefa.demanda_id) return respostaErro('Esta tarefa já está ligada a uma demanda.', 400);

  const clienteId = (body.cliente_id as string) || tarefa.cliente_id;
  if (!clienteId) return respostaErro('Escolha o cliente da demanda.', 400);
  const { data: cliente } = await serviceSupabase.from('clientes').select('id').eq('id', clienteId).eq('agencia_id', membro.agencia_id).maybeSingle();
  if (!cliente) return respostaErro('Cliente não encontrado nesta agência.', 400);

  const hoje = new Date();
  const demanda = {
    agencia_id: membro.agencia_id,
    cliente_id: clienteId,
    tipo,
    status: 'planejamento',
    prioridade: PRIORIDADE_DEMANDA[tarefa.prioridade] || 'media',
    titulo: tarefa.titulo,
    briefing: tarefa.descricao,
    mes_referencia: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
    prazo: tarefa.prazo,
    responsavel_id: tarefa.responsavel_id,
    arquivos: [],
    historico_atividades: [
      {
        id: crypto.randomUUID(),
        tipo: 'comentario',
        autor_nome: 'Rotina',
        autor_id: membro.id,
        texto: 'Demanda criada a partir de uma tarefa da Rotina.',
        criado_em: hoje.toISOString(),
      },
    ],
  };

  const criar = (db: typeof supabase) => db.from('conteudo_items').insert(demanda).select('id, titulo, status, cliente_id').single();
  let { data: item, error } = await criar(supabase);
  if (error) ({ data: item, error } = await criar(serviceSupabase));
  if (error || !item) return traduzirErroBanco(error!, 'POST /api/rotina/[id]/promover');

  const agora = hoje.toISOString();
  await serviceSupabase
    .from('tarefas')
    .update({ demanda_id: item.id, status: 'concluido', concluido_em: agora, atualizado_em: agora })
    .eq('id', id)
    .eq('agencia_id', membro.agencia_id);

  return NextResponse.json({ demanda: item }, { status: 201 });
}
