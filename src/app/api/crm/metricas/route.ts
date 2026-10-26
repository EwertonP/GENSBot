import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { calcularMetricasPipeline } from '@/lib/crm';

// GET: Retorna as métricas agregadas do funil selecionado
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get('pipeline_id');
  const clienteId = searchParams.get('cliente_id');

  try {
    let query = serviceSupabase
      .from('crm_negocios')
      .select('valor, status')
      .eq('agencia_id', membro.agencia_id);

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId);
    }

    if (clienteId && clienteId !== 'all') {
      if (clienteId === 'agencia' || clienteId === 'null') {
        query = query.is('cliente_id', null);
      } else {
        query = query.eq('cliente_id', clienteId);
      }
    }

    const { data: negocios, error } = await query;
    if (error) return traduzirErroBanco(error, 'GET /api/crm/metricas');

    const metricas = calcularMetricasPipeline((negocios || []) as any);
    return NextResponse.json(metricas);
  } catch (err: any) {
    console.error('Erro ao calcular métricas do CRM:', err);
    return respostaErro('Falha interna ao calcular métricas.', 500);
  }
}
