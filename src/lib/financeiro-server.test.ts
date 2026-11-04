import { describe, it, expect } from 'vitest';
import { validarLancamento } from './financeiro-server';

const ok = { tipo: 'despesa', descricao: 'Canva', valor: 49.9, vencimento: '2026-11-10', categoria: 'ferramentas' };

describe('validarLancamento', () => {
  it('aceita um lançamento completo', () => {
    const r = validarLancamento(ok, false);
    expect(r).toMatchObject({ ok: true, campos: { tipo: 'despesa', valor: 49.9 } });
  });
  it('exige os campos na criação', () => {
    expect(validarLancamento({ ...ok, descricao: '  ' }, false)).toMatchObject({ ok: false });
    expect(validarLancamento({ ...ok, valor: 0 }, false)).toMatchObject({ ok: false });
    expect(validarLancamento({ ...ok, vencimento: '2026-02-31' }, false)).toMatchObject({ ok: false });
  });
  it('recusa categoria que não é do tipo', () => {
    expect(validarLancamento({ ...ok, categoria: 'mensalidade' }, false)).toMatchObject({ ok: false });
  });
  it('edição parcial só valida o que veio', () => {
    expect(validarLancamento({ pago: true }, true)).toMatchObject({ ok: true, campos: { pago: true } });
    const r = validarLancamento({ pago: false }, true);
    expect(r).toMatchObject({ ok: true, campos: { pago: false, pago_em: null } });
  });
  it('marcar como pago preenche a data de hoje', () => {
    const r = validarLancamento({ pago: true }, true);
    expect(r.ok && r.campos.pago_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
