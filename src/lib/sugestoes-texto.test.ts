import { describe, expect, it } from 'vitest';
import { campoValido, LIMITE_CAMPO, patchAoAceitar, podeSugerirCampo, validarSugestao } from './sugestoes-texto';

describe('validarSugestao', () => {
  it('aceita texto novo e apara espaços', () => {
    expect(validarSugestao('legenda', '  Nova legenda  ', 'Antiga')).toEqual({ ok: true, texto: 'Nova legenda' });
  });
  it('recusa vazio e não texto', () => {
    expect(validarSugestao('titulo', '   ', 'x').ok).toBe(false);
    expect(validarSugestao('titulo', null, 'x').ok).toBe(false);
  });
  it('recusa igual ao atual, ignorando espaços e quebras de linha do Windows', () => {
    expect(validarSugestao('briefing', 'a\r\nb ', 'a\nb').ok).toBe(false);
  });
  it('respeita o limite por campo', () => {
    expect(validarSugestao('titulo', 'x'.repeat(LIMITE_CAMPO.titulo + 1), '').ok).toBe(false);
    expect(validarSugestao('titulo', 'x'.repeat(LIMITE_CAMPO.titulo), '').ok).toBe(true);
  });
  it('aceita quando o atual é nulo', () => {
    expect(validarSugestao('legenda', 'Oi', null).ok).toBe(true);
  });
});

describe('patchAoAceitar', () => {
  it('roteiro atualiza o texto e o HTML rico', () => {
    expect(patchAoAceitar('briefing', 'Linha 1\n\nLinha 2')).toEqual({
      briefing: 'Linha 1\n\nLinha 2',
      briefing_html: '<p>Linha 1</p><p>Linha 2</p>',
    });
  });
  it('escapa HTML no roteiro', () => {
    expect(patchAoAceitar('briefing', '<b>oi</b>').briefing_html).toBe('<p>&lt;b&gt;oi&lt;/b&gt;</p>');
  });
  it('título e legenda mudam só a própria coluna', () => {
    expect(patchAoAceitar('titulo', 'T')).toEqual({ titulo: 'T' });
    expect(patchAoAceitar('legenda', 'L')).toEqual({ legenda: 'L' });
  });
});

describe('regras', () => {
  it('campo válido', () => {
    expect(campoValido('legenda')).toBe(true);
    expect(campoValido('status')).toBe(false);
  });
  it('planejamento aceita qualquer campo; aprovação só a legenda; depois nada', () => {
    for (const c of ['titulo', 'briefing', 'legenda'] as const) expect(podeSugerirCampo('texto', c)).toBe(true);
    expect(podeSugerirCampo('aprovacao', 'legenda')).toBe(true);
    expect(podeSugerirCampo('aprovacao', 'briefing')).toBe(false);
    expect(podeSugerirCampo('aprovacao', 'titulo')).toBe(false);
    for (const e of ['producao', 'revisao', 'agendado', 'publicado']) expect(podeSugerirCampo(e, 'legenda')).toBe(false);
  });

});
