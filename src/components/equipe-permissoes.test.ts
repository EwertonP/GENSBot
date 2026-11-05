import { describe, it, expect } from 'vitest';
import { calcularTempoDeCasa, formatarAniversario } from './equipe-tab';
import { abasDoMembro, ABAS, ABAS_MEMBRO_ESCOPADO } from './nav-config';

describe('Equipe: Funções e Permissões de Acesso', () => {
  it('calcula tempo de casa corretamente', () => {
    expect(calcularTempoDeCasa(null)).toBeNull();
    expect(calcularTempoDeCasa('')).toBeNull();

    const dataRecente = new Date().toISOString().slice(0, 10);
    expect(calcularTempoDeCasa(dataRecente)).toBe('Recente (< 1 mês)');

    // Data de 1 ano atrás
    const umAnoAtras = new Date();
    umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
    const res = calcularTempoDeCasa(umAnoAtras.toISOString().slice(0, 10));
    expect(res).toContain('ano');
  });

  it('formata aniversário corretamente', () => {
    expect(formatarAniversario(null)).toBeNull();
    expect(formatarAniversario('1995-08-25')).toBe('25/08');
    expect(formatarAniversario('2000-12-01')).toBe('01/12');
  });

  it('abasDoMembro retorna todas as abas para sócio master', () => {
    const abas = abasDoMembro('master');
    expect(abas).toEqual(ABAS);
  });

  it('abasDoMembro retorna padrão escopado para membro sem módulos customizados', () => {
    const abas = abasDoMembro('membro');
    expect(abas).toEqual(ABAS_MEMBRO_ESCOPADO);
  });

  it('abasDoMembro restringe aos módulos permitidos quando configurado (ex: Financeiro)', () => {
    const abas = abasDoMembro('membro', ['financeiro']);
    expect(abas).toContain('financeiro');
    expect(abas).toContain('meu_dia'); // Sempre garante cockpit operacional
    expect(abas).not.toContain('crm');
    expect(abas).not.toContain('documentos');
  });

  it('abasDoMembro para designer libera apenas esteira e produção', () => {
    const abas = abasDoMembro('membro', ['esteira', 'publish']);
    expect(abas).toContain('esteira');
    expect(abas).toContain('publish');
    expect(abas).toContain('meu_dia');
    expect(abas).not.toContain('financeiro');
  });
});
