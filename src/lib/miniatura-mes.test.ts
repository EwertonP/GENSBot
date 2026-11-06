import { describe, expect, it } from 'vitest';
import { descricaoDaMiniatura, identificacaoDoCliente, linhasDaImagem, nomeDoMes, tituloDaMiniatura } from './miniatura-mes';

describe('miniatura do link do mês', () => {
  it('nome do mês em português', () => {
    expect(nomeDoMes('2026-11-01')).toEqual({ nome: 'Novembro', minusculo: 'novembro', ano: '2026' });
    expect(nomeDoMes('2026-03-01').minusculo).toBe('março');
  });

  it('identifica o cliente pelo @ do Instagram, sem duplicar o @', () => {
    expect(identificacaoDoCliente({ nome: 'Camila', usuario: 'camilalucas_adv' })).toBe('@camilalucas_adv');
    expect(identificacaoDoCliente({ nome: 'Camila', usuario: '@camilalucas_adv' })).toBe('@camilalucas_adv');
    expect(identificacaoDoCliente({ nome: 'Lab Santa Sophia', usuario: null })).toBe('Lab Santa Sophia');
  });

  it('título com mês, ano e cliente', () => {
    expect(tituloDaMiniatura({ nome: 'x', usuario: 'camilalucas_adv' }, '2026-11-01')).toBe('Conteúdo de novembro de 2026 · @camilalucas_adv');
  });

  it('descrição: plural, singular e sem pendência', () => {
    expect(descricaoDaMiniatura({ mes: '2026-11-01', total: 9, para_voce: 2 })).toBe('9 posts em novembro. 2 esperam a sua aprovação. Acompanhe cada etapa e aprove por aqui.');
    expect(descricaoDaMiniatura({ mes: '2026-11-01', total: 1, para_voce: 1 })).toBe('1 post em novembro. 1 espera a sua aprovação. Acompanhe cada etapa e aprove por aqui.');
    expect(descricaoDaMiniatura({ mes: '2026-12-01', total: 4, para_voce: 0 })).toBe('4 posts em dezembro. Acompanhe cada etapa e aprove por aqui.');
    expect(descricaoDaMiniatura({ mes: '2026-12-01', total: 0, para_voce: 0 })).toContain('conforme são planejados');
  });

  it('linhas da imagem só com etapas que têm posts, na ordem do processo', () => {
    const l = linhasDaImagem({ texto: 4, producao: 0, revisao: 1, aprovacao: 2, agendado: 0, publicado: 1 });
    expect(l.map((x) => x.etapa)).toEqual(['texto', 'revisao', 'aprovacao', 'publicado']);
    expect(l.map((x) => x.n)).toEqual([4, 1, 2, 1]);
  });
});
