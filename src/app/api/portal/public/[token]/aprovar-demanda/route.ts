import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const { data: cliente } = await db
      .from('clientes')
      .select('id, regras_aprovacao')
      .eq('token_portal', token)
      .maybeSingle();

    if (!cliente) return respostaErro('Acesso não autorizado.', 403);

    const body = await req.json();
    const { itemId, acao, feedback } = body;

    if (!itemId || !acao) {
      return respostaErro('Parâmetros incompletos.', 400);
    }

    const regras = (cliente.regras_aprovacao as {
      aprovado_coluna?: string;
      alteracao_coluna?: string;
      reprovado_coluna?: string;
    }) || {};

    const agora = new Date().toISOString();
    const dadosAtualizar: Record<string, unknown> = {
      atualizado_em: agora,
    };

    if (acao === 'aprovar') {
      dadosAtualizar.status = regras.aprovado_coluna || 'aprovado';
      dadosAtualizar.aprovado_em = agora;
    } else if (acao === 'ajustes') {
      dadosAtualizar.status = regras.alteracao_coluna || 'ajustes';
      dadosAtualizar.ajustes_solicitados = feedback?.trim() || 'Ajustes solicitados pelo cliente';
      dadosAtualizar.ajuste_solicitado_em = agora;
    } else {
      return respostaErro('Ação desconhecida.', 400);
    }

    const { data, error } = await db
      .from('conteudo_items')
      .update(dadosAtualizar)
      .eq('id', itemId)
      .eq('cliente_id', cliente.id)
      .select('id, status, aprovado_em, ajustes_solicitados')
      .single();

    if (error) {
      console.error('Erro ao aprovar/solicitar ajustes:', error);
      return respostaErro('Falha ao atualizar status da demanda.', 500);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (err) {
    console.error('Erro na aprovação pelo portal:', err);
    return respostaErro('Erro ao processar aprovação.', 500);
  }
}
