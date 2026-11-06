import { describe, it, expect } from 'vitest';
import {
  formatarUsernameInstagram,
  formatarHandleInstagram,
  formatarTempoRelativoInstagram,
  calcularEscalaDotCarrossel,
} from './instagram-format';

describe('formatarUsernameInstagram', () => {
  it('retorna o username oficial sem arroba', () => {
    expect(formatarUsernameInstagram('PH Cursos', '@ph__cursos')).toBe('ph__cursos');
    expect(formatarUsernameInstagram('Vick Machado', 'byvickmachado')).toBe('byvickmachado');
  });

  it('formata o nome quando não há instagramUsername', () => {
    expect(formatarUsernameInstagram('Agência GENS')).toBe('ag_ncia_gens');
    expect(formatarUsernameInstagram('@ph_cursos')).toBe('ph_cursos');
  });

  it('retorna fallback quando vazio', () => {
    expect(formatarUsernameInstagram('')).toBe('perfil');
    expect(formatarUsernameInstagram(null)).toBe('perfil');
  });
});

describe('formatarHandleInstagram', () => {
  it('mantém handles que já começam com @', () => {
    expect(formatarHandleInstagram('@meuperfil')).toBe('@meuperfil');
    expect(formatarHandleInstagram('@ph__cursos')).toBe('@ph__cursos');
  });

  it('adiciona @ para nomes comuns', () => {
    expect(formatarHandleInstagram('PH Cursos')).toBe('@ph_cursos');
  });
});

describe('formatarTempoRelativoInstagram', () => {
  it('retorna padrão se não informado', () => {
    expect(formatarTempoRelativoInstagram(null)).toBe('há 3 horas');
  });

  it('formata minutos e horas adequadamente', () => {
    const agora = Date.now();
    const trintaMinAtras = new Date(agora - 37 * 60 * 1000);
    expect(formatarTempoRelativoInstagram(trintaMinAtras)).toBe('há 37 minutos');

    const duasHorasAtras = new Date(agora - 2 * 60 * 60 * 1000);
    expect(formatarTempoRelativoInstagram(duasHorasAtras)).toBe('há 2 horas');
  });
});

describe('calcularEscalaDotCarrossel', () => {
  it('retorna escala normal quando há 5 ou menos slides', () => {
    expect(calcularEscalaDotCarrossel(0, 0, 4)).toBe('scale-100');
  });

  it('escala bolinhas distantes quando há mais de 5 slides', () => {
    expect(calcularEscalaDotCarrossel(0, 0, 8)).toBe('scale-100');
    expect(calcularEscalaDotCarrossel(2, 0, 8)).toBe('scale-75');
    expect(calcularEscalaDotCarrossel(3, 0, 8)).toBe('scale-50');
  });
});
