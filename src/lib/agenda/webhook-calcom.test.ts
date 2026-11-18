import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashDoEvento, interpretarWebhookCalcom, verificarAssinaturaCalcom } from './webhook-calcom';

const NEG = '3f792b6e-bdac-4058-89e6-fc08ce7bcb4b';

const criado = {
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2026-11-19T15:00:00.000Z',
  payload: {
    uid: 'abc123',
    title: 'Consulta entre Dra. Laís e Maria',
    startTime: '2026-11-20T12:00:00Z',
    endTime: '2026-11-20T12:30:00Z',
    attendees: [{ name: 'Maria', email: 'maria@exemplo.com', phoneNumber: '+5583999990001' }],
    responses: { attendeePhoneNumber: { value: '+5583999990001' } },
    metadata: { negocio_id: NEG },
  },
};

describe('verificarAssinaturaCalcom', () => {
  const corpo = JSON.stringify(criado);
  const assina = (c: string, s: string) => createHmac('sha256', s).update(c).digest('hex');

  it('aceita a assinatura correta', () => {
    expect(verificarAssinaturaCalcom(corpo, assina(corpo, 'segredo'), 'segredo')).toBe(true);
  });
  it('aceita prefixo sha256= e maiúsculas', () => {
    expect(verificarAssinaturaCalcom(corpo, `sha256=${assina(corpo, 'segredo').toUpperCase()}`, 'segredo')).toBe(true);
  });
  it('recusa segredo errado, corpo alterado e assinatura ausente ou malformada', () => {
    expect(verificarAssinaturaCalcom(corpo, assina(corpo, 'outro'), 'segredo')).toBe(false);
    expect(verificarAssinaturaCalcom(corpo + ' ', assina(corpo, 'segredo'), 'segredo')).toBe(false);
    expect(verificarAssinaturaCalcom(corpo, null, 'segredo')).toBe(false);
    expect(verificarAssinaturaCalcom(corpo, 'não-é-hex', 'segredo')).toBe(false);
    expect(verificarAssinaturaCalcom(corpo, assina(corpo, 'segredo'), '')).toBe(false);
  });
});

describe('hashDoEvento', () => {
  it('é igual para o mesmo corpo e diferente se algo muda', () => {
    expect(hashDoEvento('a')).toBe(hashDoEvento('a'));
    expect(hashDoEvento('a')).not.toBe(hashDoEvento('b'));
  });
});

describe('interpretarWebhookCalcom', () => {
  it('reserva criada', () => {
    expect(interpretarWebhookCalcom(criado)).toEqual({
      gatilho: 'BOOKING_CREATED',
      uid: 'abc123',
      status: 'confirmada',
      inicio: '2026-11-20T12:00:00Z',
      fim: '2026-11-20T12:30:00Z',
      titulo: 'Consulta entre Dra. Laís e Maria',
      nomeContato: 'Maria',
      email: 'maria@exemplo.com',
      telefone: '5583999990001',
      negocioId: NEG,
      motivoCancelamento: null,
      remarcadaDeUid: null,
      eventoEm: '2026-11-19T15:00:00.000Z',
    });
  });

  it('cancelamento chega sem metadata: telefone e uid bastam para casar', () => {
    const r = interpretarWebhookCalcom({
      triggerEvent: 'BOOKING_CANCELLED',
      payload: { uid: 'abc123', cancellationReason: 'não posso', attendees: [{ phoneNumber: '(83) 99999-0001' }] },
    })!;
    expect(r.status).toBe('cancelada');
    expect(r.negocioId).toBeNull();
    expect(r.telefone).toBe('5583999990001');
    expect(r.motivoCancelamento).toBe('não posso');
  });

  it('solicitação pendente e recusa', () => {
    expect(interpretarWebhookCalcom({ triggerEvent: 'BOOKING_REQUESTED', payload: { uid: 'u' } })!.status).toBe('pendente');
    expect(interpretarWebhookCalcom({ triggerEvent: 'BOOKING_REJECTED', payload: { uid: 'u' } })!.status).toBe('recusada');
  });

  it('remarcação aponta para a reserva antiga', () => {
    const r = interpretarWebhookCalcom({ triggerEvent: 'BOOKING_RESCHEDULED', payload: { uid: 'nova', rescheduleUid: 'velha' } })!;
    expect(r.status).toBe('confirmada');
    expect(r.remarcadaDeUid).toBe('velha');
    expect(interpretarWebhookCalcom({ triggerEvent: 'BOOKING_RESCHEDULED', payload: { uid: 'x', rescheduleUid: 'x' } })!.remarcadaDeUid).toBeNull();
  });

  it('negocio_id que não é uuid é descartado', () => {
    const r = interpretarWebhookCalcom({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'u', metadata: { negocio_id: "'; drop table--" } } })!;
    expect(r.negocioId).toBeNull();
  });

  it('PING, evento desconhecido e lixo viram null', () => {
    expect(interpretarWebhookCalcom({ triggerEvent: 'PING', payload: {} })).toBeNull();
    expect(interpretarWebhookCalcom({ triggerEvent: 'MEETING_ENDED', payload: { uid: 'u' } })).toBeNull();
    expect(interpretarWebhookCalcom({ triggerEvent: 'BOOKING_CREATED', payload: {} })).toBeNull();
    expect(interpretarWebhookCalcom(null)).toBeNull();
    expect(interpretarWebhookCalcom('texto')).toBeNull();
  });

  it('sem telefone informado', () => {
    expect(interpretarWebhookCalcom({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'u' } })!.telefone).toBe('');
  });
});
