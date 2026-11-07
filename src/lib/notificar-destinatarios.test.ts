import { describe, expect, it } from 'vitest';
import { destinatariosDaDemanda, unirDestinatarios } from './notificar-destinatarios';

describe('destinatariosDaDemanda', () => {
  it('responsável e co-responsáveis, sem repetir nem vazios', () => {
    expect(destinatariosDaDemanda({ responsavel_id: 'a', co_responsaveis_ids: ['b', 'a', ''] })).toEqual(['a', 'b']);
  });
  it('editor só quando pedido', () => {
    expect(destinatariosDaDemanda({ responsavel_id: 'a', editor_id: 'e' })).toEqual(['a']);
    expect(destinatariosDaDemanda({ responsavel_id: 'a', editor_id: 'e' }, { incluirEditor: true })).toEqual(['a', 'e']);
  });
  it('aceita campos ausentes ou nulos', () => {
    expect(destinatariosDaDemanda({})).toEqual([]);
    expect(destinatariosDaDemanda({ responsavel_id: null, co_responsaveis_ids: null })).toEqual([]);
  });
});

describe('unirDestinatarios', () => {
  it('une listas sem repetir', () => {
    expect(unirDestinatarios(['a', null], ['b', 'a'], [undefined, 'c'])).toEqual(['a', 'b', 'c']);
  });
});
