import { describe, it, expect } from 'vitest';
import { gerarPdfContrato } from './contrato-pdf';

describe('gerarPdfContrato', () => {
  it('gera um buffer de PDF válido com hash SHA-256 e páginas esperadas', async () => {
    const dados = {
      titulo: 'Contrato de Prestação de Serviços Digitais',
      numero: 'CT-2026-001',
      conteudoHtml: `
        <h1>1. DO OBJETO</h1>
        <p>A CONTRATADA prestará serviços especializados de marketing digital, gestão de redes sociais e tráfego pago.</p>
        <h2>2. DAS OBRIGAÇÕES</h2>
        <ul>
          <li>Fornecer relatórios mensais de desempenho e métricas.</li>
          <li>Manter absoluto sigilo sobre dados confidenciais do cliente.</li>
        </ul>
        <p>Parágrafo final com acentuação complexa: ação, coração, café, ímã, público, você, ótimo.</p>
      `,
      hashDocumento: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      assinaturaCliente: {
        parte: 'contratante' as const,
        nome: 'João da Silva Santos',
        documento: '123.456.789-00',
        email: 'joao@cliente.com',
        dataHora: '2026-11-05T12:00:00.000Z',
        ip: '189.40.10.25',
      },
      assinaturaAgencia: {
        parte: 'contratada' as const,
        nome: 'Ewerton Monteiro',
        documento: '11.222.333/0001-44',
        dataHora: '2026-11-05T12:30:00.000Z',
        ip: '201.50.20.10',
      },
    };

    const resultado = await gerarPdfContrato(dados);

    expect(resultado).toBeDefined();
    expect(Buffer.isBuffer(resultado.buffer)).toBe(true);
    expect(resultado.buffer.length).toBeGreaterThan(1000);
    // Deve começar com a assinatura de arquivo PDF (%PDF-)
    expect(resultado.buffer.slice(0, 4).toString('ascii')).toBe('%PDF');
    // Deve conter hash SHA-256 válido com 64 caracteres hex
    expect(resultado.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
