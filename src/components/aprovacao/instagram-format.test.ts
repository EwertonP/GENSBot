import { describe, it, expect } from 'vitest';
import {
  formatarHandleInstagram,
  calcularEscalaDotCarrossel,
} from './instagram-format';

describe('formatarHandleInstagram', () => {
  it('mantém handles que já começam com @', () => {
    expect(formatarHandleInstagram('@meuperfil')).toBe('@meuperfil');
    expect(formatarHandleInstagram('@ph__cursos')).toBe('@ph__cursos');
  });

  it('formata nomes de empresas e pessoas em handle válido', () => {
    expect(formatarHandleInstagram('Agência GENS')).toBe('@ag_ncia_gens');
    expect(formatarHandleInstagram('PH Cursos')).toBe('@ph_cursos');
    expect(formatarHandleInstagram('Bakanas Net')).toBe('@bakanas_net');
  });

  it('lida com valores nulos ou vazios com fallback', () => {
    expect(formatarHandleInstagram('')).toBe('@usuario');
    expect(formatarHandleInstagram(null)).toBe('@usuario');
    expect(formatarHandleInstagram(undefined)).toBe('@usuario');
  });
});

describe('calcularEscalaDotCarrossel', () => {
  it('retorna escala normal quando há 5 ou menos slides', () => {
    expect(calcularEscalaDotCarrossel(0, 0, 4)).toBe('scale-100');
    expect(calcularEscalaDotCarrossel(3, 0, 4)).toBe('scale-100');
  });

  it('escala bolinhas distantes progressivamente quando há mais de 5 slides', () => {
    // 8 slides, ativo no slide 0
    expect(calcularEscalaDotCarrossel(0, 0, 8)).toBe('scale-100');
    expect(calcularEscalaDotCarrossel(1, 0, 8)).toBe('scale-100');
    expect(calcularEscalaDotCarrossel(2, 0, 8)).toBe('scale-75');
    expect(calcularEscalaDotCarrossel(3, 0, 8)).toBe('scale-50');
    expect(calcularEscalaDotCarrossel(7, 0, 8)).toBe('scale-50');
  });
});
