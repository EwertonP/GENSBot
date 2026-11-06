import { describe, expect, it } from 'vitest';
import { dataLimiteTexto, diasRetencaoTexto, vencidaParaExcluir } from './retencao';

describe('diasRetencaoTexto', () => {
  it('usa o padrão sem valor ou fora da faixa', () => {
    expect(diasRetencaoTexto(null)).toBe(30);
    expect(diasRetencaoTexto(undefined)).toBe(30);
    expect(diasRetencaoTexto(3)).toBe(30);
    expect(diasRetencaoTexto(900)).toBe(30);
    expect(diasRetencaoTexto(Number.NaN)).toBe(30);
  });
  it('aceita de 7 a 365', () => {
    expect(diasRetencaoTexto(7)).toBe(7);
    expect(diasRetencaoTexto(60)).toBe(60);
    expect(diasRetencaoTexto(365)).toBe(365);
  });
});

describe('prazo', () => {
  it('data limite soma os dias à publicação', () => {
    expect(dataLimiteTexto('2026-11-01T12:00:00.000Z', 30)).toBe('2026-12-01T12:00:00.000Z');
    expect(dataLimiteTexto(null, 30)).toBeNull();
    expect(dataLimiteTexto('lixo', 30)).toBeNull();
  });
  it('vence no dia exato e depois, não antes', () => {
    const pub = '2026-11-01T12:00:00.000Z';
    expect(vencidaParaExcluir(pub, 30, new Date('2026-12-01T11:59:59Z'))).toBe(false);
    expect(vencidaParaExcluir(pub, 30, new Date('2026-12-01T12:00:00Z'))).toBe(true);
    expect(vencidaParaExcluir(null, 30)).toBe(false);
  });
});
