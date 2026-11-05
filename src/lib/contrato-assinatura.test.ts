import { describe, it, expect } from 'vitest';
import {
  hashDocumento,
  validarDadosSignatario,
  podeAssinarContrato,
} from './contrato-assinatura';

describe('Contrato Assinatura Helper', () => {
  it('gera hash SHA-256 consistente e determinístico', () => {
    const html1 = '<p>Contrato de prestação de serviços</p>';
    const html2 = '<p>Contrato de prestação de serviços</p>';
    const html3 = '<p>Contrato de prestação de serviços alterado</p>';

    const hash1 = hashDocumento(html1);
    const hash2 = hashDocumento(html2);
    const hash3 = hashDocumento(html3);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('valida dados do signatário corretamente', () => {
    // Nome com apenas 1 palavra
    expect(validarDadosSignatario('Ewerton', '12345678909').valido).toBe(false);

    // Documento inválido (tamanho errado)
    expect(validarDadosSignatario('Ewerton Phillipe', '12345').valido).toBe(false);

    // Sequência repetida
    expect(validarDadosSignatario('Ewerton Phillipe', '11111111111').valido).toBe(false);

    // E-mail inválido
    expect(validarDadosSignatario('Ewerton Phillipe', '12345678909', 'email-invalido').valido).toBe(false);

    // Válido com CPF
    expect(validarDadosSignatario('Ewerton Phillipe', '12345678909', 'ewerton@example.com').valido).toBe(true);

    // Válido com CNPJ formatado
    expect(validarDadosSignatario('Empresa Contratante Ltda', '12.345.678/0001-90').valido).toBe(true);
  });

  it('verifica se o contrato pode ser assinado de acordo com o status e validade', () => {
    // Rascunho ou aguardando_assinatura: OK
    expect(podeAssinarContrato({ status: 'aguardando_assinatura' }).pode).toBe(true);
    expect(podeAssinarContrato({ status: 'rascunho' }).pode).toBe(true);

    // Já assinado
    expect(podeAssinarContrato({ status: 'assinado' }).pode).toBe(false);
    expect(podeAssinarContrato({ status: 'assinado_cliente' }).pode).toBe(false);

    // Cancelado ou revogado
    expect(podeAssinarContrato({ status: 'cancelado' }).pode).toBe(false);
    expect(podeAssinarContrato({ status: 'aguardando_assinatura', revogado_em: '2026-11-01T00:00:00Z' }).pode).toBe(false);

    // Expirado
    const ontem = new Date(Date.now() - 86400000).toISOString();
    expect(podeAssinarContrato({ status: 'aguardando_assinatura', expira_em: ontem }).pode).toBe(false);

    // Futuro
    const amanha = new Date(Date.now() + 86400000).toISOString();
    expect(podeAssinarContrato({ status: 'aguardando_assinatura', expira_em: amanha }).pode).toBe(true);
  });
});
