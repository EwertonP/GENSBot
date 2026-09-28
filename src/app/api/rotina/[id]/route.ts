import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import {
  STATUS_TAREFA_VALIDOS,
  TIPOS_TAREFA_VALIDOS,
  camposDaTransicao,
  normalizarStatusTarefa,
} from '@/lib/rotina';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;

  try {
    const body = await req.json();
    const permitidos = [
      'titulo',
      'descricao',
      'status',
      'prioridade',
      'prazo',
      'responsavel_id',
      'cliente_id',
      'tipo',
      'solicitante',
      'aguardando_de',
      'estimativa_min',
      'ordem',
    ];
    const updates: Record<string, any> = {};

    for (const key of permitidos) {
      if (key in body) {
        updates[key] = body[key] === '' ? null : body[key];
      }
    }

    if ('tipo' in updates && !TIPOS_TAREFA_VALIDOS.includes(updates.tipo)) {
      return respostaErro('Tipo de tarefa inválido.', 400);
    }

    if ('status' in updates) {
      if (!STATUS_TAREFA_VALIDOS.includes(updates.status)) {
        return respostaErro('Status de tarefa inválido.', 400);
      }
      const novo = normalizarStatusTarefa(updates.status);
      updates.status = novo;
      const { data: atual } = await supabase
        .from('tarefas')
        .select('iniciado_em')
        .eq('id', id)
        .eq('agencia_id', membro.agencia_id)
        .maybeSingle();
      const derivados = camposDaTransicao(novo, atual);
      // aguardando_de enviado junto com a mudança para Aguardando tem prioridade.
      if (novo === 'aguardando' && 'aguardando_de' in updates) delete derivados.aguardando_de;
      Object.assign(updates, derivados);
    }

    updates.atualizado_em = new Date().toISOString();

    const { data, error } = await supabase
      .from('tarefas')
      .update(updates)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .select(`
        *,
        cliente:clientes(id, nome, cor, foto_url),
        responsavel:membros!responsavel_id(id, nome, email, cargo),
        demanda:conteudo_items!demanda_id(id, titulo, status)
      `)
      .single();

    if (error) {
      return traduzirErroBanco(error, 'PATCH /api/rotina/[id]');
    }

    return NextResponse.json({ tarefa: data });
  } catch {
    return respostaErro('Erro ao processar atualização.', 400);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;

  const { error } = await supabase
    .from('tarefas')
    .delete()
    .eq('id', id)
    .eq('agencia_id', membro.agencia_id);

  if (error) {
    return traduzirErroBanco(error, 'DELETE /api/rotina/[id]');
  }

  return NextResponse.json({ ok: true });
}
