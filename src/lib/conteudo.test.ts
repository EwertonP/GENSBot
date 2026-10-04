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
  dataLocal,
  deInputData,
  distanciaEmDias,
  ehDataSemHora,
  paraInputData,
  type StatusConteudo,
} from './conteudo';

describe('datas só de dia (prazo e data programada)', () => {
  it('reconhece a meia-noite UTC como data sem horário', () => {
    expect(ehDataSemHora('2026-09-23T00:00:00Z')).toBe(true);
    expect(ehDataSemHora('2026-09-23T00:00:00+00:00')).toBe(true);
    expect(ehDataSemHora('2026-09-23T00:00:00.000Z')).toBe(true);
    expect(ehDataSemHora('2026-09-22T14:50:00+00:00')).toBe(false);
  });

  it('mostra o dia gravado, não o dia anterior do fuso local', () => {
    expect(dataLocal('2026-09-23T00:00:00+00:00').getDate()).toBe(23);
    expect(paraInputData('2026-09-23T00:00:00+00:00')).toBe('2026-09-23');
    expect(paraInputData(null)).toBe('');
  });

  it('não mexe na data programada quando o dia não mudou (preserva o horário)', () => {
    const agendado = new Date(2026, 8, 22, 11, 50).toISOString();
    expect(deInputData(paraInputData(agendado), agendado)).toBe(agendado);
  });

  it('ao trocar o dia, mantém o horário que o post já tinha', () => {
    const agendado = new Date(2026, 8, 22, 11, 50).toISOString();
    const novo = new Date(deInputData('2026-09-25', agendado)!);
    expect([novo.getDate(), novo.getHours(), novo.getMinutes()]).toEqual([25, 11, 50]);
  });

  it('grava dia novo sem horário na convenção de meia-noite UTC', () => {
    expect(deInputData('2026-10-12', null)).toBe('2026-10-12T00:00:00.000Z');
    expect(deInputData('2026-10-12', '2026-10-01T00:00:00+00:00')).toBe('2026-10-12T00:00:00.000Z');
    expect(deInputData('', '2026-10-01T00:00:00+00:00')).toBeNull();
  });

  it('descreve a distância em dias', () => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hoje = new Date();
    const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    const ha3 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 3);
    expect(distanciaEmDias(fmt(hoje))?.texto).toBe('hoje');
    expect(distanciaEmDias(fmt(amanha))?.texto).toBe('amanhã');
    expect(distanciaEmDias(fmt(ha3))).toEqual({ dias: -3, texto: 'há 3 dias' });
    expect(distanciaEmDias('')).toBeNull();
  });
});

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
    expect(STATUS_LABELS.agendamento.label).toBe('Agendamento');
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
