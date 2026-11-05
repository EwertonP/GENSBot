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
      .select('id')
      .eq('token_portal', token)
      .maybeSingle();

    if (!cliente) return respostaErro('Acesso não autorizado.', 403);

    const body = await req.json();
    const { itemId, resposta } = body;

    if (!itemId || !resposta?.trim()) {
      return respostaErro('ID do item e resposta são obrigatórios.', 400);
    }

    const { data, error } = await db
      .from('conteudo_items')
      .update({
        pedido_info_resposta: resposta.trim(),
        pedido_info_respondido: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('cliente_id', cliente.id)
      .select('id, pedido_info_resposta, pedido_info_respondido')
      .single();

    if (error) {
      console.error('Erro ao responder pedido de info:', error);
      return respostaErro('Falha ao enviar resposta.', 500);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (err) {
    console.error('Erro no portal ao responder pedido de info:', err);
    return respostaErro('Erro interno.', 500);
  }
}
