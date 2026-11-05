import { describe, it, expect } from 'vitest';
import { calcularIndiceSaude } from './cliente-saude';

describe('Cálculo de Índice de Saúde do Cliente', () => {
  it('retorna 100 e status excelente para cliente sem pendências', () => {
    const res = calcularIndiceSaude({
      demandasAtrasadas: 0,
      aprovacoesParadas48h: 0,
      mensalidadeAtrasada: false,
      entregasNoMes: 12,
      postsMesContratados: 12,
    });

    expect(res.score).toBe(100);
    expect(res.classificacao).toBe('excelente');
    expect(res.label).toBe('Excelente');
  });

  it('reduz pontos em caso de atraso financeiro e operacional', () => {
    const res = calcularIndiceSaude({
      demandasAtrasadas: 2, // -30
      aprovacoesParadas48h: 1, // -10
      mensalidadeAtrasada: true, // -25
      entregasNoMes: 2,
      postsMesContratados: 10,
    });

    // 100 - 30 - 10 - 25 = 35
    expect(res.score).toBe(35);
    expect(res.classificacao).toBe('critico');
    expect(res.label).toBe('Em Risco');
  });

  it('classifica como atencao quando o score está entre 50 e 79', () => {
    const res = calcularIndiceSaude({
      demandasAtrasadas: 1, // -15
      aprovacoesParadas48h: 1, // -10
      mensalidadeAtrasada: false,
      entregasNoMes: 4,
      postsMesContratados: 8,
    });

    // 100 - 15 - 10 = 75
    expect(res.score).toBe(75);
    expect(res.classificacao).toBe('atencao');
    expect(res.label).toBe('Atenção');
  });

  it('nunca retorna score menor que 0 ou maior que 100', () => {
    const resCritico = calcularIndiceSaude({
      demandasAtrasadas: 10,
      aprovacoesParadas48h: 10,
      mensalidadeAtrasada: true,
      entregasNoMes: 0,
      postsMesContratados: 20,
    });
    expect(resCritico.score).toBe(0);

    const resPerfeito = calcularIndiceSaude({
      demandasAtrasadas: 0,
      aprovacoesParadas48h: 0,
      mensalidadeAtrasada: false,
      entregasNoMes: 50,
      postsMesContratados: 10,
    });
    expect(resPerfeito.score).toBe(100);
  });
});
