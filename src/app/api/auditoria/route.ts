import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { supabase as db } from '@/lib/supabase';
import { agruparEventosPorData, type EventoAuditoria } from '@/lib/auditoria';

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const modulo = searchParams.get('modulo');
  const clienteId = searchParams.get('cliente_id');
  const membroId = searchParams.get('membro_id');
  const busca = searchParams.get('busca');
  const limite = Math.min(Math.max(Number(searchParams.get('limite')) || 50, 1), 200);

  try {
    let query = db
      .from('auditoria_eventos')
      .select(`
        id,
        agencia_id,
        membro_id,
        cliente_id,
        modulo,
        acao,
        descricao,
        detalhes,
        criado_em,
        membro:membros(id, nome, foto_url),
        cliente:clientes(id, nome)
      `)
      .eq('agencia_id', membro.agencia_id)
      .order('criado_em', { ascending: false })
      .limit(limite);

    if (modulo && modulo !== 'all') {
      query = query.eq('modulo', modulo);
    }
    if (clienteId && clienteId !== 'all') {
      query = query.eq('cliente_id', clienteId);
    }
    if (membroId && membroId !== 'all') {
      query = query.eq('membro_id', membroId);
    }
    if (busca && busca.trim()) {
      query = query.ilike('descricao', `%${busca.trim()}%`);
    }

    const { data: eventos, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        // Tabela não migrada ainda: responde vazio sem quebrar
        return NextResponse.json({ eventos: [], grupos: [] });
      }
      throw error;
    }

    const lista = (eventos as unknown as EventoAuditoria[]) || [];
    const grupos = agruparEventosPorData(lista);

    return NextResponse.json({
      eventos: lista,
      grupos,
    });
  } catch (err) {
    console.error('Erro na rota GET /api/auditoria:', err);
    return respostaErro('Falha ao carregar histórico de auditoria.', 500);
  }
}
