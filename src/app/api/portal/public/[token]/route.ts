import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const { data: cliente, error: erroCliente } = await db
      .from('clientes')
      .select(`
        id, agencia_id, nome, nicho, cor, cor_capa, foto_url, foto_url_dark,
        valor_mensal, dia_vencimento, regras_aprovacao,
        agencia:agencias(id, nome, email_contato, telefone_contato, chave_pix)
      `)
      .eq('token_portal', token)
      .maybeSingle();

    if (erroCliente || !cliente) {
      return respostaErro('Portal do cliente não encontrado ou link expirado.', 404);
    }

    // Busca demandas visíveis para o cliente (ou que estão em aprovação)
    const { data: demandas } = await db
      .from('conteudo_items')
      .select(`
        id, titulo, formato, status, data_prazo, horario, legenda, briefing_html,
        midia_urls, portal_cliente_visivel, pedido_info, pedido_info_respondido,
        pedido_info_resposta, concluida, criado_em
      `)
      .eq('cliente_id', cliente.id)
      .or('portal_cliente_visivel.eq.true,status.eq.aprovacao')
      .order('criado_em', { ascending: false });

    // Busca contratos do cliente
    const { data: contratos } = await db
      .from('contratos')
      .select('id, titulo, status, valor_mensal, dia_vencimento, data_inicio, data_termino, token_publico, criado_em')
      .eq('cliente_id', cliente.id)
      .order('criado_em', { ascending: false });

    return NextResponse.json({
      cliente,
      demandas: demandas || [],
      contratos: contratos || [],
    });
  } catch (err) {
    console.error('Erro ao buscar dados do portal público:', err);
    return respostaErro('Erro ao processar dados do portal.', 500);
  }
}
