import { describe, expect, it } from 'vitest';
import {
  formatarTimecode,
  gerarLinkWhatsAppAprovacao,
  STATUS_LABELS,
  COLUNAS_KANBAN,
} from './conteudo';

describe('conteudo / esteira & aprovacao', () => {
  it('formata timecodes em MM:SS corretamente', () => {
    expect(formatarTimecode(0)).toBe('00:00');
    expect(formatarTimecode(9)).toBe('00:09');
    expect(formatarTimecode(27)).toBe('00:27');
    expect(formatarTimecode(60)).toBe('01:00');
    expect(formatarTimecode(75)).toBe('01:15');
    expect(formatarTimecode(3600)).toBe('60:00');
  });

  it('possui labels e tags para todos os 13 status', () => {
    expect(STATUS_LABELS.planejamento.label).toBe('Planejamento');
    expect(STATUS_LABELS.copy.label).toBe('Redação / Copy');
    expect(STATUS_LABELS.revisao_cliente.label).toBe('Aprovação Cliente');
    expect(STATUS_LABELS.travado.variant).toBe('destructive');
    expect(STATUS_LABELS.publicado.variant).toBe('success');
  });

  it('gera link de aprovação no WhatsApp com mensagem formatada', () => {
    const link = gerarLinkWhatsAppAprovacao({
      nomeCliente: 'Dr. Paulo',
      tituloPost: '5 Dicas de Clareamento',
      token: 'tok-1234-uuid',
      urlOrigem: 'https://gens.app',
    });

    expect(link).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(link)).toContain('https://gens.app/aprovacao/tok-1234-uuid');
    expect(decodeURIComponent(link)).toContain('5 Dicas de Clareamento');
    expect(decodeURIComponent(link)).toContain('Agência GENS');
  });

  it('gera link de aprovação no WhatsApp incluindo número de telefone quando fornecido', () => {
    const link = gerarLinkWhatsAppAprovacao({
      telefone: '(11) 98765-4321',
      nomeCliente: 'Dra. Mariana',
      tituloPost: 'Vídeo Institucional',
      token: 'tok-video-999',
      urlOrigem: 'https://gens.app',
    });

    expect(link).toContain('https://wa.me/5511987654321?text=');
    expect(decodeURIComponent(link)).toContain('https://gens.app/aprovacao/tok-video-999');
  });
});
