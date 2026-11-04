import { describe, it, expect } from 'vitest';
import {
  lancamentosDoMes, lerValor, mensalidadesVirtuais, resumirMes, serieMensal, somarMeses, vencimentoMensalidade, type ClienteCobranca, type Lancamento,
} from './financeiro';

const cliente = (o: Partial<ClienteCobranca> = {}): ClienteCobranca => ({ id: 'c1', nome: 'Aurora', valor_mensal: 1500, dia_vencimento: 5, ativo: true, ...o });
const lanc = (o: Partial<Lancamento> = {}): Lancamento => ({
  id: 'l1', tipo: 'despesa', descricao: 'Ferramenta', valor: 100, vencimento: '2026-11-10', pago: false, pago_em: null,
  categoria: 'ferramentas', origem: 'manual', competencia: null, cliente_id: null, ...o,
});

describe('vencimentoMensalidade', () => {
  it('respeita meses curtos', () => {
    expect(vencimentoMensalidade('2026-02', 31)).toBe('2026-02-28');
    expect(vencimentoMensalidade('2026-11', 5)).toBe('2026-11-05');
  });
  it('sem dia usa o dia 5', () => expect(vencimentoMensalidade('2026-11', null)).toBe('2026-11-05'));
});

describe('mensalidadesVirtuais', () => {
  it('gera uma por cliente ativo com valor', () => {
    const v = mensalidadesVirtuais([cliente(), cliente({ id: 'c2', valor_mensal: null }), cliente({ id: 'c3', ativo: false })], '2026-11', []);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ id: 'mensalidade:c1:2026-11', valor: 1500, vencimento: '2026-11-05', virtual: true });
  });
  it('não duplica quando o mês já tem linha real', () => {
    const real = lanc({ tipo: 'receita', origem: 'mensalidade', cliente_id: 'c1', competencia: '2026-11-01', vencimento: '2026-11-05' });
    expect(mensalidadesVirtuais([cliente()], '2026-11', [real])).toHaveLength(0);
  });
});

describe('mensalidade antes do cliente existir', () => {
  it('não gera meses anteriores à entrada', () => {
    const c = cliente({ desde: '2026-11-04T20:03:00Z' });
    expect(mensalidadesVirtuais([c], '2026-10', [])).toHaveLength(0);
    expect(mensalidadesVirtuais([c], '2026-11', [])).toHaveLength(1);
  });
});

describe('resumirMes', () => {
  it('separa recebido, falta receber e atrasados', () => {
    const itens = [
      lanc({ tipo: 'receita', valor: 1500, vencimento: '2026-11-05' }),
      lanc({ id: 'b', tipo: 'receita', valor: 500, pago: true, vencimento: '2026-11-02' }),
      lanc({ id: 'c', tipo: 'despesa', valor: 200, vencimento: '2026-11-20' }),
    ];
    const r = resumirMes(itens, '2026-11-10');
    expect(r).toMatchObject({ receitas: 2000, despesas: 200, resultado: 1800, recebido: 500, faltaReceber: 1500, faltaPagar: 200, atrasados: 1 });
  });
});

describe('lancamentosDoMes e serieMensal', () => {
  it('projeta a mensalidade nos meses seguintes', () => {
    const serie = serieMensal([], [cliente()], '2026-10', 3, new Date('2026-11-04T12:00:00'));
    expect(serie.map((p) => p.receitas)).toEqual([1500, 1500, 1500]);
    expect(serie.map((p) => p.projecao)).toEqual([false, true, true]);
  });
  it('ordena por data', () => {
    const l = lancamentosDoMes([lanc({ vencimento: '2026-11-01' })], [cliente()], '2026-11');
    expect(l.map((x) => x.vencimento)).toEqual(['2026-11-01', '2026-11-05']);
  });
});

describe('somarMeses e lerValor', () => {
  it('vira o ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
  });
  it('lê valores em formato brasileiro', () => {
    expect(lerValor('1.500,50')).toBe(1500.5);
    expect(lerValor('R$ 80')).toBe(80);
    expect(lerValor('abc')).toBeNull();
    expect(lerValor('0')).toBeNull();
  });
});
