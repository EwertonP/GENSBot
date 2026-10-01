import { describe, it, expect } from 'vitest';
import { formatPhone, respostasDe } from './contact-format';

describe('formatPhone', () => {
  it('formata celular e fixo brasileiros', () => {
    expect(formatPhone('+5581999998888')).toBe('(81) 99999-8888');
    expect(formatPhone('+558133334444')).toBe('(81) 3333-4444');
  });
  it('devolve como veio o que não é +55', () => {
    expect(formatPhone('+351912345678')).toBe('+351912345678');
    expect(formatPhone('81999998888')).toBe('81999998888');
    expect(formatPhone(null)).toBe('');
  });
});

describe('respostasDe', () => {
  it('mostra as respostas e esconde o estado interno do motor', () => {
    expect(respostasDe({ cargo: 'Soldado', idade: 24, _capture: { field: 'email' } })).toEqual({ cargo: 'Soldado', idade: '24' });
  });
  it('aguenta flow_state vazio ou nulo', () => {
    expect(respostasDe(null)).toEqual({});
    expect(respostasDe({})).toEqual({});
  });
});
