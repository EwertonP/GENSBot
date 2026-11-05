import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { obterDiagnosticoSaudeCliente } from '@/lib/cliente-saude-server';
import { supabase as db } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const { data: cliente } = await db
      .from('clientes')
      .select('id, posts_mes, reels_mes')
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .maybeSingle();

    if (!cliente) return respostaErro('Cliente não encontrado.', 404);

    const postsContratados = (cliente.posts_mes || 0) + (cliente.reels_mes || 0);
    const saude = await obterDiagnosticoSaudeCliente(cliente.id, membro.agencia_id, postsContratados);

    return NextResponse.json({ saude });
  } catch (err) {
    console.error('Erro na rota /api/clientes/[id]/saude:', err);
    return respostaErro('Falha ao calcular saúde do cliente.', 500);
  }
}
