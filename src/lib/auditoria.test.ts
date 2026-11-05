import { describe, it, expect } from 'vitest';
import { agruparEventosPorData, type EventoAuditoria } from './auditoria';

describe('Auditoria Helper', () => {
  it('agrupa eventos por data e rotula Hoje e Ontem', () => {
    const hoje = new Date().toISOString();
    const ontemDate = new Date();
    ontemDate.setDate(ontemDate.getDate() - 1);
    const ontem = ontemDate.toISOString();
    const antiga = '2026-10-15T12:00:00.000Z';

    const eventos: EventoAuditoria[] = [
      {
        agencia_id: 'ag-1',
        modulo: 'demandas',
        acao: 'criou',
        descricao: 'Criou nova demanda de Reels',
        criado_em: hoje,
      },
      {
        agencia_id: 'ag-1',
        modulo: 'propostas',
        acao: 'aprovou',
        descricao: 'Cliente aprovou proposta',
        criado_em: hoje,
      },
      {
        agencia_id: 'ag-1',
        modulo: 'contratos',
        acao: 'assinou',
        descricao: 'Contrato assinado digitalmente',
        criado_em: ontem,
      },
      {
        agencia_id: 'ag-1',
        modulo: 'clientes',
        acao: 'conectou',
        descricao: 'Instagram conectado',
        criado_em: antiga,
      },
    ];

    const grupos = agruparEventosPorData(eventos);
    expect(grupos.length).toBe(3);

    const grupoHoje = grupos.find((g) => g.titulo === 'Hoje');
    expect(grupoHoje).toBeDefined();
    expect(grupoHoje?.itens.length).toBe(2);

    const grupoOntem = grupos.find((g) => g.titulo === 'Ontem');
    expect(grupoOntem).toBeDefined();
    expect(grupoOntem?.itens.length).toBe(1);

    const grupoAntiga = grupos.find((g) => g.data === '2026-10-15');
    expect(grupoAntiga).toBeDefined();
    expect(grupoAntiga?.titulo).toBe('15/10/2026');
  });
});
