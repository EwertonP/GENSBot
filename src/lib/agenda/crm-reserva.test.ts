import { describe, expect, it } from 'vitest';
import { acharEstagioAgendado, acharEstagioAtendimento, planejarCrm, type EntradaPlano, type EstagioCrm, type NegocioCrm } from './crm-reserva';
import type { ReservaDoWebhook } from './webhook-calcom';

// Os dois funis reais da Dra. Laís (consultados no banco em 18/11/2026).
const DRA_LAIS: EstagioCrm[] = [
  { id: 'e0', nome: 'Contato / Direct', ordem: 0, tipo_conclusao: 'aberto' },
  { id: 'e1', nome: 'Triagem & Interesse', ordem: 1, tipo_conclusao: 'aberto' },
  { id: 'e2', nome: 'Qualificado / Agendando', ordem: 2, tipo_conclusao: 'aberto' },
  { id: 'e3', nome: 'Consulta Agendada', ordem: 3, tipo_conclusao: 'aberto' },
  { id: 'e4', nome: 'Avaliação / Compareceu', ordem: 4, tipo_conclusao: 'aberto' },
  { id: 'e5', nome: 'Procedimento Fechado', ordem: 5, tipo_conclusao: 'ganho' },
  { id: 'e6', nome: 'Não Compareceu / Desistiu', ordem: 6, tipo_conclusao: 'perdido' },
];
const VENDAS: EstagioCrm[] = [
  { id: 'v0', nome: 'Novo Lead', ordem: 0, tipo_conclusao: 'aberto' },
  { id: 'v1', nome: 'Em Atendimento', ordem: 1, tipo_conclusao: 'aberto' },
  { id: 'v2', nome: 'Qualificado / Agendado', ordem: 2, tipo_conclusao: 'aberto' },
  { id: 'v3', nome: 'Negociação', ordem: 3, tipo_conclusao: 'aberto' },
  { id: 'v4', nome: 'Venda Realizada', ordem: 4, tipo_conclusao: 'ganho' },
  { id: 'v5', nome: 'Perdido', ordem: 5, tipo_conclusao: 'perdido' },
];

const AGORA = new Date('2026-11-18T12:00:00Z');
const FUTURO = '2026-11-23T16:00:00Z'; // 13:00 em Brasília

const reserva = (extra: Partial<ReservaDoWebhook> = {}): ReservaDoWebhook => ({
  gatilho: 'BOOKING_CREATED',
  uid: 'u1',
  status: 'confirmada',
  inicio: FUTURO,
  fim: '2026-11-23T16:30:00Z',
  titulo: null,
  nomeContato: 'Maria',
  email: 'm@e.com',
  telefone: '5583999990001',
  negocioId: null,
  motivoCancelamento: null,
  remarcadaDeUid: null,
  eventoEm: null,
  ...extra,
});
const negocio = (estagio_id: string, status: NegocioCrm['status'] = 'aberto'): NegocioCrm => ({ id: 'n1', status, estagio_id, nome_contato: 'Maria' });
const plano = (e: Partial<EntradaPlano>) =>
  planejarCrm({ reserva: reserva(), negocio: null, estagios: DRA_LAIS, outrasReservasAtivas: 0, reservaJaRemarcada: false, agora: AGORA, ...e });

describe('achar estágios por nome (estrito)', () => {
  it('"Consulta Agendada" exato, ou "Agendado/Agendada" no funil padrão', () => {
    expect(acharEstagioAgendado(DRA_LAIS)?.id).toBe('e3');
    expect(acharEstagioAgendado(VENDAS)?.id).toBe('v2');
  });
  it('"Agendando" é em andamento e NÃO é o estágio de agendado', () => {
    const so = DRA_LAIS.filter((e) => e.id === 'e2');
    expect(acharEstagioAgendado(so)).toBeNull();
  });
  it('sem correspondência devolve null, nunca "o estágio na posição N"', () => {
    const estranho: EstagioCrm[] = [{ id: 'x0', nome: 'Fila' }, { id: 'x1', nome: 'Triado' }, { id: 'x2', nome: 'Fechado', tipo_conclusao: 'ganho' }];
    expect(acharEstagioAgendado(estranho)).toBeNull();
    expect(acharEstagioAtendimento(estranho)).toBeNull();
  });
  it('estágio final nunca é o alvo', () => {
    expect(acharEstagioAgendado([{ id: 'g', nome: 'Consulta Agendada', tipo_conclusao: 'ganho' }])).toBeNull();
  });
  it('volta para "Em Atendimento", ou "Triagem" no funil da Dra. Laís', () => {
    expect(acharEstagioAtendimento(VENDAS)?.id).toBe('v1');
    expect(acharEstagioAtendimento(DRA_LAIS)?.id).toBe('e1');
  });
});

describe('reserva CONFIRMADA', () => {
  it('negócio aberto em estágio anterior: move, registra e cria a tarefa 24 h antes', () => {
    const p = plano({ negocio: negocio('e1') });
    expect(p.moverPara?.id).toBe('e3');
    expect(p.atividades.map((a) => a.tipo)).toEqual(['reuniao', 'mudanca_estagio']);
    expect(p.atividades[0].descricao).toBe('Consulta marcada para 23/11/2026, 13:00.');
    expect(p.tarefa).toMatchObject({ tipo: 'whatsapp', natureza: 'confirmar', titulo: expect.stringContaining('Confirmar presença de Maria') });
    expect(p.concluirRemarcarPendentes).toBe(true);
    expect(p.tarefa!.prazo.toISOString()).toBe('2026-11-22T16:00:00.000Z');
    expect(p.criarNegocio).toBeNull();
  });

  it('sem negócio no CRM: cria já no estágio de agendado', () => {
    const p = plano({ negocio: null });
    expect(p.criarNegocio?.estagio?.id).toBe('e3');
    expect(p.moverPara).toBeNull();
  });

  it('negócio já ganho ou perdido: registra, NÃO move, NÃO reabre e não cria tarefa', () => {
    for (const status of ['ganho', 'perdido'] as const) {
      const p = plano({ negocio: negocio('e5', status) });
      expect(p.moverPara).toBeNull();
      expect(p.criarNegocio).toBeNull();
      expect(p.tarefa).toBeNull();
      expect(p.atividades.some((a) => a.descricao.includes('não foi reaberto'))).toBe(true);
    }
  });

  it('a equipe já levou mais adiante: nunca puxa para trás', () => {
    const p = plano({ negocio: negocio('e4') }); // Avaliação / Compareceu, depois de Consulta Agendada
    expect(p.moverPara).toBeNull();
    expect(p.atividades.map((a) => a.tipo)).toEqual(['reuniao']);
  });

  it('já está no estágio certo: só registra', () => {
    const p = plano({ negocio: negocio('e3') });
    expect(p.moverPara).toBeNull();
  });

  it('funil sem estágio de agendado: registra e não move', () => {
    const p = plano({ negocio: negocio('x0'), estagios: [{ id: 'x0', nome: 'Fila', ordem: 0 }, { id: 'x1', nome: 'Triado', ordem: 1 }] });
    expect(p.moverPara).toBeNull();
    expect(p.atividades).toHaveLength(1);
  });

  it('consulta em menos de 24 h: a tarefa vence agora', () => {
    const p = plano({ negocio: negocio('e1'), reserva: reserva({ inicio: '2026-11-19T10:00:00Z' }) });
    expect(p.tarefa!.prazo.toISOString()).toBe(AGORA.toISOString());
  });

  it('consulta no passado: sem tarefa', () => {
    expect(plano({ negocio: negocio('e1'), reserva: reserva({ inicio: '2026-11-01T10:00:00Z' }) }).tarefa).toBeNull();
  });

  it('funil padrão "Vendas": usa "Qualificado / Agendado"', () => {
    const p = plano({ negocio: negocio('v1'), estagios: VENDAS });
    expect(p.moverPara?.id).toBe('v2');
  });
});

describe('reserva REMARCADA (BOOKING_RESCHEDULED: confirmada com remarcadaDeUid)', () => {
  it('registra o novo horário, conclui a tarefa da antiga e não desfaz nem refaz estágio', () => {
    const p = plano({ negocio: negocio('e3'), reserva: reserva({ uid: 'nova', remarcadaDeUid: 'velha', gatilho: 'BOOKING_RESCHEDULED' }) });
    expect(p.atividades[0].descricao).toContain('remarcada');
    expect(p.concluirTarefasDe).toEqual(['velha']);
    expect(p.moverPara).toBeNull();
    expect(p.tarefa).not.toBeNull(); // nova tarefa de confirmar
  });
});

describe('reserva CANCELADA ou RECUSADA', () => {
  it('única consulta e negócio no estágio de agendado: volta, registra o motivo e pede para remarcar', () => {
    const p = plano({ negocio: negocio('e3'), reserva: reserva({ status: 'cancelada', motivoCancelamento: 'imprevisto' }) });
    expect(p.moverPara?.id).toBe('e1');
    expect(p.atividades.map((a) => a.descricao)[0]).toContain('cancelada');
    expect(p.atividades[0].descricao).toContain('imprevisto');
    expect(p.tarefa).toMatchObject({ titulo: 'Remarcar consulta com Maria', natureza: 'remarcar' });
    expect(p.concluirRemarcarPendentes).toBe(false);
    expect(p.concluirTarefasDe).toEqual(['u1']);
  });

  it('recusada diz "recusada"', () => {
    const p = plano({ negocio: negocio('e3'), reserva: reserva({ status: 'recusada' }) });
    expect(p.atividades[0].descricao).toContain('recusada');
  });

  it('há outra consulta ativa: só registra, não move nem pede remarcação', () => {
    const p = plano({ negocio: negocio('e3'), outrasReservasAtivas: 1, reserva: reserva({ status: 'cancelada' }) });
    expect(p.moverPara).toBeNull();
    expect(p.tarefa).toBeNull();
    expect(p.atividades).toHaveLength(1);
  });

  it('a equipe já tinha movido o negócio: não desfaz', () => {
    const p = plano({ negocio: negocio('e4'), reserva: reserva({ status: 'cancelada' }) });
    expect(p.moverPara).toBeNull();
    expect(p.tarefa).toBeNull();
  });

  it('cancelamento da reserva que já foi remarcada NÃO é cancelamento: nada acontece', () => {
    const p = plano({ negocio: negocio('e3'), reservaJaRemarcada: true, reserva: reserva({ status: 'cancelada' }) });
    expect(p).toEqual({ criarNegocio: null, moverPara: null, atividades: [], tarefa: null, concluirTarefasDe: [], concluirRemarcarPendentes: false });
  });

  it('sem negócio no CRM: nada a atualizar', () => {
    expect(plano({ negocio: null, reserva: reserva({ status: 'cancelada' }) }).atividades).toEqual([]);
  });
});

describe('reserva PENDENTE', () => {
  it('registra e pede confirmação, sem mover o estágio', () => {
    const p = plano({ negocio: negocio('e0'), reserva: reserva({ status: 'pendente' }) });
    expect(p.moverPara).toBeNull();
    expect(p.atividades[0].descricao).toContain('aguardando confirmação');
    expect(p.tarefa?.titulo).toContain('Confirmar consulta solicitada');
  });
  it('sem negócio: cria no estágio de atendimento, não no de agendado', () => {
    expect(plano({ negocio: null, reserva: reserva({ status: 'pendente' }) }).criarNegocio?.estagio?.id).toBe('e1');
  });
});
