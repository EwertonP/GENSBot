import { describe, it, expect } from 'vitest';
import { obterMetaCliente, ehClienteSemMeta } from './clientes-metas';

describe('clientes-metas', () => {
  it('identifica corretamente clientes sem meta fixa (a deixar de lado)', () => {
    expect(ehClienteSemMeta('HDI Santa Maria')).toBe(true);
    expect(ehClienteSemMeta('Terra de Oportunidade')).toBe(true);
    expect(ehClienteSemMeta('Laboratório Santa Sofia')).toBe(true);
    expect(ehClienteSemMeta('Diagno Radiologia')).toBe(true);
    expect(ehClienteSemMeta('Everton.design')).toBe(true);
    expect(ehClienteSemMeta('Dr. Felipe Bezerra')).toBe(true);
  });

  it('retorna meta 0 para clientes a deixar de lado mesmo que tenham algum valor no banco', () => {
    expect(obterMetaCliente({ nome: 'Dr. Felipe Bezerra', posts_mes: 10 })).toBe(0);
    expect(obterMetaCliente({ nome: 'Terra de Oportunidade', posts_mes: 4 })).toBe(0);
    expect(obterMetaCliente({ nome: 'Everton.design', posts_mes: 8 })).toBe(0);
  });

  it('retorna as metas oficiais para os 5 clientes contratados quando não preenchidas no banco', () => {
    expect(obterMetaCliente({ nome: 'Camila Lucas' })).toBe(4);
    expect(obterMetaCliente({ nome: 'Centro de Diagnóstico em Cardiologia' })).toBe(8);
    expect(obterMetaCliente({ nome: 'Farmácia PH' })).toBe(12);
    expect(obterMetaCliente({ nome: 'PH Distribuidora' })).toBe(12);
    expect(obterMetaCliente({ nome: 'NET+' })).toBe(8);
    expect(obterMetaCliente({ nome: 'NetMais Provedor' })).toBe(8);
    expect(obterMetaCliente({ nome: 'Bakanas.net' })).toBe(12);
  });

  it('respeita valores explícitos do banco para clientes ativos se configurados manualmente', () => {
    expect(obterMetaCliente({ nome: 'Camila Lucas', posts_mes: 6 })).toBe(6);
    expect(obterMetaCliente({ nome: 'Bakanas.net', posts_mes: 10, reels_mes: 2 })).toBe(12);
  });

  it('não confunde nomes não relacionados com PH', () => {
    expect(obterMetaCliente({ nome: 'Photoshop Studio' })).toBe(0);
    expect(obterMetaCliente({ nome: 'Alpha Ômega' })).toBe(0);
  });
});
