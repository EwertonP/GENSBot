import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  try {
    const body = await req.json();
    const { cliente_id, mes_origem, mes_destino } = body;

    if (!cliente_id || !mes_origem || !mes_destino) {
      return respostaErro('cliente_id, mes_origem e mes_destino são obrigatórios.', 400);
    }

    // 1. Busca os itens do mês de origem
    const { data: itensOrigem, error: erroBusca } = await supabase
      .from('conteudo_items')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('mes_referencia', mes_origem)
      .order('ordem', { ascending: true });

    if (erroBusca) {
      return traduzirErroBanco(erroBusca, 'POST /api/conteudo/duplicar-mes busca');
    }

    if (!itensOrigem || itensOrigem.length === 0) {
      return respostaErro(
        'Nenhuma publicação encontrada no mês de origem para duplicar.',
        404
      );
    }

    // 2. Prepara novos itens para o mês de destino
    const novosItens = itensOrigem.map((item: any) => ({
      agencia_id: membro.agencia_id,
      cliente_id,
      tipo: item.tipo,
      status: 'planejamento',
      titulo: item.titulo,
      briefing: item.briefing || null,
      legenda: null,
      mes_referencia: mes_destino,
      ordem: item.ordem,
      responsavel_id: item.responsavel_id,
      editor_id: item.editor_id,
      arquivos: [],
      data_programada: null,
      prazo: null,
    }));

    // 3. Insere no banco
    const { data: itensCriados, error: erroInsert } = await supabase
      .from('conteudo_items')
      .insert(novosItens)
      .select(`
        *,
        responsavel:membros!responsavel_id(id, nome, email, papel, cargo),
        editor:membros!editor_id(id, nome, email, papel, cargo),
        cliente:clientes(id, nome, cor, nicho, foto_url, instagram_account_id)
      `);

    if (erroInsert) {
      return traduzirErroBanco(erroInsert, 'POST /api/conteudo/duplicar-mes insert');
    }

    return NextResponse.json({
      ok: true,
      duplicados: itensCriados?.length || 0,
      items: itensCriados || [],
    });
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }
}
