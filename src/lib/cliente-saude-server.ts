import { supabase as db } from '@/lib/supabase';
import { calcularIndiceSaude, type DiagnosticoSaude } from './cliente-saude';

/**
 * Carrega as métricas reais do banco para calcular o Índice de Saúde de um cliente
 */
export async function obterDiagnosticoSaudeCliente(
  clienteId: string,
  agenciaId: string,
  postsMesContratados: number = 0
): Promise<DiagnosticoSaude> {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const fimMes = `${hoje.slice(0, 7)}-31`;

  try {
    const [demandasRes, financeiroRes] = await Promise.all([
      db
        .from('conteudo_items')
        .select('id, status, data_prazo, criado_em, aprovacao_solicitada_em')
        .eq('cliente_id', clienteId)
        .eq('agencia_id', agenciaId),
      db
        .from('lancamentos')
        .select('id, pago, vencimento')
        .eq('cliente_id', clienteId)
        .eq('agencia_id', agenciaId)
        .eq('tipo', 'receita')
        .lt('vencimento', hoje)
        .eq('pago', false),
    ]);

    const demandas = demandasRes.data || [];
    const atrasadas = demandas.filter(
      (d) => d.data_prazo && d.data_prazo < hoje && d.status !== 'postado' && d.status !== 'concluido'
    ).length;

    // Aprovações paradas há mais de 48h
    const agoraMs = Date.now();
    const paradas48h = demandas.filter((d) => {
      if (d.status !== 'aprovacao' || !d.aprovacao_solicitada_em) return false;
      const solicitadaMs = new Date(d.aprovacao_solicitada_em).getTime();
      return agoraMs - solicitadaMs > 48 * 60 * 60 * 1000;
    }).length;

    // Entregas no mês atual
    const entregasNoMes = demandas.filter(
      (d) =>
        (d.status === 'postado' || d.status === 'concluido') &&
        d.data_prazo &&
        d.data_prazo >= inicioMes &&
        d.data_prazo <= fimMes
    ).length;

    const mensalidadeAtrasada = (financeiroRes.data || []).length > 0;

    return calcularIndiceSaude({
      demandasAtrasadas: atrasadas,
      aprovacoesParadas48h: paradas48h,
      mensalidadeAtrasada,
      entregasNoMes,
      postsMesContratados,
    });
  } catch (err) {
    console.error('Erro ao calcular índice de saúde do cliente:', err);
    return calcularIndiceSaude({});
  }
}
