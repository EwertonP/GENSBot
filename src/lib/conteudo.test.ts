import { describe, expect, it } from 'vitest';
import {
  clientePodeAgir,
  clientePodeVer,
  formatarTimecode,
  gerarLinkWhatsAppAprovacao,
  gerarMensagemAprovacao,
  motivoBloqueioCliente,
  STATUS_LABELS,
  COLUNAS_KANBAN,
  type StatusConteudo,
} from './conteudo';

describe('acesso do cliente pelo link público', () => {
  const EM_PRODUCAO: StatusConteudo[] = [
    'planejamento',
    'copy',
    'criacao_arte',
    'revisao_arte',
    'em_gravacao',
    'em_edicao',
  ];

  it('esconde o item enquanto ele está em produção', () => {
    for (const status of EM_PRODUCAO) {
      expect(clientePodeVer(status), status).toBe(false);
    }
  });

  it('mostra a partir da revisão do cliente, inclusive depois de resolvida', () => {
    for (const status of ['revisao_cliente', 'revisao_interna', 'agendamento', 'pronto_publicar', 'publicado', 'travado'] as StatusConteudo[]) {
      expect(clientePodeVer(status), status).toBe(true);
    }
  });

  it('só aceita aprovar ou pedir ajuste na vez do cliente', () => {
    expect(clientePodeAgir('revisao_cliente')).toBe(true);
    for (const status of [...EM_PRODUCAO, 'revisao_interna', 'agendamento', 'publicado', 'travado'] as StatusConteudo[]) {
      expect(clientePodeAgir(status), status).toBe(false);
    }
  });

  it('um item já aprovado não pode ser aprovado de novo', () => {
    // Protege o duplo clique: a primeira ação move para agendamento.
    expect(clientePodeAgir('agendamento')).toBe(false);
    expect(motivoBloqueioCliente('agendamento')).toBe('Esta publicação já foi aprovada e está agendada/publicada.');
  });

  it('explica o bloqueio sem expor o estágio interno', () => {
    const emProducao = motivoBloqueioCliente('criacao_arte');
    expect(emProducao).toContain('ainda está em produção');
    for (const rotulo of ['Criação de Arte', 'criacao_arte', 'revisao_interna']) {
      expect(emProducao).not.toContain(rotulo);
    }
    expect(motivoBloqueioCliente('travado')).toContain('ajuste já foi registrado');
  });
});

describe('conteudo / esteira & aprovacao', () => {
  it('formata timecodes em MM:SS corretamente', () => {
    expect(formatarTimecode(0)).toBe('00:00');
    expect(formatarTimecode(9)).toBe('00:09');
    expect(formatarTimecode(27)).toBe('00:27');
    expect(formatarTimecode(60)).toBe('01:00');
    expect(formatarTimecode(75)).toBe('01:15');
    expect(formatarTimecode(3600)).toBe('60:00');
  });

  it('possui labels padronizados e exatamente 6 colunas oficiais no Kanban', () => {
    expect(COLUNAS_KANBAN).toHaveLength(6);
    expect(COLUNAS_KANBAN).toEqual(['planejamento', 'criacao_arte', 'revisao_interna', 'revisao_cliente', 'agendamento', 'publicado']);
    expect(STATUS_LABELS.planejamento.label).toBe('Planejamento');
    expect(STATUS_LABELS.criacao_arte.label).toBe('Criação');
    expect(STATUS_LABELS.revisao_interna.label).toBe('Revisão');
    expect(STATUS_LABELS.revisao_cliente.label).toBe('Aprovação');
    expect(STATUS_LABELS.agendamento.label).toBe('Agendado');
    expect(STATUS_LABELS.publicado.label).toBe('Publicado');
  });

  it('mapeia status legados para as 6 colunas oficiais do Kanban', async () => {
    const { mapearStatusParaColunaKanban } = await import('./conteudo');
    expect(mapearStatusParaColunaKanban('copy')).toBe('criacao_arte');
    expect(mapearStatusParaColunaKanban('em_edicao')).toBe('criacao_arte');
    expect(mapearStatusParaColunaKanban('revisao_arte')).toBe('revisao_interna');
    expect(mapearStatusParaColunaKanban('travado')).toBe('revisao_interna');
    expect(mapearStatusParaColunaKanban('pronto_publicar')).toBe('agendamento');
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

  it('gera link direcionado para WhatsApp Web quando preferWeb é true', () => {
    const link = gerarLinkWhatsAppAprovacao({
      telefone: '11987654321',
      nomeCliente: 'Dr. Paulo',
      tituloPost: 'Carrossel Dicas',
      token: 'tok-web-123',
      preferWeb: true,
    });

    expect(link).toContain('https://web.whatsapp.com/send?phone=5511987654321&text=');
  });

  it('separa texto formatado e link de aprovação com gerarMensagemAprovacao', () => {
    const msg = gerarMensagemAprovacao({
      nomeCliente: 'Dr. Paulo',
      tituloPost: 'Post Especial',
      token: 'tok-msg-456',
      urlOrigem: 'https://gens.app',
    });

    expect(msg.linkAprovacao).toBe('https://gens.app/aprovacao/tok-msg-456');
    expect(msg.texto).toContain('Post Especial');
    expect(msg.texto).toContain('Agência GENS');
  });
});
