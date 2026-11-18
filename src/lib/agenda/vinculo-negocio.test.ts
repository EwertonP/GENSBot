import { describe, expect, it } from 'vitest';
import { escolherNegocio, type NegocioCandidato } from './vinculo-negocio';

const n = (id: string, telefone: string | null, status = 'aberto', atualizado_em = '2026-11-01'): NegocioCandidato => ({
  id,
  telefone,
  status,
  atualizado_em,
});

describe('escolherNegocio', () => {
  it('casa pelo telefone mesmo sem o 9º dígito ou com máscara', () => {
    expect(escolherNegocio([n('a', '558399990001')], '5583999990001')).toBe('a');
    expect(escolherNegocio([n('a', '(83) 99999-0001')], '5583999990001')).toBe('a');
  });
  it('ignora números diferentes e vazios', () => {
    expect(escolherNegocio([n('a', '5583999990002'), n('b', null)], '5583999990001')).toBeNull();
    expect(escolherNegocio([], '5583999990001')).toBeNull();
  });
  it('prefere o negócio aberto ao encerrado', () => {
    expect(escolherNegocio([n('velho', '5583999990001', 'ganho', '2026-11-10'), n('aberto', '5583999990001', 'aberto', '2026-10-01')], '5583999990001')).toBe('aberto');
  });
  it('entre abertos, o mexido por último', () => {
    expect(escolherNegocio([n('a', '5583999990001', 'aberto', '2026-10-01'), n('b', '5583999990001', 'aberto', '2026-11-05')], '5583999990001')).toBe('b');
  });
});
