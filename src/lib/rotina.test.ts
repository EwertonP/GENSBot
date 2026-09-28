import { describe, expect, it } from 'vitest';
import {
  camposDaTransicao,
  colunaDaDemanda,
  compararCards,
  concluidoRecente,
  estaAtrasado,
  etapaAoSoltarDemanda,
  formatarEstimativa,
  normalizarStatusTarefa,
} from './rotina';

describe('normalizarStatusTarefa', () => {
  it('trata o status legado pendente como a_fazer', () => {
    expect(normalizarStatusTarefa('pendente')).toBe('a_fazer');
    expect(normalizarStatusTarefa(null)).toBe('a_fazer');
  });
  it('mantém os status do Kanban', () => {
    expect(normalizarStatusTarefa('fazendo')).toBe('fazendo');
    expect(normalizarStatusTarefa('aguardando')).toBe('aguardando');
    expect(normalizarStatusTarefa('concluido')).toBe('concluido');
  });
});

describe('colunaDaDemanda', () => {
  it('mapeia as etapas da esteira nas colunas pessoais', () => {
    expect(colunaDaDemanda('planejamento')).toBe('a_fazer');
    expect(colunaDaDemanda('em_edicao')).toBe('fazendo');
    expect(colunaDaDemanda('travado')).toBe('fazendo');
    expect(colunaDaDemanda('revisao_cliente')).toBe('aguardando');
    expect(colunaDaDemanda('pronto_publicar')).toBe('aguardando');
    expect(colunaDaDemanda('publicado')).toBe('concluido');
  });
});

describe('etapaAoSoltarDemanda', () => {
  it('não deixa publicar pelo Kanban pessoal', () => {
    expect(etapaAoSoltarDemanda('revisao_cliente', 'concluido')).toBeNull();
  });
  it('mantém a etapa atual quando já pertence à coluna de destino', () => {
    expect(etapaAoSoltarDemanda('em_edicao', 'fazendo')).toBe('em_edicao');
    expect(etapaAoSoltarDemanda('revisao_cliente', 'aguardando')).toBe('revisao_cliente');
  });
  it('move para a etapa padrão da coluna', () => {
    expect(etapaAoSoltarDemanda('planejamento', 'fazendo')).toBe('criacao_arte');
    expect(etapaAoSoltarDemanda('criacao_arte', 'aguardando')).toBe('revisao_interna');
    expect(etapaAoSoltarDemanda('revisao_interna', 'a_fazer')).toBe('planejamento');
  });
});

describe('camposDaTransicao', () => {
  const agora = new Date('2026-09-28T12:00:00.000Z');
  it('marca início e conclusão', () => {
    expect(camposDaTransicao('fazendo', { iniciado_em: null }, agora)).toEqual({
      concluido_em: null,
      iniciado_em: agora.toISOString(),
      aguardando_de: null,
    });
    expect(camposDaTransicao('concluido', { iniciado_em: '2026-09-27T10:00:00.000Z' }, agora)).toEqual({
      concluido_em: agora.toISOString(),
      aguardando_de: null,
    });
  });
  it('preserva aguardando_de só na coluna Aguardando', () => {
    expect(camposDaTransicao('aguardando', null, agora)).toEqual({ concluido_em: null });
  });
});

describe('estaAtrasado / concluidoRecente', () => {
  const hoje = new Date(2026, 8, 28);
  it('prazo antes de hoje e não concluído é atraso', () => {
    expect(estaAtrasado('2026-09-27', 'a_fazer', hoje)).toBe(true);
    expect(estaAtrasado('2026-09-28', 'a_fazer', hoje)).toBe(false);
    expect(estaAtrasado('2026-09-01', 'concluido', hoje)).toBe(false);
    expect(estaAtrasado(null, 'fazendo', hoje)).toBe(false);
  });
  it('concluído some depois de 14 dias', () => {
    expect(concluidoRecente('2026-09-20T10:00:00.000Z', hoje)).toBe(true);
    expect(concluidoRecente('2026-09-01T10:00:00.000Z', hoje)).toBe(false);
    expect(concluidoRecente(null, hoje)).toBe(false);
  });
});

describe('compararCards', () => {
  it('atrasado > prioridade > prazo', () => {
    const cards = [
      { id: 'c', prazo: '2026-10-05', prioridade: 'normal', atrasado: false },
      { id: 'b', prazo: null, prioridade: 'urgente', atrasado: false },
      { id: 'a', prazo: '2026-09-20', prioridade: 'baixa', atrasado: true },
      { id: 'd', prazo: '2026-10-01', prioridade: 'normal', atrasado: false },
    ];
    expect([...cards].sort(compararCards).map((c) => c.id)).toEqual(['a', 'b', 'd', 'c']);
  });
});

describe('formatarEstimativa', () => {
  it('formata minutos', () => {
    expect(formatarEstimativa(45)).toBe('45min');
    expect(formatarEstimativa(120)).toBe('2h');
    expect(formatarEstimativa(150)).toBe('2h30');
    expect(formatarEstimativa(0)).toBe('0min');
  });
});
