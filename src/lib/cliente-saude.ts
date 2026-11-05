export interface MotivoSaude {
  texto: string;
  impacto: number;
  tipo: 'positivo' | 'negativo' | 'neutro';
}

export interface DiagnosticoSaude {
  score: number; // 0 a 100
  classificacao: 'excelente' | 'atencao' | 'critico';
  cor: string;
  label: string;
  motivos: MotivoSaude[];
  resumo: string;
}

export interface ParametrosSaude {
  demandasAtrasadas?: number;
  aprovacoesParadas48h?: number;
  mensalidadeAtrasada?: boolean;
  entregasNoMes?: number;
  postsMesContratados?: number;
}

/**
 * Calcula o Índice de Saúde do Cliente (0 a 100).
 * Documentação da Fórmula:
 * - Base inicial: 100 pontos
 * - Demandas em atraso: -15 pontos por demanda (máximo -30 pontos)
 * - Aprovações paradas há mais de 48h: -10 pontos por aprovação (máximo -25 pontos)
 * - Pagamento/Mensalidade em atraso: -25 pontos
 * - Produção estagnada (0 entregas no mês com meta > 0): -15 pontos
 * - Meta de entregas do mês 100% atingida: +5 pontos (limitado a 100)
 */
export function calcularIndiceSaude(params: ParametrosSaude): DiagnosticoSaude {
  const demandasAtrasadas = params.demandasAtrasadas || 0;
  const aprovacoesParadas = params.aprovacoesParadas48h || 0;
  const mensalidadeAtrasada = !!params.mensalidadeAtrasada;
  const entregasNoMes = params.entregasNoMes || 0;
  const postsMesContratados = params.postsMesContratados || 0;

  let score = 100;
  const motivos: MotivoSaude[] = [];

  // 1. Demandas atrasadas
  if (demandasAtrasadas > 0) {
    const perda = Math.min(demandasAtrasadas * 15, 60);
    score -= perda;
    motivos.push({
      texto: `${demandasAtrasadas} demanda${demandasAtrasadas > 1 ? 's' : ''} com prazo vencido`,
      impacto: -perda,
      tipo: 'negativo',
    });
  } else {
    motivos.push({
      texto: 'Todas as demandas dentro do prazo',
      impacto: 0,
      tipo: 'positivo',
    });
  }

  // 2. Aprovações paradas
  if (aprovacoesParadas > 0) {
    const perda = Math.min(aprovacoesParadas * 10, 40);
    score -= perda;
    motivos.push({
      texto: `${aprovacoesParadas} post${aprovacoesParadas > 1 ? 's' : ''} aguardando aprovação há mais de 48h`,
      impacto: -perda,
      tipo: 'negativo',
    });
  }

  // 3. Financeiro
  if (mensalidadeAtrasada) {
    score -= 25;
    motivos.push({
      texto: 'Mensalidade financeira pendente em atraso',
      impacto: -25,
      tipo: 'negativo',
    });
  } else {
    motivos.push({
      texto: 'Mensalidade em dia',
      impacto: 0,
      tipo: 'positivo',
    });
  }

  // 4. Ritmo de entrega
  if (postsMesContratados > 0) {
    if (entregasNoMes >= postsMesContratados) {
      score = Math.min(score + 5, 100);
      motivos.push({
        texto: `Meta mensal de entregas atingida (${entregasNoMes}/${postsMesContratados})`,
        impacto: 5,
        tipo: 'positivo',
      });
    } else if (entregasNoMes === 0) {
      score -= 15;
      motivos.push({
        texto: 'Nenhuma publicação concluída no mês atual',
        impacto: -15,
        tipo: 'negativo',
      });
    }
  }

  // Clampa entre 0 e 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  let classificacao: 'excelente' | 'atencao' | 'critico' = 'excelente';
  let cor = '#10b981'; // Verde
  let label = 'Excelente';
  let resumo = 'Operação saudável e entregas regulares.';

  if (score < 50) {
    classificacao = 'critico';
    cor = '#ef4444'; // Vermelho
    label = 'Em Risco';
    resumo = 'Atenção imediata: múltiplos atrasos operacionais ou pendência financeira.';
  } else if (score < 80) {
    classificacao = 'atencao';
    cor = '#f59e0b'; // Amarelo/Âmbar
    label = 'Atenção';
    resumo = 'Operação requer acompanhamento de prazos e aprovações.';
  }

  return {
    score,
    classificacao,
    cor,
    label,
    motivos,
    resumo,
  };
}
