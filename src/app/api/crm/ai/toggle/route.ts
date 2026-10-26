import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

// POST: Alterna o status ativo (true/false) da IA do cliente ou da agência
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const { cliente_id, ativo } = body;

    // Se o usuário for cliente (ex: secretária), ele só pode alterar a IA do seu próprio cliente
    let targetClienteId = cliente_id || null;
    if (membro.papel === 'cliente') {
      if (!membro.cliente_id) {
        return respostaErro('Usuário cliente sem vínculo associado.', 403);
      }
      targetClienteId = membro.cliente_id;
    }

    const ehAgencia = !targetClienteId || targetClienteId === 'agencia' || targetClienteId === 'null';

    // Busca configuração existente
    let query = serviceSupabase
      .from('ai_agent_configs')
      .select('id, ativo')
      .eq('agencia_id', membro.agencia_id);

    if (ehAgencia) {
      query = query.is('cliente_id', null);
    } else {
      query = query.eq('cliente_id', targetClienteId);
    }

    const { data: configExistente, error: errBusca } = await query.maybeSingle();
    if (errBusca) return traduzirErroBanco(errBusca, 'POST /api/crm/ai/toggle - busca');

    const novoStatusAtivo = typeof ativo === 'boolean' ? ativo : !configExistente?.ativo;

    if (configExistente) {
      const { data, error } = await serviceSupabase
        .from('ai_agent_configs')
        .update({
          ativo: novoStatusAtivo,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', configExistente.id)
        .select()
        .single();

      if (error) return traduzirErroBanco(error, 'POST /api/crm/ai/toggle - update');
      return NextResponse.json({ sucesso: true, ativo: data.ativo });
    } else {
      // Se ainda não existir config criada pelo admin, cria um registro inicial padrão
      const { data, error } = await serviceSupabase
        .from('ai_agent_configs')
        .insert({
          agencia_id: membro.agencia_id,
          cliente_id: ehAgencia ? null : targetClienteId,
          ativo: novoStatusAtivo,
          provedor: 'openai',
          modelo: 'gpt-4o-mini',
          nome_agente: 'Assistente Comercial',
          prompt_sistema: 'Você é um assistente comercial cordial.',
          atualizado_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) return traduzirErroBanco(error, 'POST /api/crm/ai/toggle - insert');
      return NextResponse.json({ sucesso: true, ativo: data.ativo });
    }
  } catch (err: unknown) {
    console.error('Erro ao alternar status da IA:', err);
    return respostaErro('Falha interna ao alternar status da IA.', 500);
  }
}
