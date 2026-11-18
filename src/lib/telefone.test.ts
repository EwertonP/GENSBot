import { describe, expect, it } from 'vitest';
import { jidParaE164, mesmoTelefone, normalizarTelefoneBR, telefoneDoJid, variantesTelefoneBR } from './telefone';

describe('telefoneDoJid', () => {
  it('tira o domínio do WhatsApp', () => {
    expect(telefoneDoJid('5583999990001@c.us')).toEqual({ digitos: '5583999990001', ehLid: false });
    expect(telefoneDoJid('5583999990001@s.whatsapp.net').digitos).toBe('5583999990001');
  });
  it('ignora o sufixo de aparelho', () => {
    expect(telefoneDoJid('5583999990001:12@s.whatsapp.net').digitos).toBe('5583999990001');
  });
  it('@lid não carrega telefone', () => {
    expect(telefoneDoJid('184730592839482@lid')).toEqual({ digitos: null, ehLid: true });
  });
  it('vazio e inválido', () => {
    expect(telefoneDoJid('')).toEqual({ digitos: null, ehLid: false });
    expect(telefoneDoJid(undefined).digitos).toBeNull();
    expect(telefoneDoJid('sem-numero@c.us').digitos).toBeNull();
  });
});

describe('normalizarTelefoneBR', () => {
  it('aceita E.164, máscara e número local', () => {
    expect(normalizarTelefoneBR('+55 (83) 99999-0001')).toBe('5583999990001');
    expect(normalizarTelefoneBR('83999990001')).toBe('5583999990001');
    expect(normalizarTelefoneBR('(83) 3333-4444')).toBe('558333334444');
    expect(normalizarTelefoneBR('0083999990001')).toBe('5583999990001');
  });
  it('com + é internacional e não ganha o 55', () => {
    expect(normalizarTelefoneBR('+1 415 555 2671')).toBe('14155552671');
    expect(normalizarTelefoneBR('+351 912 345 678')).toBe('351912345678');
  });
  it('vazio', () => {
    expect(normalizarTelefoneBR('')).toBe('');
    expect(normalizarTelefoneBR(null)).toBe('');
  });
});

describe('jidParaE164', () => {
  it('JID vira E.164, sem tratar como número local', () => {
    expect(jidParaE164('5583999990001@c.us')).toBe('+5583999990001');
    expect(jidParaE164('14155552671@s.whatsapp.net')).toBe('+14155552671');
  });
  it('@lid e vazio não têm número', () => {
    expect(jidParaE164('184730592839482@lid')).toBe('');
    expect(jidParaE164('')).toBe('');
  });
});

describe('variantesTelefoneBR', () => {
  it('celular com 9º dígito tem a versão sem ele', () => {
    expect(variantesTelefoneBR('+5583999990001')).toEqual(['5583999990001', '558399990001']);
  });
  it('celular sem o 9º dígito tem a versão com ele', () => {
    expect(variantesTelefoneBR('558399990001')).toEqual(['558399990001', '5583999990001']);
  });
  it('fixo e estrangeiro têm uma forma só', () => {
    expect(variantesTelefoneBR('558333334444')).toEqual(['558333334444']);
    expect(variantesTelefoneBR('+14155552671')).toEqual(['14155552671']);
  });
  it('vazio', () => expect(variantesTelefoneBR('')).toEqual([]));
});

describe('mesmoTelefone', () => {
  it('ignora formato e o 9º dígito (caso real: WhatsApp sem 9, Cal.com com 9)', () => {
    expect(mesmoTelefone('558399990001@c.us', '+5583999990001')).toBe(true);
    expect(mesmoTelefone('558399990001', '+5583999990001')).toBe(true);
    expect(mesmoTelefone('(83) 99999-0001', '5583999990001')).toBe(true);
  });
  it('números diferentes não casam', () => {
    expect(mesmoTelefone('5583999990001', '5583999990002')).toBe(false);
    expect(mesmoTelefone('', '5583999990001')).toBe(false);
  });
});
