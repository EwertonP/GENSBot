import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

// GET: Retorna os dados do membro atualmente autenticado
export async function GET() {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { user, membro } = auth.ctx;

  let clienteVinculado = null;
  if (membro.cliente_id) {
    const { data: cliente } = await serviceSupabase
      .from('clientes')
      .select('id, nome, nicho, cor, foto_url, instagram_account_id')
      .eq('id', membro.cliente_id)
      .maybeSingle();
    clienteVinculado = cliente;
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    membro: {
      id: membro.id,
      agencia_id: membro.agencia_id,
      nome: membro.nome,
      cargo: membro.cargo || null,
      foto_url: membro.foto_url || null,
      papel: membro.papel,
      ativo: membro.ativo,
      cliente_id: membro.cliente_id || null,
      cliente: clienteVinculado,
    },
  });
}
