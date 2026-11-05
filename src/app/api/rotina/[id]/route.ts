import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import {
  STATUS_TAREFA_VALIDOS,
  TIPOS_TAREFA_VALIDOS,
  camposDaTransicao,
  normalizarStatusTarefa,
} from '@/lib/rotina';

type Params = { params: Promise<{ id: string }> };

function extrairColunaInexistente(error: { message?: string; details?: string; hint?: string } | null | undefined): string | null {
  if (!error) return null;
  const texto = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  const m1 = texto.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation ["']?tarefas["']? does not exist/i);
  if (m1) return m1[1];
  const m2 = texto.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column of ['"]?tarefas['"]? in the schema cache/i);
  if (m2) return m2[1];
  const m3 = texto.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  if (m3) return m3[1];
  return null;
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
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
      const statusStr = String(updates.status || '').toLowerCase().trim();
      const statusValido = (STATUS_TAREFA_VALIDOS as readonly string[]).includes(statusStr);
      if (!statusValido) {
        return respostaErro(`Status de tarefa inválido: ${updates.status}.`, 400);
      }
      const novo = normalizarStatusTarefa(statusStr);
      updates.status = novo;

      let atual: { iniciado_em: string | null } | null = null;
      try {
        const buscarAtual = (db: typeof supabase) =>
          db.from('tarefas').select('iniciado_em').eq('id', id).eq('agencia_id', membro.agencia_id).maybeSingle();
        const resAtual = await buscarAtual(supabase);
        if (resAtual.data) {
          atual = resAtual.data;
        } else {
          const resFallback = await serviceSupabase.from('tarefas').select('iniciado_em').eq('id', id).maybeSingle();
          atual = resFallback.data;
        }
      } catch {
        atual = null;
      }

      const derivados = camposDaTransicao(novo, atual);
      // aguardando_de enviado junto com a mudança para Aguardando tem prioridade.
      if (novo === 'aguardando' && 'aguardando_de' in updates) delete derivados.aguardando_de;
      Object.assign(updates, derivados);
    }

    updates.atualizado_em = new Date().toISOString();

    const SELECT = `
        *,
        cliente:clientes(id, nome, cor, foto_url),
        responsavel:membros!responsavel_id(id, nome, email, cargo),
        demanda:conteudo_items!demanda_id(id, titulo, status)
      `;

    let data: any = null;
    let error: any = null;
    const MAX_TENTATIVAS = 6;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      // 1. Tenta com sessão autenticada (RLS)
      const resUser = await supabase
        .from('tarefas')
        .update(updates)
        .eq('id', id)
        .eq('agencia_id', membro.agencia_id)
        .select(SELECT)
        .maybeSingle();

      data = resUser.data;
      error = resUser.error;

      // 2. Se RLS falhou ou não encontrou na agência, tenta com service role
      if (error || !data) {
        const resService = await serviceSupabase
          .from('tarefas')
          .update(updates)
          .eq('id', id)
          .select(SELECT)
          .maybeSingle();

        if (resService.data) {
          data = resService.data;
          error = null;
        } else if (resService.error) {
          error = resService.error;
        }
      }

      // 3. Se falhou por causa do SELECT relacional (schema cache ou relação), tenta com select('*')
      if (error && !data && (error.code === 'PGRST200' || error.message?.includes('relationship') || error.message?.includes('schema cache'))) {
        const col = extrairColunaInexistente(error);
        if (!col) {
          const resSimples = await serviceSupabase
            .from('tarefas')
            .update(updates)
            .eq('id', id)
            .select('*')
            .maybeSingle();

          if (resSimples.data) {
            data = resSimples.data;
            error = null;
            break;
          }
        }
      }

      // 4. Se o erro for de coluna inexistente (PGRST204 ou 42703), remove do updates e tenta de novo
      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        const colInexistente = extrairColunaInexistente(error);
        if (colInexistente && colInexistente in updates) {
          console.warn(`PATCH /api/rotina/[id]: coluna "${colInexistente}" não existe na tabela tarefas. Removendo do payload e tentando novamente...`);
          delete updates[colInexistente];
          continue;
        }
      }

      break;
    }

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
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;

  let { error } = await supabase.from('tarefas').delete().eq('id', id).eq('agencia_id', membro.agencia_id);
  if (error) {
    console.warn('DELETE /api/rotina/[id]: fallback service role:', error.message);
    ({ error } = await serviceSupabase.from('tarefas').delete().eq('id', id));
  }

  if (error) {
    return traduzirErroBanco(error, 'DELETE /api/rotina/[id]');
  }

  return NextResponse.json({ ok: true });
}
