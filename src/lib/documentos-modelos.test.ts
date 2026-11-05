import { describe, it, expect } from 'vitest';
import {
  interpolarVariaveis,
  obterModelosPadrao,
  gerarTokenPublico,
  MODELOS_PROPOSTAS_PADRAO,
  MODELOS_CONTRATOS_PADRAO,
} from './documentos-modelos';
import { verificarPerfilAgencia, obterIpRequisicao } from './documentos-server';

describe('Documentos Modelos & Interpolação', () => {
  it('deve ter exatamente 11 modelos de proposta e 9 de contrato padrão', () => {
    expect(MODELOS_PROPOSTAS_PADRAO).toHaveLength(11);
    expect(MODELOS_CONTRATOS_PADRAO).toHaveLength(9);

    const propostas = obterModelosPadrao('proposta');
    expect(propostas).toHaveLength(11);
    expect(propostas.every((p) => p.tipo === 'proposta')).toBe(true);

    const contratos = obterModelosPadrao('contrato');
    expect(contratos).toHaveLength(9);
    expect(contratos.every((c) => c.tipo === 'contrato')).toBe(true);

    const todos = obterModelosPadrao();
    expect(todos).toHaveLength(20);
  });

  it('interpolarVariaveis substitui chaves {{chave}} corretamente', () => {
    const template = 'Olá {{cliente_nome}}, sua proposta na {{agencia_nome}} tem o valor de {{valor_mensal}}.';
    const dados = {
      cliente_nome: 'Padaria Central',
      agencia_nome: 'GENS Digital',
      valor_mensal: 'R$ 2.500,00',
    };

    const resultado = interpolarVariaveis(template, dados);
    expect(resultado).toBe('Olá Padaria Central, sua proposta na GENS Digital tem o valor de R$ 2.500,00.');
  });

  it('interpolarVariaveis substitui campos ausentes por [chave]', () => {
    const template = 'Cliente: {{cliente_nome}} - CPF: {{cliente_doc}}';
    const dados = { cliente_nome: 'João' };

    const resultado = interpolarVariaveis(template, dados);
    expect(resultado).toBe('Cliente: João - CPF: [cliente_doc]');
  });

  it('gerarTokenPublico gera strings alfanuméricas seguras', () => {
    const t1 = gerarTokenPublico();
    const t2 = gerarTokenPublico();
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(20);
  });
});

describe('Documentos Server Helpers', () => {
  it('verificarPerfilAgencia identifica perfil completo', () => {
    const perfilCompleto = {
      nome: 'GENS Agência',
      razao_social: 'GENS Agência LTDA',
      cnpj_cpf: '12.345.678/0001-90',
      endereco: 'Rua Principal, 100',
      chave_pix: 'pix@gens.com.br',
      telefone_contato: '(11) 99999-9999',
    };

    const res = verificarPerfilAgencia(perfilCompleto);
    expect(res.completo).toBe(true);
    expect(res.faltantes).toHaveLength(0);
  });

  it('verificarPerfilAgencia identifica campos faltantes', () => {
    const perfilIncompleto = {
      nome: 'GENS Agência',
      cnpj_cpf: '',
      endereco: undefined,
    };

    const res = verificarPerfilAgencia(perfilIncompleto);
    expect(res.completo).toBe(false);
    expect(res.faltantes).toContain('CNPJ / CPF');
    expect(res.faltantes).toContain('Endereço completo');
    expect(res.faltantes).toContain('Chave PIX');
  });

  it('obterIpRequisicao extrai ip do header x-forwarded-for ou fallback', () => {
    const reqForwarded = new Request('https://gens.com.br', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    });
    expect(obterIpRequisicao(reqForwarded)).toBe('203.0.113.195');

    const reqRealIp = new Request('https://gens.com.br', {
      headers: { 'x-real-ip': '198.51.100.1' },
    });
    expect(obterIpRequisicao(reqRealIp)).toBe('198.51.100.1');

    const reqVazio = new Request('https://gens.com.br');
    expect(obterIpRequisicao(reqVazio)).toBe('127.0.0.1');
  });
});
