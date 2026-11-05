import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;
  const { id } = await params;

  try {
    const { data, error } = await db
      .from('contrato_eventos')
      .select(`
        id, contrato_id, tipo, ip, user_agent, membro_id, dados, criado_em,
        membro:membros(id, nome, email)
      `)
      .eq('contrato_id', id)
      .eq('agencia_id', membro.agencia_id)
      .order('criado_em', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ eventos: [] });
      }
      console.error('Erro ao buscar eventos do contrato:', error);
      return respostaErro('Não foi possível carregar o histórico de eventos.', 500);
    }

    return NextResponse.json({ eventos: data || [] });
  } catch (err) {
    console.error('Erro na rota GET /api/contratos/[id]/eventos:', err);
    return NextResponse.json({ eventos: [] });
  }
}
