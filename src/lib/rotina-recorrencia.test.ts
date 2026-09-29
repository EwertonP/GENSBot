import { describe, expect, it } from 'vitest';
import { descreverRegra, hojeBrasilia, ocorreEm, proximaOcorrencia, somarDias, validarRegra } from './rotina-recorrencia';

const semanal = (dias: number[], inicio = '2026-01-01') => ({ frequencia: 'semanal' as const, dias_semana: dias, dia_mes: null, inicio_em: inicio });
const mensal = (dia: number, inicio = '2026-01-01') => ({ frequencia: 'mensal' as const, dias_semana: [], dia_mes: dia, inicio_em: inicio });

describe('ocorreEm', () => {
  it('semanal por dia da semana (2026-09-28 é segunda)', () => {
    expect(ocorreEm(semanal([1]), '2026-09-28')).toBe(true);
    expect(ocorreEm(semanal([1]), '2026-09-29')).toBe(false);
    expect(ocorreEm(semanal([0, 6]), '2026-10-03')).toBe(true); // sábado
  });
  it('mensal cai no último dia em mês curto', () => {
    expect(ocorreEm(mensal(31), '2026-02-28')).toBe(true);
    expect(ocorreEm(mensal(31), '2026-02-27')).toBe(false);
    expect(ocorreEm(mensal(30), '2026-04-30')).toBe(true);
    expect(ocorreEm(mensal(20), '2026-10-20')).toBe(true);
  });
  it('não gera antes do início', () => {
    expect(ocorreEm(semanal([1], '2026-10-01'), '2026-09-28')).toBe(false);
  });
});

describe('proximaOcorrencia', () => {
  it('acha a próxima data a partir de hoje, inclusive', () => {
    expect(proximaOcorrencia(semanal([5]), '2026-09-28')).toBe('2026-10-02');
    expect(proximaOcorrencia(mensal(25), '2026-09-26')).toBe('2026-10-25');
    expect(proximaOcorrencia(mensal(25), '2026-09-25')).toBe('2026-09-25');
  });
});

describe('descreverRegra', () => {
  it('escreve em português', () => {
    expect(descreverRegra(semanal([1, 2, 3, 4, 5]))).toBe('Todo dia útil');
    expect(descreverRegra(semanal([5, 1, 3]))).toBe('Toda seg, qua e sex');
    expect(descreverRegra(semanal([1]))).toBe('Toda seg');
    expect(descreverRegra(mensal(20))).toBe('Todo dia 20 do mês');
  });
});

describe('validarRegra', () => {
  it('normaliza e recusa entradas ruins', () => {
    expect(validarRegra({ frequencia: 'semanal', dias_semana: [5, 1, 1, 9] })).toEqual({ ok: true, frequencia: 'semanal', dias_semana: [1, 5], dia_mes: null });
    expect(validarRegra({ frequencia: 'semanal', dias_semana: [] })).toMatchObject({ ok: false });
    expect(validarRegra({ frequencia: 'mensal', dia_mes: 32 })).toMatchObject({ ok: false });
    expect(validarRegra({ frequencia: 'anual' })).toMatchObject({ ok: false });
  });
});

describe('datas', () => {
  it('soma dias atravessando mês e usa o fuso de Brasília', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(hojeBrasilia(new Date('2026-09-29T02:00:00Z'))).toBe('2026-09-28'); // 23h em Brasília
  });
});
