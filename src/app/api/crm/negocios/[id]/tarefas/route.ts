import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

// GET: Lista as tarefas do negócio
export async function GET(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id } = await params;
  try {
    const { data, error } = await serviceSupabase
      .from('crm_tarefas')
      .select('*, responsavel:membros!responsavel_id(id, nome)')
      .eq('negocio_id', id)
      .eq('agencia_id', membro.agencia_id)
      .order('prazo', { ascending: true });

    if (error) return traduzirErroBanco(error, 'GET /api/crm/negocios/[id]/tarefas');
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Erro ao listar tarefas:', err);
    return respostaErro('Falha interna ao carregar tarefas.', 500);
  }
}

// POST: Cria uma nova tarefa de follow-up
export async function POST(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro, user } = auth.ctx;

  const { id } = await params;
  try {
    const body = await req.json();
    const { titulo, tipo = 'whatsapp', prazo, responsavel_id } = body;

    if (!titulo?.trim()) {
      return respostaErro('O título da tarefa é obrigatório.', 400);
    }
    if (!prazo) {
      return respostaErro('O prazo da tarefa é obrigatório.', 400);
    }

    const { data, error } = await serviceSupabase
      .from('crm_tarefas')
      .insert({
        negocio_id: id,
        agencia_id: membro.agencia_id,
        responsavel_id: responsavel_id || user.id,
        titulo: titulo.trim(),
        tipo,
        prazo,
        concluida: false,
      })
      .select('*, responsavel:membros!responsavel_id(id, nome)')
      .single();

    if (error) return traduzirErroBanco(error, 'POST /api/crm/negocios/[id]/tarefas');

    // Registra na timeline
    await serviceSupabase.from('crm_atividades').insert({
      negocio_id: id,
      agencia_id: membro.agencia_id,
      membro_id: user.id,
      tipo: 'tarefa',
      descricao: `Tarefa agendada: "${titulo.trim()}" para ${new Date(prazo).toLocaleDateString('pt-BR')}`,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Erro ao criar tarefa:', err);
    return respostaErro('Falha interna ao salvar tarefa.', 500);
  }
}

// PATCH: Conclui ou edita uma tarefa
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro, user } = auth.ctx;

  const { id } = await params;
  try {
    const body = await req.json();
    const { tarefa_id, concluida } = body;

    if (!tarefa_id) {
      return respostaErro('O tarefa_id é obrigatório.', 400);
    }

    const isConcluida = Boolean(concluida);
    const { data, error } = await serviceSupabase
      .from('crm_tarefas')
      .update({
        concluida: isConcluida,
        concluida_em: isConcluida ? new Date().toISOString() : null,
      })
      .eq('id', tarefa_id)
      .eq('negocio_id', id)
      .eq('agencia_id', membro.agencia_id)
      .select('*, responsavel:membros!responsavel_id(id, nome)')
      .maybeSingle();

    if (error) return traduzirErroBanco(error, 'PATCH /api/crm/negocios/[id]/tarefas');
    if (!data) return respostaErro('Tarefa não encontrada.', 404);

    if (isConcluida) {
      await serviceSupabase.from('crm_atividades').insert({
        negocio_id: id,
        agencia_id: membro.agencia_id,
        membro_id: user.id,
        tipo: 'nota',
        descricao: `✓ Tarefa concluída: "${data.titulo}"`,
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Erro ao atualizar tarefa:', err);
    return respostaErro('Falha interna ao atualizar tarefa.', 500);
  }
}
