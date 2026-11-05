import { describe, it, expect } from 'vitest';
import { contarHashtags, desformatar, paraCapitalizado, paraItalico, paraMaiusculas, paraMinusculas, paraNegrito } from './legenda-texto';

describe('legenda-texto', () => {
  it('negrito e itálico unicode mantêm o que não é letra', () => {
    expect(paraNegrito('Oi 2026!')).toBe('𝗢𝗶 𝟮𝟬𝟮𝟲!');
    expect(paraItalico('Oi')).toBe('𝘖𝘪');
  });
  it('desformatar volta ao texto comum e permite trocar de estilo', () => {
    expect(desformatar(paraNegrito('Black Friday'))).toBe('Black Friday');
    expect(paraItalico(paraNegrito('ab'))).toBe(paraItalico('ab'));
  });
  it('troca de caixa respeita acentos', () => {
    expect(paraMaiusculas('promoção')).toBe('PROMOÇÃO');
    expect(paraMinusculas('PROMOÇÃO')).toBe('promoção');
    expect(paraCapitalizado('black friday (últimos dias)')).toBe('Black Friday (Últimos Dias)');
  });
  it('conta hashtags', () => {
    expect(contarHashtags('Oi #blackfriday e #promoção, sem#colado')).toBe(2);
  });
});
