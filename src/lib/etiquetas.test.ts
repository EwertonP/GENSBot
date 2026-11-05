import { describe, it, expect } from 'vitest';
import { alternarEtiqueta, corDaEtiqueta, ehCorEtiqueta, nomeEtiquetaValido } from './etiquetas';

describe('etiquetas', () => {
  it('valida o nome', () => {
    expect(nomeEtiquetaValido('  Black   Friday ')).toBe('Black Friday');
    expect(nomeEtiquetaValido('   ')).toBeNull();
    expect(nomeEtiquetaValido('x'.repeat(41))).toBeNull();
    expect(nomeEtiquetaValido(3)).toBeNull();
  });
  it('só aceita cores da paleta', () => {
    expect(ehCorEtiqueta('red')).toBe(true);
    expect(ehCorEtiqueta('hotpink')).toBe(false);
    expect(corDaEtiqueta('hotpink').rotulo).toBe('Cinza');
  });
  it('alterna ids', () => {
    expect(alternarEtiqueta(['a'], 'b')).toEqual(['a', 'b']);
    expect(alternarEtiqueta(['a', 'b'], 'a')).toEqual(['b']);
  });
});
